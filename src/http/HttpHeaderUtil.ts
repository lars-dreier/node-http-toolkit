import type * as http from 'http';

/**
 * Helpers for reading and modifying HTTP header objects: get, set, remove, merge
 * and normalize header keys.
 */
export default class HttpHeaderUtil {
	public static getHeader(
		headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders,
		key: string,
	): string | undefined {
		return (headers[key] ?? headers[key.toLowerCase()]) as string | undefined;
	}

	public static removeHeader(headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders, key: string): void {
		delete headers[key];
		delete headers[key.toLowerCase()];
	}

	public static setHeader(
		headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders,
		key: string,
		value: string,
	): void {
		HttpHeaderUtil.removeHeader(headers, key);
		headers[key] = value;
	}

	public static mergeHeaders(headers: http.IncomingHttpHeaders, newHeaders: http.IncomingHttpHeaders): void {
		for (const key in newHeaders) {
			const value: string | undefined = HttpHeaderUtil.getHeader(newHeaders, key);
			if (value != null) {
				HttpHeaderUtil.setHeader(headers, key, value);
			}
		}
	}

	public static normalizeHeaders(headers: http.IncomingHttpHeaders): http.IncomingHttpHeaders {
		const normalizedHeaders: http.IncomingHttpHeaders = {};
		for (const key in headers) {
			normalizedHeaders[key.toLowerCase()] = headers[key];
		}
		return normalizedHeaders;
	}
}
