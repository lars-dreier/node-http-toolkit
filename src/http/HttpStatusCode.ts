const HttpStatusCode = {
	NO_CONNECTION: 0,
	OK: 200,
	PARTIAL_CONTENT: 206,
	MULTIPLE_CHOICES: 300,
	MOVED_PERMANENTLY: 301,
	FOUND: 302,
	TEMPORARY_REDIRECT: 307,
	PERMANENT_REDIRECT: 308,
	BAD_REQUEST: 400,
	REQUESTED_RANGE_NOT_SATISFIABLE: 416
} as const;
type HttpStatusCode = typeof HttpStatusCode[keyof typeof HttpStatusCode];
export { HttpStatusCode };
