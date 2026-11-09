import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import HttpError from '../../src/http/HttpError.ts';

describe('HttpError', () => {
	it('formats the message from the status code and message', () => {
		// Given a status code and message
		const error = new HttpError(404, 'Not Found');
		// Then the message combines them
		assert.equal(error.message, 'HTTP Error 404: Not Found');
	});

	it('exposes the status code and status message', () => {
		// Given an error
		const error = new HttpError(503, 'Service Unavailable');
		// Then the fields are readable
		assert.equal(error.statusCode, 503);
		assert.equal(error.statusMessage, 'Service Unavailable');
	});

	it('handles an empty status message', () => {
		// Given no status message text
		const error = new HttpError(500, '');
		// Then the message still formats with a trailing separator
		assert.equal(error.message, 'HTTP Error 500: ');
	});

	it('is an instance of Error and HttpError', () => {
		// Given an error (the MultiStream fatal-error check relies on this)
		const error = new HttpError(400, 'Bad Request');
		assert.ok(error instanceof Error);
		assert.ok(error instanceof HttpError);
	});

	it('sets the error name', () => {
		// Given an error
		const error = new HttpError(400, 'Bad Request');
		// Then it labels itself in stack traces and logs
		assert.equal(error.name, 'HttpError');
	});

	it('exposes the response headers and body when provided', () => {
		// Given an error built with the response details
		const body: Buffer = Buffer.from('{"reason":"denied"}');
		const error = new HttpError(403, 'Forbidden', { 'retry-after': '30' }, body);
		// Then they are readable
		assert.deepEqual(error.headers, { 'retry-after': '30' });
		assert.equal(error.body, body);
	});

	it('leaves the headers and body undefined when omitted', () => {
		// Given an error built from status alone
		const error = new HttpError(403, 'Forbidden');
		// Then the response details are absent
		assert.equal(error.headers, undefined);
		assert.equal(error.body, undefined);
	});
});
