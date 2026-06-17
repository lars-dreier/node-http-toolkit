import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import HttpFormatter from '../../src/support/HttpFormatter.ts';

describe('HttpFormatter', () => {
	describe('formatBytes', () => {
		it('returns "0 Bytes" for zero', () => {
			// Given a byte count of zero
			// When formatted
			// Then the dedicated zero branch returns the fixed string
			assert.equal(HttpFormatter.formatBytes(0), '0 Bytes');
		});

		it('formats a sub-KB value in Bytes', () => {
			// Given a value below 1024
			// When formatted
			// Then the unit stays Bytes (index 0)
			assert.equal(HttpFormatter.formatBytes(500), '500.00 Bytes');
		});

		it('keeps Bytes at the upper edge of the range (1023)', () => {
			// Given the largest value still below the KB boundary
			// When formatted
			// Then it does not roll over to KB
			assert.equal(HttpFormatter.formatBytes(1023), '1023.00 Bytes');
		});

		it('formats the exact KB boundary', () => {
			// Given exactly 1024 bytes
			// When formatted
			// Then it rolls over to 1.00 KB
			assert.equal(HttpFormatter.formatBytes(1024), '1.00 KB');
		});

		it('formats a fractional KB value', () => {
			// Given 1.5 KB
			// When formatted
			// Then the fraction is rounded to two decimals
			assert.equal(HttpFormatter.formatBytes(1536), '1.50 KB');
		});

		it('formats the exact MB boundary', () => {
			// Given exactly 1024^2 bytes
			// When formatted
			// Then it reports 1.00 MB
			assert.equal(HttpFormatter.formatBytes(1024 ** 2), '1.00 MB');
		});

		it('formats the exact GB boundary', () => {
			// Given exactly 1024^3 bytes
			// When formatted
			// Then it reports 1.00 GB
			assert.equal(HttpFormatter.formatBytes(1024 ** 3), '1.00 GB');
		});

		it('formats the exact TB boundary (last named unit)', () => {
			// Given exactly 1024^4 bytes
			// When formatted
			// Then it reports 1.00 TB, the final entry in SIZES
			assert.equal(HttpFormatter.formatBytes(1024 ** 4), '1.00 TB');
		});

		it('clamps to the last named unit (TB) beyond the SIZES range', () => {
			// Given a value in the petabyte range (exponent 5, past SIZES)
			// When formatted
			// Then the exponent is clamped to TB rather than emitting an empty unit
			assert.equal(HttpFormatter.formatBytes(1024 ** 5), '1024.00 TB');
		});

		it('treats negative input as zero', () => {
			// Given a negative byte count
			// When formatted
			// Then it folds into the zero branch instead of producing NaN
			assert.equal(HttpFormatter.formatBytes(-1024), '0 Bytes');
		});
	});
});
