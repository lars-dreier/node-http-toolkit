/**
 * The URL protocol schemes the toolkit dispatches requests for.
 */
const HttpProtocol = {
	Http: 'http:',
	Https: 'https:'
} as const;
type HttpProtocol = typeof HttpProtocol[keyof typeof HttpProtocol];
export { HttpProtocol };
