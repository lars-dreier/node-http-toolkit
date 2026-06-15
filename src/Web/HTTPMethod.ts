const HTTPMethod = {
	GET: 'GET',
	HEAD: 'HEAD',
	POST: 'POST',
	PUT: 'PUT',
	DELETE: 'DELETE',
	CONNECT: 'CONNECT',
	OPTIONS: 'OPTIONS',
	TRACE: 'TRACE',
	PATCH: 'PATCH'
} as const;
type HTTPMethod = typeof HTTPMethod[keyof typeof HTTPMethod];
export { HTTPMethod };
