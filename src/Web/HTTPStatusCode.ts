const HTTPStatusCode = {
	NO_CONNECTION: 0,
	OK: 200,
	MOVED_PERMANENTLY: 301,
	FOUND: 302,
	TEMPORARY_REDIRECT: 307
} as const;
type HTTPStatusCode = typeof HTTPStatusCode[keyof typeof HTTPStatusCode];
export { HTTPStatusCode };
