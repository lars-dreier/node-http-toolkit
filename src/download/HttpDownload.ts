import * as fs from 'fs';
import type * as http from 'http';
import AsyncResolvingHttpRequest from '../request/AsyncResolvingHttpRequest.ts';
import HttpHeaderUtil from '../http/HttpHeaderUtil.ts';
import { HttpMethod } from '../http/HttpMethod.ts';
import type IHttpDownload from './IHttpDownload.ts';
import TimeoutError from '../support/TimeoutError.ts';
import HttpResponseSize from '../response/HttpResponseSize.ts';

/**
 * Downloads a single URL to a file on disk. It supports custom request headers,
 * resuming a partially downloaded file via an HTTP Range request, a per-socket
 * inactivity timeout, and start/progress/complete/error callbacks, while tracking
 * total, requested and downloaded byte counts.
 */
export default class HttpDownload implements IHttpDownload {

	public onStart?: (download: IHttpDownload) => void;
	public onProgress?: (download: IHttpDownload, chunkSize: number) => void;
	public onComplete?: (download: IHttpDownload) => void;
	public onError?: (download: IHttpDownload, error: Error) => void;

	public get url(): string {
		return this._url;
	}

	public get isDownloading(): boolean {
		return this._isDownloading;
	}

	public get totalBytes(): number {
		return this._totalBytes;
	}

	public get requestedBytes(): number {
		return this._requestedBytes;
	}

	public get downloadedBytes(): number {
		return this._downloadedBytes;
	}

	public get targetPath(): string {
		return this._destinationPath;
	}

	public get isComplete(): boolean {
		return this._isComplete;
	}

	public get timeout(): number {
		return this._timeout;
	}

	public set timeout(value: number) {
		this._timeout = value;
	}

	private static readonly CONTENT_RANGE_REQUEST_REGEX: RegExp = /bytes=(\d+)-(\d+)?/i;
	private static readonly APPEND_FLAGS: string = 'a';
	private static readonly WRITE_FLAGS: string = 'w';

	private readonly _url: string;
	private readonly _destinationPath: string;

	private _isDownloading: boolean = false;
	private _totalBytes: number = 0;
	private _requestedBytes: number = 0;
	private _downloadedBytes: number = 0;
	private _downloadResponse: http.IncomingMessage | null = null;
	private _timeout: number = 0;
	private _headers: http.OutgoingHttpHeaders = {};
	private _fileAccessFlags: string = HttpDownload.APPEND_FLAGS;
	private _isComplete: boolean = false;

	public constructor(
		url: string,
		destinationPath: string) {
		this._url = url;
		this._destinationPath = destinationPath;
	}

	public setHeader(key: string, value: string): void {
		HttpHeaderUtil.setHeader(this._headers, key, value);
	}

	public setHeaders(headers: http.OutgoingHttpHeaders): void {
		this._headers = { ...headers };
	}

	public start(): void {
		if (this._isDownloading) {
			throw new Error('Download already in progress.');
		}

		this._isDownloading = true;

		this._totalBytes = 0;
		this._requestedBytes = 0;
		this._downloadedBytes = 0;

		this._fileAccessFlags = HttpDownload.WRITE_FLAGS;
		const headers: http.OutgoingHttpHeaders = { ...this._headers };

		void this.sendRequest(
			this._url,
			HttpMethod.GET,
			headers
		);
	}

	public resume(): void {
		if (this._isDownloading) {
			throw new Error('Download already in progress.');
		}

		this._isDownloading = true;

		this._totalBytes = 0;
		this._requestedBytes = 0;
		this._downloadedBytes = 0;

		this._fileAccessFlags = HttpDownload.APPEND_FLAGS;

		const offset: number = this.getFileOffset(this._destinationPath);
		const headers = { ...this._headers };
		const rangeHeader: string | undefined = HttpHeaderUtil.getHeader(headers, 'Range');
		let requestedStart: number = 0;
		let requestedEnd: number | null = null;
		if (rangeHeader == null) {
			HttpHeaderUtil.setHeader(headers, 'Range', `bytes=${offset}-`);
		}
		else {
			const match: RegExpMatchArray | null = rangeHeader.match(HttpDownload.CONTENT_RANGE_REQUEST_REGEX);
			if (match != null) {
				requestedStart = parseInt(match[1]!, 10);
				requestedEnd = parseInt(match[2]!, 10);
			}
		}
		const start: number = requestedStart + offset;
		if (requestedEnd != null && start >= requestedEnd) {
			this.onFileComplete();
			return;
		}

		HttpHeaderUtil.setHeader(headers, 'Range', `bytes=${start}-${requestedEnd ?? ''}`);
		void this.sendRequest(
			this._url,
			HttpMethod.GET,
			headers
		);
	}

	public stop(): void {
		if (!this._isDownloading) {
			return;
		}

		this._downloadResponse?.pause();
		this._downloadResponse?.destroy();
		this._downloadResponse = null;
		this._isDownloading = false;
	}

	private async sendRequest(url: string, method: string, headers: http.OutgoingHttpHeaders = {}): Promise<void> {
		try {
			const request = new AsyncResolvingHttpRequest(url, method, headers);
			const result: http.IncomingMessage = await request.resolve();
			const responseSize = HttpResponseSize.parse(result);
			this._totalBytes = responseSize.totalBytes;
			this._requestedBytes = responseSize.contentLength;
			this.handleSuccessResponse(result);
		} catch (error) {
			this.handleError(error as Error);
		}
	}

	private handleSuccessResponse(response: http.IncomingMessage): void {
		// If the download was stopped, destroy the response and return.
		if (!this._isDownloading) {
			response.destroy();
			return;
		}

		this._downloadResponse = response;

		response.on('data', (chunk: Buffer) => this.onResponseData(chunk));
		response.on('error', (error: Error) => this.handleError(error));

		if (this._timeout > 0) {
			this._downloadResponse.setTimeout(this._timeout, () => this.onConnectionTimeout());
		}

		this.onStart?.(this);

		try {
			const file: fs.WriteStream = fs.createWriteStream(
				this._destinationPath,
				{ flags: this._fileAccessFlags }
			);
			file.on('close', () => this.onFileComplete());
			response.pipe(file, { end: true });

		} catch (error) {
			fs.unlinkSync(this._destinationPath);
			this.handleError(error as Error);
		}
	}

	private onResponseData(chunk: Buffer): void {
		this._downloadedBytes += chunk.length;
		this.onProgress?.(this, chunk.length);
	}

	private onConnectionTimeout(): void {
		this.handleError(new TimeoutError());
	}

	private onFileComplete(): void {
		this._isDownloading = false;
		this._isComplete = true;
		this.onComplete?.(this);
	}

	private handleError(error: Error): void {
		this.stop();
		this.onError?.(this, error);
	}

	private getFileOffset(filePath: string): number {
		if (fs.existsSync(filePath)) {
			const stats = fs.statSync(filePath);
			return stats.size;
		}
		return 0;
	}
}
