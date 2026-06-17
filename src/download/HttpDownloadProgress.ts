import type IHttpDownload from './IHttpDownload.ts';
import type IHttpDownloadProgress from './IHttpDownloadProgress.ts';

/**
 * Measures the throughput of an IHttpDownload. It samples downloaded bytes on a
 * short interval to compute a bytes-per-second rate and reports current/total
 * progress on a separate callback interval, stopping automatically once the
 * download ends.
 */
export default class HttpDownloadProgress implements IHttpDownloadProgress {
	public onProgress?: (current: number, total: number) => void;

	public get bytesPerSecond(): number {
		return this._bytesPerSecond;
	}

	private readonly _httpDownload: IHttpDownload;
	private readonly _refreshInterval: number;
	private readonly _callbackInterval: number;

	private _refreshIntervalCallback: NodeJS.Timeout | null = null;
	private _callbackIntervalCallback: NodeJS.Timeout | null = null;

	private _lastDownloadedBytes: number = 0;
	private _lastDownloadedTime: number = 0;
	private _bytesPerSecond: number = 0;
	private _isRunning: boolean = false;

	public constructor(httpDownload: IHttpDownload, refreshInterval: number = 100, callbackInterval: number = 1000) {
		this._httpDownload = httpDownload;
		this._refreshInterval = refreshInterval;
		this._callbackInterval = callbackInterval;
	}

	public start(): void {
		if (this._isRunning) {
			throw new Error('Already running');
		}
		this._isRunning = true;
		this._refreshIntervalCallback = setInterval(() => this.onRefreshInterval(), this._refreshInterval);
		this._callbackIntervalCallback = setInterval(() => this.onCallbackInterval(), this._callbackInterval);
	}

	public stop(): void {
		if (this._refreshIntervalCallback != null) {
			clearInterval(this._refreshIntervalCallback);
		}
		if (this._callbackIntervalCallback != null) {
			clearInterval(this._callbackIntervalCallback);
		}
		this._refreshIntervalCallback = null;
		this._callbackIntervalCallback = null;
		this._lastDownloadedBytes = 0;
		this._lastDownloadedTime = 0;
		this._bytesPerSecond = 0;
		this._isRunning = false;
	}

	private onRefreshInterval(): void {
		if (!this._httpDownload.isDownloading) {
			this.stop();
			return;
		}

		const current: number = this._httpDownload.downloadedBytes;
		const now: number = Date.now();
		const elapsed: number = now - this._lastDownloadedTime;
		if (elapsed >= 1000) {
			this._bytesPerSecond = (current - this._lastDownloadedBytes) / (elapsed / 1000);
			this._lastDownloadedBytes = current;
			this._lastDownloadedTime = now;
		}
	}

	private onCallbackInterval(): void {
		this.onProgress?.(this._httpDownload.downloadedBytes, this._httpDownload.requestedBytes);
	}
}
