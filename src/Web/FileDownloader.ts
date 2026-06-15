// eslint-disable-next-line max-classes-per-file
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { HTTPStatusCode } from './HTTPStatusCode.ts';
import HTTPError from './HTTPError.ts';

export default class FileDownloader {

	public async download(url: string, destination: string): Promise<void> {
		return new Promise((success, error) => this.prepareDownload(url, destination, success, error));
	}

	private prepareDownload(targetUrl: string, destination: string, onSuccess: () => void, onError: (error: Error) => void): void {

		const params = new FileDownloadRequestData(targetUrl, destination, onSuccess, onError);

		try {
			this.startDownload(targetUrl, params);

		} catch (error: any) {
			this.handleError(error, params);
		}
	}

	private startDownload(targetUrl: string, requestData: FileDownloadRequestData) {

		const url = new URL(targetUrl);
		const responseCallback = (response: http.IncomingMessage) => this.onResponse(response, requestData);

		let request: http.ClientRequest;
		if (url.protocol == 'https:') {
			request = https.get(targetUrl, responseCallback);
		}
		else {
			request = http.get(targetUrl, responseCallback);
		}
		request.on('error', (error: Error) => {
			this.handleError(error, requestData);
		})
	}

	private onResponse(response: http.IncomingMessage, requestData: FileDownloadRequestData): void {

		switch (response.statusCode) {
			case HTTPStatusCode.OK:
				this.handleSuccessResponse(response, requestData);
				break;
			case HTTPStatusCode.FOUND:
			case HTTPStatusCode.MOVED_PERMANENTLY:
			case HTTPStatusCode.TEMPORARY_REDIRECT:
				this.handleRedirectResponse(response, requestData);
				break;
			default:
				this.handleErrorResponse(response, requestData);
				break;
		}
	}

	private handleSuccessResponse(response: http.IncomingMessage, requestData: FileDownloadRequestData): void {

		let file: fs.WriteStream;
		try {
			file = fs.createWriteStream(requestData.destination);
			file.on('close', () => {
				requestData.onSuccess();
			});
			response.pipe(file, { end: true });

		} catch (error: any) {
			fs.unlinkSync(requestData.destination);
			this.handleError(error, requestData);
		}
	}

	private handleRedirectResponse(response: http.IncomingMessage, requestData: FileDownloadRequestData): void {

		const location: string | undefined = response.headers.location;

		if (location == null) {
			requestData.onError(new Error('Missing Location header on redirect.'));
		}
		else {
			this.startDownload(location, requestData);
		}
	}

	private handleErrorResponse(response: http.IncomingMessage, requestData: FileDownloadRequestData): void {

		const error = response.statusCode == null ?
			new Error('Response without status code.') :
			new HTTPError(response.statusCode);
		this.handleError(error, requestData);
	}

	private handleError(error: any, requestData: FileDownloadRequestData): void {
		requestData.onError(error);
	}
}

class FileDownloadRequestData {
	constructor(
		public readonly targetUrl: string,
		public readonly destination: string,
		public readonly onSuccess: () => void,
		public readonly onError: (error: Error) => void
	) {
	}
}