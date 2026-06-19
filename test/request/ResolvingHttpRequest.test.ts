import assert from 'node:assert/strict';
import type * as http from 'node:http';
import { afterEach, beforeEach, describe, it } from 'node:test';

import HttpError from '../../src/http/HttpError.ts';
import { HttpMethod } from '../../src/http/HttpMethod.ts';
import ResolvingHttpRequest from '../../src/request/ResolvingHttpRequest.ts';
import TestHelper from '../TestHelper.ts';

/** Invokes the private onResponse switch directly with a stubbed response. */
function dispatch(request: ResolvingHttpRequest, response: http.IncomingMessage): void {
	(request as unknown as { onResponse(r: http.IncomingMessage): void }).onResponse(response);
}

/** Drives resolve() to completion through the resolve/error callbacks. */
function run(request: ResolvingHttpRequest): Promise<http.IncomingMessage> {
	return new Promise((resolve, reject) => {
		request.onResolve = (response) => resolve(response);
		request.onError = (error) => reject(error);
		request.resolve();
	});
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('ResolvingHttpRequest', () => {
	describe('onResponse (stubbed responses)', () => {
		let request: ResolvingHttpRequest;
		let resolved: http.IncomingMessage | undefined;
		let errors: Error[];

		beforeEach(() => {
			request = new ResolvingHttpRequest('http://127.0.0.1/', HttpMethod.GET);
			resolved = undefined;
			errors = [];
			request.onResolve = (response) => {
				resolved = response;
			};
			request.onError = (error) => {
				errors.push(error);
			};
		});

		it('resolves a 200 and parses content-length', () => {
			dispatch(request, TestHelper.stubResponse(200, { 'content-length': '1000' }));
			assert.equal(resolved?.statusCode, 200);
			assert.equal(request.totalBytes, 1000);
			assert.equal(request.requestedBytes, 1000);
			assert.equal(errors.length, 0);
		});

		it('resolves a 200 with no content-length and reports zero total bytes', () => {
			// Given a 200 response that omits content-length (e.g. chunked transfer encoding)
			dispatch(request, TestHelper.stubResponse(200, {}));
			// Then it still resolves, with the byte counters left at their unknown (0) default
			assert.equal(resolved?.statusCode, 200);
			assert.equal(request.totalBytes, 0);
			assert.equal(request.requestedBytes, 0);
			assert.equal(errors.length, 0);
		});

		it('resolves a 206 and parses content-range', () => {
			dispatch(request, TestHelper.stubResponse(206, { 'content-range': 'bytes 0-499/1234' }));
			assert.equal(resolved?.statusCode, 206);
			assert.equal(request.totalBytes, 1234);
			assert.equal(request.requestedBytes, 500);
		});

		it('errors a 206 with no range header', () => {
			dispatch(request, TestHelper.stubResponse(206, {}));
			assert.match(errors[0]!.message, /Partial content without range header\./);
		});

		it('errors a 206 with an invalid range header', () => {
			dispatch(request, TestHelper.stubResponse(206, { 'content-range': 'pages 0-499/1234' }));
			assert.match(errors[0]!.message, /Invalid range header\./);
		});

		it('surfaces a 4xx as a single HttpError [#7]', () => {
			dispatch(request, TestHelper.stubResponse(404, {}));
			assert.equal(errors.length, 1);
			const error: Error | undefined = errors[0];
			assert.ok(error instanceof HttpError);
			assert.equal(error.statusCode, 404);
			assert.equal(resolved, undefined);
		});

		it('surfaces a 5xx as a single HttpError [#7]', () => {
			dispatch(request, TestHelper.stubResponse(500, {}));
			assert.equal(errors.length, 1);
			assert.ok(errors[0] instanceof HttpError);
		});

		it('errors when the status code is missing', () => {
			dispatch(request, TestHelper.stubResponse(undefined, {}));
			assert.match(errors[0]!.message, /Response without status code\./);
		});

		it('resolves a non-200 success status (204)', () => {
			dispatch(request, TestHelper.stubResponse(204, {}));
			assert.equal(resolved?.statusCode, 204);
			assert.equal(errors.length, 0);
		});

		it('errors an unhandled redirect-range status (305)', () => {
			dispatch(request, TestHelper.stubResponse(305, {}));
			assert.match(errors[0]!.message, /Unhandled status code: 305/);
		});
	});

	describe('redirects (loopback)', () => {
		let server: http.Server | undefined;

		afterEach(async () => {
			if (server === undefined) {
				return;
			}
			const running: http.Server = server;
			server = undefined;
			await new Promise<void>((resolve) => running.close(() => resolve()));
		});

		it('follows a 301 with exactly one follow-up request [#2]', async () => {
			let targetHits: number = 0;
			const started = await TestHelper.startLoopbackServer((req, res) => {
				if (req.url === '/start') {
					res.writeHead(301, { location: `http://${req.headers.host}/target` });
					res.end();
				}
				else {
					targetHits++;
					res.writeHead(200, { 'content-length': '4' });
					res.end('done');
				}
			});
			server = started.server;

			const request = new ResolvingHttpRequest(`${started.url}/start`, HttpMethod.GET);
			const response: http.IncomingMessage = await run(request);
			response.destroy();
			await delay(50);

			assert.equal(targetHits, 1);
		});

		it('downgrades a 302 follow-up to GET', async () => {
			let targetMethod: string | undefined;
			const started = await TestHelper.startLoopbackServer((req, res) => {
				if (req.url === '/start') {
					res.writeHead(302, { location: `http://${req.headers.host}/target` });
					res.end();
				}
				else {
					targetMethod = req.method;
					res.writeHead(200, { 'content-length': '4' });
					res.end('done');
				}
			});
			server = started.server;

			const request = new ResolvingHttpRequest(`${started.url}/start`, HttpMethod.POST, undefined, 'body');
			const response: http.IncomingMessage = await run(request);
			response.destroy();

			assert.equal(targetMethod, 'GET');
		});

		it('downgrades a 303 follow-up to GET', async () => {
			let targetMethod: string | undefined;
			const started = await TestHelper.startLoopbackServer((req, res) => {
				if (req.url === '/start') {
					res.writeHead(303, { location: `http://${req.headers.host}/target` });
					res.end();
				}
				else {
					targetMethod = req.method;
					res.writeHead(200, { 'content-length': '4' });
					res.end('done');
				}
			});
			server = started.server;

			const request = new ResolvingHttpRequest(`${started.url}/start`, HttpMethod.POST, undefined, 'body');
			const response: http.IncomingMessage = await run(request);
			response.destroy();

			assert.equal(targetMethod, 'GET');
		});

		it('preserves the method on a 307 follow-up', async () => {
			let targetMethod: string | undefined;
			const started = await TestHelper.startLoopbackServer((req, res) => {
				if (req.url === '/start') {
					res.writeHead(307, { location: `http://${req.headers.host}/target` });
					res.end();
				}
				else {
					targetMethod = req.method;
					res.writeHead(200, { 'content-length': '4' });
					res.end('done');
				}
			});
			server = started.server;

			const request = new ResolvingHttpRequest(`${started.url}/start`, HttpMethod.POST, undefined, 'body');
			const response: http.IncomingMessage = await run(request);
			response.destroy();

			assert.equal(targetMethod, 'POST');
		});

		it('rejects after exceeding maxRedirects', async () => {
			const started = await TestHelper.startLoopbackServer((req, res) => {
				res.writeHead(302, { location: `http://${req.headers.host}/next` });
				res.end();
			});
			server = started.server;

			const request = new ResolvingHttpRequest(`${started.url}/start`, HttpMethod.GET);
			request.maxRedirects = 2;

			await assert.rejects(run(request), /Too many redirects\./);
		});

		it('resolves a relative Location against the current URL [#5]', async () => {
			const started = await TestHelper.startLoopbackServer((req, res) => {
				if (req.url === '/start') {
					res.writeHead(302, { location: '/relative-target' });
					res.end();
				}
				else {
					res.writeHead(200, { 'content-length': '2' });
					res.end('ok');
				}
			});
			server = started.server;

			const request = new ResolvingHttpRequest(`${started.url}/start`, HttpMethod.GET);
			const response: http.IncomingMessage = await run(request);
			response.destroy();

			assert.equal(response.statusCode, 200);
		});

		it('errors on a redirect without a Location header', async () => {
			const started = await TestHelper.startLoopbackServer((_req, res) => {
				res.writeHead(301);
				res.end();
			});
			server = started.server;

			const request = new ResolvingHttpRequest(`${started.url}/start`, HttpMethod.GET);

			await assert.rejects(run(request), /Missing Location header on redirect\./);
		});

		it('resolves a chunked 200 that omits content-length', async () => {
			// Given a server that replies 200 with a chunked body and no content-length
			const started = await TestHelper.startLoopbackServer((_req, res) => {
				res.writeHead(200, { 'content-type': 'text/plain' });
				res.write('hello ');
				res.end('world');
			});
			server = started.server;

			// When the request is resolved
			const request = new ResolvingHttpRequest(`${started.url}/`, HttpMethod.GET);
			const response: http.IncomingMessage = await run(request);

			// Then it resolves successfully, delivers the body, and reports an unknown (0) total size
			assert.equal(response.statusCode, 200);
			assert.equal(await TestHelper.readBody(response), 'hello world');
			assert.equal(request.totalBytes, 0);
		});
	});
});
