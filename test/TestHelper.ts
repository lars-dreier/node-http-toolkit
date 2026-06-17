import type * as http from 'node:http';

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
}
