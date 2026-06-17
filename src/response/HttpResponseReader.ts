import * as http from 'http';
import * as zlib from 'zlib';

/**
 * Buffers a response body to completion and decodes it to a string, transparently
 * reversing br, gzip and deflate content-encodings, including chained encodings
 * applied in sequence.
 */
export default class HttpResponseReader {
	private _bufferBuilder: Buffer[] = [];
	private _hasError: boolean = false;

	public readData(response: http.IncomingMessage): Promise<string> {
		return new Promise<string>((success, error) => {
			let ended: boolean = false;

			const fail = (reason: Error): void => {
				this._hasError = true;
				error(reason);
			};

			response.on('data', (data: unknown) => {
				if (this._hasError) {
					return;
				}
				if (data instanceof Buffer) {
					this._bufferBuilder.push(data);
				}
				else {
					fail(new Error('Response is not a buffer.'));
				}
			});

			response.on('end', () => {
				if (this._hasError) {
					return;
				}
				ended = true;
				const buffer: Buffer = Buffer.concat(this._bufferBuilder);
				try {
					success(this.decompressData(response, buffer));
				}
				catch (reason: unknown) {
					fail(reason instanceof Error ? reason : new Error(String(reason)));
				}
			});

			response.on('close', () => {
				if (this._hasError || ended) {
					return;
				}
				fail(new Error('Response closed before completion.'));
			});

			response.on('error', (reason: Error) => {
				if (this._hasError) {
					return;
				}
				fail(reason);
			});
		});
	}

	private decompressData(response: http.IncomingMessage, data: Buffer): string {
		const encodingHeader = response.headers['content-encoding'];

		if (encodingHeader == null) {
			return data.toString();
		}

		const compressions: string[] = encodingHeader.split(',');

		const dec: Buffer = this.decompressBuffer(data, compressions);
		return dec.toString();
	}

	private decompressBuffer(buffer: Buffer, compressions: string[]): Buffer {
		const compression: string | undefined = compressions.pop();
		const decompressed: Buffer = this.descompressBufferOnce(buffer, compression);

		if (compressions.length == 0) {
			return decompressed;
		}

		return this.decompressBuffer(decompressed, compressions);
	}

	private descompressBufferOnce(buffer: Buffer, compression: string | undefined): Buffer {
		if (compression == null) {
			console.warn('No compression set.');
			return buffer;
		}

		compression = compression.toLowerCase().trim();

		switch (compression) {
			case 'br':
				return zlib.brotliDecompressSync(buffer);
			case 'gzip':
				return zlib.gunzipSync(buffer);
			case 'deflate':
				return zlib.inflateSync(buffer);
		}

		throw new Error(`Unknown compression: ${compression}.`);
	}
}
