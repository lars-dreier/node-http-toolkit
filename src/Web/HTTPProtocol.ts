const HTTPProtocol = {
	HTTP: 'http:',
	HTTPS: 'https:'
} as const;
type HTTPProtocol = typeof HTTPProtocol[keyof typeof HTTPProtocol];
export { HTTPProtocol };
