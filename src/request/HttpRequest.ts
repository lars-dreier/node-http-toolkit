import * as http from 'http';
import * as https from 'https';
import { HttpMethod } from '../http/HttpMethod.ts';
import { HttpProtocol } from '../http/HttpProtocol.ts';

/**
 * Performs a single HTTP or HTTPS request — a GET, or any other method with an
 * optional request body — and resolves with the raw, undecoded response. Headers
 * are sent exactly as supplied, in insertion order, giving the caller full
 * control over the request line and header block.
 */
export default class HttpRequest {
	public constructor(
		private readonly _url: string,
		private readonly _method: string,
		private readonly _headers?: http.OutgoingHttpHeaders,
		private readonly _postData?: string,
	) {
	}

	public async send(): Promise<http.IncomingMessage> {
		return new Promise<http.IncomingMessage>(
			(success, error) => this.prepareRequest(success, error)
		);
	}

	private prepareRequest(
		onSuccess: (response: http.IncomingMessage) => void,
		onError: (error: Error) => void,
	): void {
		try {
			const request: http.ClientRequest = this.createRequest(
				new URL(this._url),
				this._method,
				this._headers,
				onSuccess
			);
			request.once('error', (error: Error) => {
				onError(error);
			});

			if (this._method == HttpMethod.POST) {
				request.write(this._postData);
				request.end();
			}
		}
		catch (error) {
			onError(error as Error);
		}
	}

	private createRequest(
		url: URL,
		method: string,
		headers: http.OutgoingHttpHeaders | undefined,
		onSuccess: (response: http.IncomingMessage) => void,
	): http.ClientRequest {
		const options: http.RequestOptions = this.createOptions(
			url,
			method,
			headers
		);

		if (method == HttpMethod.GET) {
			return this.createGetRequest(url, options, onSuccess);
		}
		return this.createGenericRequest(url, options, onSuccess);
	}

	private createOptions(url: URL, method: string, headers: http.OutgoingHttpHeaders | undefined): http.RequestOptions {
		return {
			hostname: url.hostname,
			path: url.pathname + url.search,
			method: method,
			headers: headers
		};
	}

	private createGetRequest(
		url: URL,
		options: http.RequestOptions,
		onSuccess: (response: http.IncomingMessage) => void,
	): http.ClientRequest {
		const protocol: string = url.protocol;
		if (protocol == HttpProtocol.Https) {
			return https.get(
				options,
				(response: http.IncomingMessage) => onSuccess(response)
			);
		}
		else if (protocol == HttpProtocol.Http) {
			return http.get(
				options,
				(response: http.IncomingMessage) => onSuccess(response)
			);
		}
		throw new Error(`Unsupported protocol: ${protocol}`);
	}

	private createGenericRequest(
		url: URL,
		options: http.RequestOptions,
		onSuccess: (response: http.IncomingMessage) => void,
	): http.ClientRequest {
		const protocol: string = url.protocol;
		if (protocol == HttpProtocol.Https) {
			return https.request(
				options,
				(response: http.IncomingMessage) => onSuccess(response)
			);
		}
		else if (protocol == HttpProtocol.Http) {
			return http.request(
				options,
				(response: http.IncomingMessage) => onSuccess(response)
			);
		}
		throw new Error(`Unsupported protocol: ${protocol}`);
	}
}
