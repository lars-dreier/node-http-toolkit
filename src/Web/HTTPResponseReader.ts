import * as http from 'http';
import * as zlib from 'zlib';

export default class HTTPResponseReader {

	private _bufferBuilder: Buffer[] = [];
	private _hasError: boolean = false;

	public readData(response: http.IncomingMessage): Promise<string> {

		return new Promise<string>((success, error) => {

			response.on('close', () => {

				if (this._hasError) {
					return;
				}

				const buffer: Buffer = Buffer.concat(this._bufferBuilder);
				const decomp: string = this.decompressData(response, buffer);
				success(decomp);
			});

			response.on('data', (data: unknown) => {
				if (data instanceof Buffer) {
					this._bufferBuilder.push(data);
				}
				else {
					this._hasError = true;
					error(new Error('Response is not a buffer.'))
				}
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

		return this.decompressBuffer(buffer, compressions);
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