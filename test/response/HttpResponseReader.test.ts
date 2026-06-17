import assert from 'node:assert/strict';
import type * as http from 'node:http';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';
import * as zlib from 'node:zlib';

import HttpResponseReader from '../../src/response/HttpResponseReader.ts';
import TestHelper from '../TestHelper.ts';

describe('HttpResponseReader', () => {
	let reader: HttpResponseReader;
	let body: PassThrough;

	beforeEach(() => {
		reader = new HttpResponseReader();
		body = new PassThrough();
	});

	it('reads an unencoded body as a string', async () => {
		// Given a response with no content-encoding
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {});
		// When the body is streamed to completion
		const promise: Promise<string> = reader.readData(response);
		body.end(Buffer.from('plain text'));
		// Then the raw bytes are returned as a string
		assert.equal(await promise, 'plain text');
	});

	it('decodes a gzip-encoded body', async () => {
		// Given a gzip-compressed body
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {
			'content-encoding': 'gzip'
		});
		// When read
		const promise: Promise<string> = reader.readData(response);
		body.end(zlib.gzipSync(Buffer.from('hello gzip')));
		// Then it is inflated
		assert.equal(await promise, 'hello gzip');
	});

	it('decodes a deflate-encoded body', async () => {
		// Given a deflate-compressed body
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {
			'content-encoding': 'deflate'
		});
		// When read
		const promise: Promise<string> = reader.readData(response);
		body.end(zlib.deflateSync(Buffer.from('hello deflate')));
		// Then it is inflated
		assert.equal(await promise, 'hello deflate');
	});

	it('decodes a br-encoded body', async () => {
		// Given a brotli-compressed body
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {
			'content-encoding': 'br'
		});
		// When read
		const promise: Promise<string> = reader.readData(response);
		body.end(zlib.brotliCompressSync(Buffer.from('hello brotli')));
		// Then it is inflated
		assert.equal(await promise, 'hello brotli');
	});

	it('decodes a chained "gzip, br" body [#1]', async () => {
		// Given a body encoded gzip-then-br (br is the outermost layer)
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {
			'content-encoding': 'gzip, br'
		});
		// When read
		const promise: Promise<string> = reader.readData(response);
		body.end(zlib.brotliCompressSync(zlib.gzipSync(Buffer.from('chained'))));
		// Then each layer is peeled in reverse order off the decompressed bytes
		assert.equal(await promise, 'chained');
	});

	it('rejects an unknown content-encoding', async () => {
		// Given an encoding the decoder does not support
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {
			'content-encoding': 'snappy'
		});
		// When read
		const promise: Promise<string> = reader.readData(response);
		body.end(Buffer.from('whatever'));
		// Then the promise rejects rather than throwing uncaught
		await assert.rejects(promise, /Unknown compression: snappy\./);
	});

	it('rejects a non-Buffer data chunk', async () => {
		// Given a data event carrying a non-Buffer chunk
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {});
		const promise: Promise<string> = reader.readData(response);
		// When the chunk is delivered
		response.emit('data', 'not a buffer');
		// Then the promise rejects
		await assert.rejects(promise, /Response is not a buffer\./);
	});

	it('rejects when the stream closes before it ends [#8]', async () => {
		// Given a body that starts streaming
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {});
		const promise: Promise<string> = reader.readData(response);
		body.write(Buffer.from('partial'));
		// When the connection drops (close without end)
		body.destroy();
		// Then the truncated body is reported as an error, not resolved
		await assert.rejects(promise, /Response closed before completion\./);
	});

	it('rejects when the underlying stream errors', async () => {
		// Given a response that emits a transport error
		const response: http.IncomingMessage = TestHelper.streamResponse(body, {});
		const promise: Promise<string> = reader.readData(response);
		// When the error surfaces
		response.emit('error', new Error('socket hang up'));
		// Then it is propagated as a rejection
		await assert.rejects(promise, /socket hang up/);
	});
});
