import type * as http from 'http';
import ResolvingHttpRequest from './ResolvingHttpRequest.ts';

/**
 * Promise-based wrapper around ResolvingHttpRequest. It resolves with the final
 * response once redirects and status-code handling are done, or rejects on error,
 * while exposing the resolved total and requested byte counts.
 */
export default class AsyncResolvingHttpRequest {

	public maxRedirects?: number;

	public get totalBytes(): number {
		return this._request?.totalBytes ?? 0;
	}

	public get requestedBytes(): number {
		return this._request?.requestedBytes ?? 0;
	}

	private _request?: ResolvingHttpRequest;

	public constructor(
		private readonly _url: string,
		private readonly _method: string,
		private readonly _headers?: http.OutgoingHttpHeaders,
		private readonly _postData?: string
	) {
	}

	public resolve(): Promise<http.IncomingMessage> {
		return new Promise<http.IncomingMessage>(
			(resolve, reject) => {
				this._request = new ResolvingHttpRequest(
					this._url,
					this._method,
					this._headers,
					this._postData
				);
				this._request.onResolve = (response: http.IncomingMessage) => resolve(response);
				this._request.onError = (error: Error) => reject(error);
				this._request.resolve();
			}
		);
	}
}
