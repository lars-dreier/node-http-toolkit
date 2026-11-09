import type * as http from 'http';

/**
 * Error carrying an HTTP status code and status message, raised when a response
 * indicates failure. When built from a response it also carries the headers and
 * the raw body, which is capped in size, may be partial, and is not
 * content-decoded.
 */
export default class HttpError extends Error {
	public constructor(
		public readonly statusCode: number,
		public readonly statusMessage: string,
		public readonly headers?: http.IncomingHttpHeaders,
		public readonly body?: Buffer,
	) {
		super(`HTTP Error ${statusCode}: ${statusMessage}`);
		this.name = 'HttpError';
	}
}
