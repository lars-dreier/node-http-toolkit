import assert from 'node:assert/strict';
import type * as http from 'node:http';
import { afterEach, describe, it } from 'node:test';

import HttpError from '../../src/http/HttpError.ts';
import { HttpMethod } from '../../src/http/HttpMethod.ts';
import AsyncResolvingHttpRequest from '../../src/request/AsyncResolvingHttpRequest.ts';
import TestHelper from '../TestHelper.ts';

describe('AsyncResolvingHttpRequest', () => {
	let server: http.Server | undefined;

	afterEach(async () => {
		if (server === undefined) {
			return;
		}
		const running: http.Server = server;
		server = undefined;
		await new Promise<void>((resolve) => running.close(() => resolve()));
	});

	it('resolves with the inner response', async () => {
		// Given a server returning a complete body
		const started = await TestHelper.startLoopbackServer((_req, res) => {
			res.writeHead(200, { 'content-length': '5' });
			res.end('hello');
		});
		server = started.server;

		// When resolved
		const request = new AsyncResolvingHttpRequest(started.url, HttpMethod.GET);
		const response: http.IncomingMessage = await request.resolve();
		response.destroy();

		// Then the promise yields the response
		assert.equal(response.statusCode, 200);
	});

	it('rejects mirroring the inner request error', async () => {
		// Given a server returning a 4xx
		const started = await TestHelper.startLoopbackServer((_req, res) => {
			res.writeHead(404);
			res.end();
		});
		server = started.server;

		// When resolved
		const request = new AsyncResolvingHttpRequest(started.url, HttpMethod.GET);

		// Then it rejects with the inner HttpError
		await assert.rejects(request.resolve(), (error: unknown) => {
			assert.ok(error instanceof HttpError);
			assert.equal(error.statusCode, 404);
			return true;
		});
	});

	it('exposes total and requested byte counts after resolution', async () => {
		// Given a partial-content response
		const started = await TestHelper.startLoopbackServer((_req, res) => {
			res.writeHead(206, { 'content-length': '500', 'content-range': 'bytes 0-499/1234' });
			res.end(Buffer.alloc(500));
		});
		server = started.server;

		// When resolved
		const request = new AsyncResolvingHttpRequest(started.url, HttpMethod.GET);
		const response: http.IncomingMessage = await request.resolve();
		response.destroy();

		// Then the byte counts from the inner request are exposed
		assert.equal(request.totalBytes, 1234);
		assert.equal(request.requestedBytes, 500);
	});

	it('forwards maxRedirects to the inner request [#9]', async () => {
		// Given a server that always redirects
		let hits: number = 0;
		const started = await TestHelper.startLoopbackServer((req, res) => {
			hits++;
			res.writeHead(302, { location: `http://${req.headers.host}/next` });
			res.end();
		});
		server = started.server;

		// When a low redirect cap is set on the wrapper
		const request = new AsyncResolvingHttpRequest(`${started.url}/start`, HttpMethod.GET);
		request.maxRedirects = 1;

		// Then the cap is honoured: one redirect is followed before giving up
		await assert.rejects(request.resolve(), /Too many redirects\./);
		assert.equal(hits, 2);
	});
});
