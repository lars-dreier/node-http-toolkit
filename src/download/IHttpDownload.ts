import type * as http from 'http';

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
