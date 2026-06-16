export default class TimeoutError extends Error {
	public constructor() {
		super('Connection timeout');
	}
}
