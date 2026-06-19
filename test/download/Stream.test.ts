import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import Stream from '../../src/download/Stream.ts';
import FakeHttpDownload from './FakeHttpDownload.ts';

describe('Stream', () => {
	let download: FakeHttpDownload;

	beforeEach(() => {
		download = new FakeHttpDownload();
	});

	it('computes totalBytes from the inclusive byte range', () => {
		// Given a range of 100..199
		const stream = new Stream(download, 0, 100, 199);
		// Then the size is end - start + 1
		assert.equal(stream.totalBytes, 100);
	});

	it('computes totalBytes as 1 for a single-byte range', () => {
		// Given a one-byte range
		const stream = new Stream(download, 0, 5, 5);
		// Then the size is 1
		assert.equal(stream.totalBytes, 1);
	});

	describe('isPaused', () => {
		it('is false when resumeAt is 0', () => {
			const stream = new Stream(download, 0, 0, 9);
			assert.equal(stream.isPaused, false);
		});

		it('is true when resumeAt is greater than 0', () => {
			const stream = new Stream(download, 0, 0, 9);
			stream.resumeAt = 123;
			assert.equal(stream.isPaused, true);
		});
	});

	describe('delegation to the underlying download', () => {
		it('delegates isDownloading', () => {
			const stream = new Stream(download, 0, 0, 9);
			assert.equal(stream.isDownloading, false);
			download.isDownloading = true;
			assert.equal(stream.isDownloading, true);
		});

		it('delegates isComplete', () => {
			const stream = new Stream(download, 0, 0, 9);
			download.isComplete = true;
			assert.equal(stream.isComplete, true);
		});

		it('delegates targetPath', () => {
			download.targetPath = '/tmp/segment-0';
			const stream = new Stream(download, 0, 0, 9);
			assert.equal(stream.targetPath, '/tmp/segment-0');
		});

		it('delegates downloadedBytes', () => {
			download.downloadedBytes = 42;
			const stream = new Stream(download, 0, 0, 9);
			assert.equal(stream.downloadedBytes, 42);
		});
	});

	it('exposes its constructor arguments', () => {
		// Given a stream built from index and range
		const stream = new Stream(download, 3, 300, 399);
		// Then the segment metadata is readable
		assert.equal(stream.index, 3);
		assert.equal(stream.start, 300);
		assert.equal(stream.end, 399);
		assert.equal(stream.download, download);
	});
});
