import type * as http from 'http';

/**
 * Captures the raw body of an error response without letting the server dictate
 * how much is buffered or how long the error is held back. Reading stops at a
 * byte limit, a timeout, or a stream failure, whichever comes first, and the
 * response is always destroyed afterwards. The result may be partial and is not
 * content-decoded.
 */
export default class HttpErrorBodyReader {
	private static readonly DEFAULT_MAX_BYTES: number = 64 * 1024;
	private static readonly DEFAULT_TIMEOUT: number = 5000;

	public constructor(
		private readonly _maxBytes: number = HttpErrorBodyReader.DEFAULT_MAX_BYTES,
		private readonly _timeout: number = HttpErrorBodyReader.DEFAULT_TIMEOUT,
	) {
	}

	/**
	 * Resolves with the bytes received so far and never rejects: a broken body must
	 * not replace the HTTP status as the reported failure.
	 */
	public read(response: http.IncomingMessage): Promise<Buffer> {
		return new Promise<Buffer>((resolve) => {
			const chunks: Buffer[] = [];
			let remaining: number = this._maxBytes;
			let finished: boolean = false;

			const finish = (): void => {
				if (finished) {
					return;
				}
				finished = true;
				clearTimeout(timer);
				response.destroy();
				resolve(Buffer.concat(chunks));
			};

			const timer: NodeJS.Timeout = setTimeout(finish, this._timeout);

			response.on('data', (chunk: Buffer) => {
				const kept: Buffer = chunk.subarray(0, remaining);
				chunks.push(kept);
				remaining -= kept.length;
				if (remaining === 0) {
					finish();
				}
			});
			response.on('end', finish);
			response.on('close', finish);
			// Stays attached after finishing, so a late socket error cannot go unhandled.
			response.on('error', finish);
		});
	}
}
