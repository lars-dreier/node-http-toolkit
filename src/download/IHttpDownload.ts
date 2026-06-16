import type * as http from 'http';

/**
 * Common contract for a file download: its URL and target path, byte counts,
 * timeout, lifecycle callbacks and start/resume/stop controls. Implemented by
 * both single-stream and multi-stream downloads so progress tooling can treat
 * them interchangeably.
 */
export default interface IHttpDownload {
	onStart?: (download: IHttpDownload) => void;
	onProgress?: (download: IHttpDownload, chunkSize: number) => void;
	onComplete?: (download: IHttpDownload) => void;
	onError?: (download: IHttpDownload, error: Error) => void;
	get url(): string;
	get isDownloading(): boolean;
	get isComplete(): boolean;
	get totalBytes(): number;
	get requestedBytes(): number;
	get downloadedBytes(): number;
	get targetPath(): string;
	get timeout(): number;
	set timeout(value: number);
	setHeader(key: string, value: string): void;
	setHeaders(headers: http.OutgoingHttpHeaders): void;
	start(): void;
	resume(): void;
	stop(): void;
}
