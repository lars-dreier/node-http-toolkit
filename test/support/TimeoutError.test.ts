import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import TimeoutError from '../../src/support/TimeoutError.ts';

describe('TimeoutError', () => {
	it('carries the fixed timeout message', () => {
		// Given a timeout error
		const error = new TimeoutError();
		// Then it has the standard message
		assert.equal(error.message, 'Connection timeout');
	});

	it('is an instance of Error and TimeoutError', () => {
		// Given a timeout error
		const error = new TimeoutError();
		assert.ok(error instanceof Error);
		assert.ok(error instanceof TimeoutError);
	});

	it('sets the error name', () => {
		// Given a timeout error
		const error = new TimeoutError();
		// Then it labels itself in stack traces and logs
		assert.equal(error.name, 'TimeoutError');
	});
});
