import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type * as http from 'node:http';

import HttpHeaderUtil from '../../src/http/HttpHeaderUtil.ts';

describe('HttpHeaderUtil', () => {
	describe('getHeader', () => {
		it('returns the value on an exact-case match', () => {
			// Given a header stored under the queried casing
			const headers: http.OutgoingHttpHeaders = { 'Content-Type': 'text/html' };
			// When/Then the exact key resolves
			assert.equal(HttpHeaderUtil.getHeader(headers, 'Content-Type'), 'text/html');
		});

		it('falls back to the lower-cased key when no exact match exists', () => {
			// Given a header stored lower-cased (as Node delivers incoming headers)
			const headers: http.OutgoingHttpHeaders = { 'content-type': 'text/html' };
			// When queried with a different casing
			// Then the lower-case fallback resolves it
			assert.equal(HttpHeaderUtil.getHeader(headers, 'Content-Type'), 'text/html');
		});

		it('prefers an exact-case match over a lower-cased duplicate', () => {
			// Given both an exact and a lower-cased entry
			const headers: http.OutgoingHttpHeaders = {
				'Content-Type': 'exact',
				'content-type': 'lower',
			};
			// When/Then the exact match wins via the `??` precedence
			assert.equal(HttpHeaderUtil.getHeader(headers, 'Content-Type'), 'exact');
		});

		it('returns undefined when the header is absent', () => {
			// Given no matching header
			// When/Then the result is undefined
			assert.equal(HttpHeaderUtil.getHeader({}, 'X-Missing'), undefined);
		});
	});

	describe('setHeader', () => {
		it('adds a header when none exists', () => {
			// Given an empty header bag
			const headers: http.OutgoingHttpHeaders = {};
			// When a header is set
			HttpHeaderUtil.setHeader(headers, 'Accept', 'application/json');
			// Then it is present
			assert.equal(headers['Accept'], 'application/json');
		});

		it('replaces a differently-cased duplicate instead of keeping both', () => {
			// Given a lower-cased entry already present
			const headers: http.OutgoingHttpHeaders = { 'content-type': 'text/plain' };
			// When set under a different casing
			HttpHeaderUtil.setHeader(headers, 'Content-Type', 'text/html');
			// Then the old casing is gone and only the new value remains
			assert.equal(headers['Content-Type'], 'text/html');
			assert.equal(headers['content-type'], undefined);
			assert.equal(HttpHeaderUtil.getHeader(headers, 'Content-Type'), 'text/html');
		});
	});

	describe('removeHeader', () => {
		it('clears both the given casing and the lower-cased form', () => {
			// Given an exact and a lower-cased duplicate
			const headers: http.OutgoingHttpHeaders = { 'Content-Type': 'a', 'content-type': 'b' };
			// When removed by the exact casing
			HttpHeaderUtil.removeHeader(headers, 'Content-Type');
			// Then both casings are cleared
			assert.equal(headers['Content-Type'], undefined);
			assert.equal(headers['content-type'], undefined);
		});

		it('removes a lower-cased header when given a differently-cased key', () => {
			// Given a lower-cased entry
			const headers: http.OutgoingHttpHeaders = { 'content-type': 'a' };
			// When removed via a different casing
			HttpHeaderUtil.removeHeader(headers, 'Content-Type');
			// Then it is gone
			assert.equal(HttpHeaderUtil.getHeader(headers, 'content-type'), undefined);
		});
	});

	describe('mergeHeaders', () => {
		it('overwrites an existing header with the incoming value', () => {
			// Given an existing header
			const headers: http.IncomingHttpHeaders = { accept: 'text/plain' };
			// When merged with a new value for the same key
			HttpHeaderUtil.mergeHeaders(headers, { accept: 'application/json' });
			// Then the incoming value wins
			assert.equal(headers['accept'], 'application/json');
		});

		it('adds headers that do not yet exist and keeps untouched ones', () => {
			// Given one existing header
			const headers: http.IncomingHttpHeaders = { accept: 'text/plain' };
			// When merged with an additional header
			HttpHeaderUtil.mergeHeaders(headers, { 'x-custom': 'value' });
			// Then the original is retained and the new one is added
			assert.equal(headers['accept'], 'text/plain');
			assert.equal(headers['x-custom'], 'value');
		});

		it('skips incoming headers whose value is undefined', () => {
			// Given an empty bag and an incoming undefined value
			const headers: http.IncomingHttpHeaders = {};
			// When merged
			HttpHeaderUtil.mergeHeaders(headers, { 'x-empty': undefined });
			// Then nothing is added
			assert.ok(!('x-empty' in headers));
		});
	});

	describe('normalizeHeaders', () => {
		it('lower-cases every key while preserving values', () => {
			// Given mixed-case keys
			const headers: http.IncomingHttpHeaders = { 'Content-Type': 'text/html', 'X-Custom': 'v' };
			// When normalized
			const normalized: http.IncomingHttpHeaders = HttpHeaderUtil.normalizeHeaders(headers);
			// Then all keys are lower-cased and values preserved
			assert.deepEqual(normalized, { 'content-type': 'text/html', 'x-custom': 'v' });
		});

		it('returns a new object without mutating the input', () => {
			// Given a header bag
			const headers: http.IncomingHttpHeaders = { 'Content-Type': 'text/html' };
			// When normalized
			const normalized: http.IncomingHttpHeaders = HttpHeaderUtil.normalizeHeaders(headers);
			// Then a distinct object is returned and the input is untouched
			assert.notEqual(normalized, headers);
			assert.deepEqual(headers, { 'Content-Type': 'text/html' });
		});
	});
});
