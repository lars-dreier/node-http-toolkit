import assert from 'node:assert/strict';
import type * as http from 'node:http';
import { afterEach, describe, it } from 'node:test';

import { HttpMethod } from '../../src/http/HttpMethod.ts';
import HttpRequest from '../../src/request/HttpRequest.ts';
import TestHelper from '../TestHelper.ts';

describe('HttpRequest', () => {
	let server: http.Server | undefined;

	afterEach(async () => {
		if (server === undefined) {
			return;
		}
		const running: http.Server = server;
		server = undefined;
		await new Promise<void>((resolve) => running.close(() => resolve()));
	});

	it('issues a GET and resolves with the raw response on the ephemeral port [#4]', async () => {
		// Given a loopback server on a non-default port
		let hit: boolean = false;
		const started = await TestHelper.startLoopbackServer((_req, res) => {
			hit = true;
			res.writeHead(200, { 'content-type': 'text/plain' });
			res.end('hello');
		});
		server = started.server;

		// When a GET is issued to that port
		const request = new HttpRequest(started.url, HttpMethod.GET);
		const response: http.IncomingMessage = await request.send();

		// Then the request reaches the port and the raw body comes back
		assert.equal(hit, true);
		assert.equal(response.statusCode, 200);
		assert.equal(await TestHelper.readBody(response), 'hello');
	});

	it('sends a POST body that the server receives', async () => {
		// Given a server echoing what it reads
		let received: string | undefined;
		const started = await TestHelper.startLoopbackServer((req, res) => {
			void TestHelper.readBody(req).then((body) => {
				received = body;
				res.writeHead(200);
				res.end('ok');
			});
		});
		server = started.server;

		// When a POST carries a body
		const request = new HttpRequest(started.url, HttpMethod.POST, { 'content-type': 'text/plain' }, 'payload');
		const response: http.IncomingMessage = await request.send();

		// Then the server received the body and we get the response
		assert.equal(received, 'payload');
		assert.equal(response.statusCode, 200);
		assert.equal(await TestHelper.readBody(response), 'ok');
	});

	it('flushes a PUT request with a body instead of hanging [#6]', async () => {
		// Given a server reading the request body
		let received: string | undefined;
		const started = await TestHelper.startLoopbackServer((req, res) => {
			void TestHelper.readBody(req).then((body) => {
				received = body;
				res.writeHead(200);
				res.end();
			});
		});
		server = started.server;

		// When a PUT is issued
		const request = new HttpRequest(started.url, HttpMethod.PUT, undefined, 'put-body');
		const response: http.IncomingMessage = await request.send();

		// Then it is flushed and resolves rather than hanging
		assert.equal(response.statusCode, 200);
		assert.equal(received, 'put-body');
	});

	it('flushes a DELETE request with no body instead of hanging [#6]', async () => {
		// Given a server that records the method
		let method: string | undefined;
		const started = await TestHelper.startLoopbackServer((req, res) => {
			method = req.method;
			res.writeHead(204);
			res.end();
		});
		server = started.server;

		// When a DELETE is issued
		const request = new HttpRequest(started.url, HttpMethod.DELETE);
		const response: http.IncomingMessage = await request.send();

		// Then it is flushed and resolves
		assert.equal(response.statusCode, 204);
		assert.equal(method, 'DELETE');
	});

	it('preserves header insertion order on the wire', async () => {
		// Given a server capturing the raw header block
		let rawHeaders: string[] = [];
		const started = await TestHelper.startLoopbackServer((req, res) => {
			rawHeaders = req.rawHeaders;
			res.writeHead(200);
			res.end();
		});
		server = started.server;

		// When headers are supplied in a specific order
		const headers: http.OutgoingHttpHeaders = { 'X-First': '1', 'X-Second': '2', 'X-Third': '3' };
		const request = new HttpRequest(started.url, HttpMethod.GET, headers);
		await request.send();

		// Then they arrive in that exact order
		const sentKeys: string[] = rawHeaders.filter((_value, index) => index % 2 === 0);
		const customOrder: string[] = sentKeys.filter((key) => key.startsWith('X-'));
		assert.deepEqual(customOrder, ['X-First', 'X-Second', 'X-Third']);
	});

	it('rejects an unsupported protocol', async () => {
		// Given a non-HTTP(S) URL
		const request = new HttpRequest('ftp://example.com/', HttpMethod.GET);
		// When sent
		// Then it rejects without a network attempt
		await assert.rejects(request.send(), /Unsupported protocol: ftp:/);
	});

	it('rejects when the transport errors', async () => {
		// Given a port with nothing listening
		const request = new HttpRequest('http://127.0.0.1:1/', HttpMethod.GET);
		// When sent
		// Then the connection error surfaces as a rejection
		await assert.rejects(request.send());
	});
});
