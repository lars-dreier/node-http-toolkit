import assert from 'node:assert/strict';
import type * as http from 'node:http';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import HttpErrorBodyReader from '../../src/response/HttpErrorBodyReader.ts';
import TestHelper from '../TestHelper.ts';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('HttpErrorBodyReader', () => {
	let body: PassThrough;
	let response: http.IncomingMessage;

	beforeEach(() => {
		body = new PassThrough();
		response = TestHelper.streamResponse(body);
	});

	describe('read', () => {
		it('collects a body that ends within the limit', async () => {
			// Given a reader and a response that ends below the limit
			const pending: Promise<Buffer> = new HttpErrorBodyReader(1024, 1000).read(response);
			// When the body completes
			body.write('hello ');
			body.end('world');
			// Then the whole body is returned
			assert.equal((await pending).toString(), 'hello world');
		});

		it('returns an empty buffer for an empty body', async () => {
			// Given a reader and a response with no body
			const pending: Promise<Buffer> = new HttpErrorBodyReader(1024, 1000).read(response);
			// When the response ends immediately
			body.end();
			// Then the result is empty
			assert.equal((await pending).length, 0);
		});

		it('truncates a single oversized chunk at the limit and destroys the response', async () => {
			// Given a reader limited to 4 bytes
			const pending: Promise<Buffer> = new HttpErrorBodyReader(4, 1000).read(response);
			// When one larger chunk arrives
			body.write('abcdef');
			// Then only the limit is kept and the stream is torn down
			assert.equal((await pending).toString(), 'abcd');
			assert.equal(body.destroyed, true);
		});

		it('truncates across chunks at the limit', async () => {
			// Given a reader limited to 4 bytes
			const pending: Promise<Buffer> = new HttpErrorBodyReader(4, 1000).read(response);
			// When the limit is crossed by a later chunk
			body.write('abc');
			await delay(5);
			body.write('def');
			// Then exactly the limit is kept
			assert.equal((await pending).toString(), 'abcd');
		});

		it('resolves with the received bytes when the timeout expires and destroys the response', async () => {
			// Given a reader with a short timeout
			const pending: Promise<Buffer> = new HttpErrorBodyReader(1024, 20).read(response);
			// When the body stalls after a partial write
			body.write('par');
			// Then the partial body is returned and the stream is torn down
			assert.equal((await pending).toString(), 'par');
			assert.equal(body.destroyed, true);
		});

		it('resolves with the received bytes when the stream errors', async () => {
			// Given a body that has started arriving
			const pending: Promise<Buffer> = new HttpErrorBodyReader(1024, 1000).read(response);
			body.write('par');
			await delay(5);
			// When the stream fails
			body.destroy(new Error('socket hang up'));
			// Then the read still succeeds, because the status is what the caller must learn
			assert.equal((await pending).toString(), 'par');
		});

		it('resolves with the received bytes when the stream closes without ending', async () => {
			// Given a body that has started arriving
			const pending: Promise<Buffer> = new HttpErrorBodyReader(1024, 1000).read(response);
			body.write('par');
			await delay(5);
			// When the stream closes early
			body.destroy();
			// Then the partial body is returned
			assert.equal((await pending).toString(), 'par');
		});
	});
});
