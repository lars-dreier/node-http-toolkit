const HttpMethod = {
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
type HttpMethod = typeof HttpMethod[keyof typeof HttpMethod];
export { HttpMethod };
