import type * as http from 'node:http';
import type { PassThrough } from 'node:stream';

/**
 * Shared builders and fixtures for the test suite.
 */
export default class TestHelper {
	/**
	 * Builds a minimal IncomingMessage carrying only a status code and headers,
	 * sufficient for code paths that read nothing else off the response.
	 */
	public static stubResponse(
		statusCode: number | undefined,
		headers: http.IncomingHttpHeaders = {},
	): http.IncomingMessage {
		return { statusCode, headers } as unknown as http.IncomingMessage;
	}

	/**
	 * Adorns a writable stream with response headers so it can stand in for a
	 * streamed IncomingMessage. Drive the body through the same PassThrough.
	 */
	public static streamResponse(
		body: PassThrough,
		headers: http.IncomingHttpHeaders = {},
	): http.IncomingMessage {
		return Object.assign(body, { headers }) as unknown as http.IncomingMessage;
	}
}
