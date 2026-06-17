import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import HttpResponseSize from '../../src/response/HttpResponseSize.ts';
import TestHelper from '../TestHelper.ts';

describe('HttpResponseSize', () => {
	describe('parse — complete content (200)', () => {
		it('derives size fields from content-length', () => {
			// Given a 200 response advertising a content-length
			const response = TestHelper.stubResponse(200, { 'content-length': '1000' });
			// When parsed
			const size: HttpResponseSize = HttpResponseSize.parse(response);
			// Then the whole body spans 0..length-1 and totals the content-length
			assert.deepEqual(size, new HttpResponseSize(1000, 1000, 0, 999));
		});

		it('throws when content-length is missing', () => {
			// Given a 200 response without content-length (e.g. chunked transfer)
			const response = TestHelper.stubResponse(200, {});
			// When parsed
			// Then it rejects — the size cannot be determined
			assert.throws(() => HttpResponseSize.parse(response), /Missing content length header\./);
		});
	});

	describe('parse — partial content (206)', () => {
		it('parses content-range into start, end and total', () => {
			// Given a 206 response with a matching range and content-length
			const response = TestHelper.stubResponse(206, {
				'content-length': '500',
				'content-range': 'bytes 0-499/1234'
			});
			// When parsed
			const size: HttpResponseSize = HttpResponseSize.parse(response);
			// Then total comes from the range and the segment bounds are exposed
			assert.deepEqual(size, new HttpResponseSize(1234, 500, 0, 499));
		});

		it('throws when content-length is missing', () => {
			// Given a 206 response with a range but no content-length
			const response = TestHelper.stubResponse(206, { 'content-range': 'bytes 0-499/1234' });
			// When parsed
			// Then the content-length check fails first
			assert.throws(() => HttpResponseSize.parse(response), /Missing content length header\./);
		});

		it('throws when the range header is missing', () => {
			// Given a 206 response without a content-range header
			const response = TestHelper.stubResponse(206, { 'content-length': '500' });
			// When parsed
			// Then it rejects — a partial response must carry a range
			assert.throws(
				() => HttpResponseSize.parse(response),
				/Partial content without range header\./
			);
		});

		it('throws when the range header is malformed', () => {
			// Given a 206 response with an unparseable content-range
			const response = TestHelper.stubResponse(206, {
				'content-length': '500',
				'content-range': 'pages 0-499/1234'
			});
			// When parsed
			// Then the range regex fails to match
			assert.throws(() => HttpResponseSize.parse(response), /Invalid range header\./);
		});

		it('throws when the range length disagrees with content-length', () => {
			// Given a range spanning 500 bytes but a content-length of 400
			const response = TestHelper.stubResponse(206, {
				'content-length': '400',
				'content-range': 'bytes 0-499/1234'
			});
			// When parsed
			// Then the consistency check rejects the mismatch
			assert.throws(() => HttpResponseSize.parse(response), /Content length mismatch\./);
		});
	});

	describe('parse — other statuses', () => {
		it('throws on an unexpected status code', () => {
			// Given a status the parser does not handle
			const response = TestHelper.stubResponse(404, {});
			// When parsed
			// Then it rejects, naming the offending status
			assert.throws(() => HttpResponseSize.parse(response), /Unexpected status code: 404/);
		});

		it('reports "none" when the status code is undefined', () => {
			// Given a response with no status code
			const response = TestHelper.stubResponse(undefined, {});
			// When parsed
			// Then the error falls back to "none"
			assert.throws(() => HttpResponseSize.parse(response), /Unexpected status code: none/);
		});
	});
});
