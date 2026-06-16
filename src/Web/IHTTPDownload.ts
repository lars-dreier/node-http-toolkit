import type * as http from 'http';

export default interface IHTTPDownload {
	onStart?: (download: IHTTPDownload) => void;
	onProgress?: (download: IHTTPDownload, chunkSize: number) => void;
	onComplete?: (download: IHTTPDownload) => void;
	onError?: (download: IHTTPDownload, error: Error) => void;
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
