import * as http from 'http';
import * as https from 'https';

export default class HTTPRequest {

	public async send(
		url: string,
		method: string,
		headers?: http.OutgoingHttpHeaders
	): Promise<http.IncomingMessage> {

		return new Promise<http.IncomingMessage>(
			(success, error) => this.prepareRequest(url, method, headers, success, error)
		);
	}

	private prepareRequest(
		url: string,
		method: string,
		headers: http.OutgoingHttpHeaders | undefined,
		onSuccess: (response: http.IncomingMessage) => void,
		onError: (error: Error) => void,
	): void {

		const requestData = new HTTPRequestData(url, method, headers, onSuccess, onError);

		let request: http.ClientRequest;

		if (requestData.url.protocol == 'https:') {

			request = https.get(
				requestData.options,
				(response: http.IncomingMessage) => requestData.onSuccess(response)
			);
		}
		else {

			request = http.get(
				requestData.options,
				(response: http.IncomingMessage) => requestData.onSuccess(response)
			);
		}

		request.once('error', (error: Error) => {
			requestData.onError(error);
		})
	}
}

class HTTPRequestData {

	public get url(): URL {
		return this._url;
	}

	public get options(): http.RequestOptions {
		return this._options;
	}

	private _url: URL;
	private _options: http.RequestOptions;

	constructor(
		public readonly originalUrl: string,
		public readonly method: string,
		public readonly headers: http.OutgoingHttpHeaders | undefined,
		public readonly onSuccess: (response: http.IncomingMessage) => void,
		public readonly onError: (error: Error) => void,
	) {
		this._url = new URL(originalUrl);

		this._options = {
			hostname: this._url.hostname,
			path: this._url.pathname + this._url.search,
			method: method,
			headers: headers
		};
	}
}