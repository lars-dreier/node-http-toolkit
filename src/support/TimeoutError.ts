/**
 * Error raised when a connection exceeds its inactivity timeout.
 */
export default class TimeoutError extends Error {
	public constructor() {
		super('Connection timeout');
		this.name = 'TimeoutError';
	}
}
