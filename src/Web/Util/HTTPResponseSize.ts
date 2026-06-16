import type * as http from 'http';
import HTTPHeaderUtil from '../HTTPHeaderUtil.ts';
import { HTTPStatusCode } from '../HTTPStatusCode.ts';

export default class HTTPResponseSize {

	private static readonly CONTENT_RANGE_RESPONSE_REGEX: RegExp = /bytes (\d+)-(\d+)\/(\d+)/i;

	public constructor(
		public readonly totalBytes: number,
		public readonly contentLength: number,
		public readonly start: number,
		public readonly end: number,
	) {
	}

	public static parse(response: http.IncomingMessage): HTTPResponseSize {
		switch (response.statusCode) {
			case HTTPStatusCode.OK:
				return HTTPResponseSize.parseCompleteContent(response);
			case HTTPStatusCode.PARTIAL_CONTENT:
				return HTTPResponseSize.parsePartialContent(response);
			default:
				throw new Error(`Unexpected status code: ${response.statusCode ?? 'none'}`);
		}
	}

	private static parseCompleteContent(response: http.IncomingMessage): HTTPResponseSize {
		const contentLength: number = HTTPResponseSize.parseContentLength(response);
		return new HTTPResponseSize(
			contentLength,
			contentLength,
			0,
			contentLength - 1
		);
	}

	private static parsePartialContent(response: http.IncomingMessage): HTTPResponseSize {

		const contentLength: number = HTTPResponseSize.parseContentLength(response);

		const range: string | undefined = HTTPHeaderUtil.getHeader(response.headers, 'content-range');
		if (range == null) {
			throw new Error('Partial content without range header.');
		}
		const match: RegExpMatchArray | null = range.match(HTTPResponseSize.CONTENT_RANGE_RESPONSE_REGEX);
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

		return new HTTPResponseSize(
			total,
			contentLength,
			start,
			end
		);
	}

	private static parseContentLength(response: http.IncomingMessage): number {
		const contentLength: string | undefined = HTTPHeaderUtil.getHeader(response.headers, 'content-length');
		if (contentLength == null) {
			throw new Error('Missing content length header.');
		}
		return parseInt(contentLength, 10);
	}
}
