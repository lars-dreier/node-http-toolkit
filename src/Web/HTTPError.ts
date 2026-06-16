export default class HTTPError extends Error {
	public constructor(
		public readonly statusCode: number,
		public readonly statusMessage: string
	) {
		super(`HTTP Error ${statusCode}: ${statusMessage}`);
	}
}
