import type * as http from 'http';

export default class HTTPHeaderUtil {

	public static getHeader(headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders, key: string): string | undefined {
		return (headers[key] ?? headers[key.toLowerCase()]) as string | undefined;
	}

	public static removeHeader(headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders, key: string): void {
		delete headers[key];
		delete headers[key.toLowerCase()];
	}

	public static setHeader(headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders, key: string, value: string): void {
		HTTPHeaderUtil.removeHeader(headers, key);
		headers[key] = value;
	}

	public static mergeHeaders(headers: http.IncomingHttpHeaders, newHeaders: http.IncomingHttpHeaders): void {
		for (const key in newHeaders) {
			const value: string | undefined = HTTPHeaderUtil.getHeader(newHeaders, key);
			if (value != null) {
				HTTPHeaderUtil.setHeader(headers, key, value);
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
