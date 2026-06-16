import type * as http from 'http';
import HttpHeaderUtil from '../http/HttpHeaderUtil.ts';
import { HttpStatusCode } from '../http/HttpStatusCode.ts';

export default class HttpResponseSize {

	private static readonly CONTENT_RANGE_RESPONSE_REGEX: RegExp = /bytes (\d+)-(\d+)\/(\d+)/i;

	public constructor(
		public readonly totalBytes: number,
		public readonly contentLength: number,
		public readonly start: number,
		public readonly end: number,
	) {
	}

	public static parse(response: http.IncomingMessage): HttpResponseSize {
		switch (response.statusCode) {
			case HttpStatusCode.OK:
				return HttpResponseSize.parseCompleteContent(response);
			case HttpStatusCode.PARTIAL_CONTENT:
				return HttpResponseSize.parsePartialContent(response);
			default:
				throw new Error(`Unexpected status code: ${response.statusCode ?? 'none'}`);
		}
	}

	private static parseCompleteContent(response: http.IncomingMessage): HttpResponseSize {
		const contentLength: number = HttpResponseSize.parseContentLength(response);
		return new HttpResponseSize(
			contentLength,
			contentLength,
			0,
			contentLength - 1
		);
	}

	private static parsePartialContent(response: http.IncomingMessage): HttpResponseSize {

		const contentLength: number = HttpResponseSize.parseContentLength(response);

		const range: string | undefined = HttpHeaderUtil.getHeader(response.headers, 'content-range');
		if (range == null) {
			throw new Error('Partial content without range header.');
		}
		const match: RegExpMatchArray | null = range.match(HttpResponseSize.CONTENT_RANGE_RESPONSE_REGEX);
		if (match == null) {
			throw new Error('Invalid range header.');
		}
		const start: number = parseInt(match[1]!, 10);
		const end: number = parseInt(match[2]!, 10);
		const total: number = parseInt(match[3]!, 10);

		const calculatedLength: number = end - start + 1;
		if (calculatedLength !== contentLength) {
			throw new Error('Content length mismatch.');
		}

		return new HttpResponseSize(
			total,
			contentLength,
			start,
			end
		);
	}

	private static parseContentLength(response: http.IncomingMessage): number {
		const contentLength: string | undefined = HttpHeaderUtil.getHeader(response.headers, 'content-length');
		if (contentLength == null) {
			throw new Error('Missing content length header.');
		}
		return parseInt(contentLength, 10);
	}
}
