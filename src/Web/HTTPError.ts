export default class HTTPError extends Error {
	public constructor(public readonly statusCode: number) {
		super(`HTTP Error (Code ${statusCode})`);
	}
}