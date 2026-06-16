const HttpProtocol = {
	Http: 'http:',
	Https: 'https:'
} as const;
type HttpProtocol = typeof HttpProtocol[keyof typeof HttpProtocol];
export { HttpProtocol };
