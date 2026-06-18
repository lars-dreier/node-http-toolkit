import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
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
		return { statusCode, headers, destroy: () => {} } as unknown as http.IncomingMessage;
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

	/**
	 * Starts a loopback HTTP server on an ephemeral port and resolves with the
	 * server and its base URL. Close the server in an afterEach hook.
	 */
	public static startLoopbackServer(
		handler: http.RequestListener,
	): Promise<{ server: http.Server; url: string }> {
		const server: http.Server = http.createServer(handler);
		return new Promise((resolve) => {
			server.listen(0, '127.0.0.1', () => {
				const address = server.address() as AddressInfo;
				resolve({ server, url: `http://127.0.0.1:${address.port}` });
			});
		});
	}

	/**
	 * Collects a response (or request) body stream to completion as a string.
	 */
	public static readBody(message: http.IncomingMessage): Promise<string> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			message.on('data', (chunk: Buffer) => chunks.push(chunk));
			message.on('end', () => resolve(Buffer.concat(chunks).toString()));
			message.on('error', reject);
		});
	}
}
