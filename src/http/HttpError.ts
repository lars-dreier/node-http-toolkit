/**
 * Error carrying an HTTP status code and status message, raised when a response
 * indicates failure.
 */
export default class HttpError extends Error {
	public constructor(
		public readonly statusCode: number,
		public readonly statusMessage: string,
	) {
		super(`HTTP Error ${statusCode}: ${statusMessage}`);
		this.name = 'HttpError';
	}
}
