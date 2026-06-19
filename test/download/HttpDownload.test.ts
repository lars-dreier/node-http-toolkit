import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import type * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import HttpDownload from '../../src/download/HttpDownload.ts';
import TestHelper from '../TestHelper.ts';

describe('HttpDownload', () => {
	let server: http.Server | undefined;
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'http-download-test-'));
	});

	afterEach(async () => {
		fs.rmSync(tempDir, { recursive: true, force: true });
		if (server === undefined) {
			return;
		}
		const running: http.Server = server;
		server = undefined;
		await new Promise<void>((resolve) => running.close(() => resolve()));
	});

	it('downloads a chunked 200 that omits content-length as a single stream', async () => {
		// Given a server that replies 200 with a chunked body and no content-length
		const started = await TestHelper.startLoopbackServer((_req, res) => {
			res.writeHead(200, { 'content-type': 'text/plain' });
			res.write('hello ');
			res.end('world');
		});
		server = started.server;

		const destination: string = path.join(tempDir, 'chunked.txt');
		const download = new HttpDownload(`${started.url}/`, destination);

		// When the download runs to completion
		await new Promise<void>((resolve, reject) => {
			download.onComplete = () => resolve();
			download.onError = (_d, error) => reject(error);
			download.start();
		});

		// Then the full body is written and the total size is reported as unknown (0)
		assert.equal(fs.readFileSync(destination, 'utf8'), 'hello world');
		assert.equal(download.totalBytes, 0);
		assert.equal(download.downloadedBytes, 11);
		assert.equal(download.isComplete, true);
	});
});
