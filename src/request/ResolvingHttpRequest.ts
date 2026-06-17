import type * as http from 'http';
import HttpError from '../http/HttpError.ts';
import { HttpMethod } from '../http/HttpMethod.ts';
import { HttpStatusCode } from '../http/HttpStatusCode.ts';
import HttpRequest from './HttpRequest.ts';

/**
 * Drives an HttpRequest through to a usable response. It follows redirects up to
 * a configurable limit, treats 200 and 206 as success while parsing
 * content-length and content-range into total and requested byte counts, and
 * surfaces 4xx/5xx and unexpected status codes as errors. Outcomes are delivered
 * through the onResolve and onError callbacks.
 */
export default class ResolvingHttpRequest {
	public maxRedirects: number = 10;

	public onResolve?: (response: http.IncomingMessage) => void;
	public onError?: (error: Error) => void;

	public get totalBytes(): number {
		return this._totalBytes;
	}

	public get requestedBytes(): number {
		return this._requestedBytes;
	}

	private static readonly CONTENT_RANGE_RESPONSE_REGEX: RegExp = /bytes (\d+)-(\d+)\/(\d+)/i;

	private _totalBytes: number = 0;
	private _requestedBytes: number = 0;
	private _redirects: number = 0;

	public constructor(
		private readonly _url: string,
		private readonly _method: string,
		private readonly _headers?: http.OutgoingHttpHeaders,
		private readonly _postData?: string,
	) {
	}

	public resolve(): void {
		void this.sendRequest(
			this._url,
			this._method,
			this._headers,
			this._postData
		);
	}

	private async sendRequest(
		url: string,
		method: string,
		headers: http.OutgoingHttpHeaders = {},
		postData?: string,
	): Promise<void> {
		try {
			const request = new HttpRequest(url, method, headers, postData);
			const result: http.IncomingMessage = await request.send();
			this.onResponse(result);
		}
		catch (error) {
			this.handleError(error as Error);
		}
	}

	private onResponse(response: http.IncomingMessage): void {
		switch (response.statusCode) {
			case HttpStatusCode.OK: {
				const contentLength: string | undefined = response.headers['content-length'];
				if (contentLength == null) {
					this.handleError(new Error('Missing content length header.'));
					break;
				}
				this._totalBytes = parseInt(contentLength, 10);
				this._requestedBytes = this._totalBytes;
				this.handleSuccessResponse(response);
				break;
			}
			case HttpStatusCode.PARTIAL_CONTENT: {
				const range: string | undefined = response.headers['content-range'];
				if (range == null) {
					this.handleError(new Error('Partial content without range header.'));
					break;
				}
				const match: RegExpMatchArray | null = range.match(ResolvingHttpRequest.CONTENT_RANGE_RESPONSE_REGEX);
				if (match == null) {
					this.handleError(new Error('Invalid range header.'));
					break;
				}
				const start: number = parseInt(match[1]!, 10);
				const end: number = parseInt(match[2]!, 10);
				const total: number = parseInt(match[3]!, 10);
				this._totalBytes = total;
				this._requestedBytes = end - start + 1;
				this.handleSuccessResponse(response);
				break;
			}
			case HttpStatusCode.MOVED_PERMANENTLY:
			case HttpStatusCode.FOUND:
				this.handleRedirectResponse(response, HttpMethod.GET);
			// falls through
			case HttpStatusCode.TEMPORARY_REDIRECT:
			case HttpStatusCode.PERMANENT_REDIRECT:
				this.handleRedirectResponse(response, this._method);
				break;
			default: {
				const statusCode: number | undefined = response.statusCode;
				if (statusCode == null) {
					this.handleError(new Error('Response without status code.'));
					break;
				}
				if (statusCode >= HttpStatusCode.BAD_REQUEST) {
					this.handleErrorResponse(response);
				}
				if (
					statusCode >= HttpStatusCode.MULTIPLE_CHOICES
					|| statusCode < HttpStatusCode.OK
				) {
					this.onError?.(new Error(`Unhandled status code: ${statusCode}`));
				}
				else {
					this.handleSuccessResponse(response);
				}
				break;
			}
		}
	}

	private handleSuccessResponse(response: http.IncomingMessage): void {
		this.onResolve?.(response);
	}

	private handleRedirectResponse(response: http.IncomingMessage, method: string): void {
		if (this._redirects >= this.maxRedirects) {
			this.handleError(new Error('Too many redirects.'));
			return;
		}
		this._redirects++;
		const location: string | undefined = response.headers.location;
		if (location == null) {
			this.handleError(new Error('Missing Location header on redirect.'));
		}
		else {
			void this.sendRequest(location, method, this._headers, this._postData);
		}
	}

	private handleErrorResponse(response: http.IncomingMessage): void {
		response.destroy();
		const error: Error = response.statusCode == null
			? new Error('Response without status code.')
			: new HttpError(response.statusCode, response.statusMessage ?? '');
		this.handleError(error);
	}

	private handleError(error: Error): void {
		this.onError?.(error);
	}
}
