import type IHttpDownload from './IHttpDownload.ts';

/**
 * One byte-range segment of a MultiStreamHttpDownload. It pairs the segment's
 * underlying download with its index and byte range, and tracks its pause/resume,
 * skip and completion state.
 */
export default class Stream {
	public get isPaused(): boolean {
		return this.resumeAt > 0;
	}

	public shouldSkip: boolean = false;
	public resumeAt: number = 0;
	public isResuming: boolean = false;

	public get isDownloading(): boolean {
		return this.download.isDownloading;
	}

	public get isComplete(): boolean {
		return this.download.isComplete;
	}

	public get targetPath(): string {
		return this.download.targetPath;
	}

	public get downloadedBytes(): number {
		return this.download.downloadedBytes;
	}

	public get totalBytes(): number {
		return this._size;
	}

	private readonly _size: number;

	public constructor(
		public readonly download: IHttpDownload,
		public readonly index: number,
		public readonly start: number,
		public readonly end: number,
	) {
		this._size = end - start + 1;
	}
}
