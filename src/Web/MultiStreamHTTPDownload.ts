import type * as http from 'http';
import FileSystem from '../System/FileSystem.ts';
import AsyncResolvingHTTPRequest from './AsyncResolvingHTTPRequest.ts';
import HTTPDownload from './HTTPDownload.ts';
import HTTPError from './HTTPError.ts';
import HTTPHeaderUtil from './HTTPHeaderUtil.ts';
import { HTTPMethod } from './HTTPMethod.ts';
import type IHTTPDownload from './IHTTPDownload.ts';
import Stream from './Stream.ts';
import HTTPResponseSize from './Util/HTTPResponseSize.ts';

export default class MultiStreamHTTPDownload implements IHTTPDownload {

	public get streams(): Stream[] {
		return this._streams;
	}

	private static readonly STREAM_ERROR_DELAY: number = 5000;
	private static readonly STREAM_CHECK_INTERVAL: number = 500;

	public onStart?: (download: IHTTPDownload) => void;
	public onProgress?: (download: IHTTPDownload, chunkSize: number) => void;
	public onStreamJoin?: (download: IHTTPDownload) => void;
	public onComplete?: (download: IHTTPDownload) => void;
	public onError?: (download: IHTTPDownload, error: Error) => void;
	public onStreamStart?: (stream: Stream) => void;
	public onStreamComplete?: (stream: Stream) => void;
	public onStreamError?: (stream: Stream, error: Error) => void;

	public get url(): string {
		return this._url;
	}

	public get isDownloading(): boolean {
		return this._isDownloading;
	}

	public get targetPath(): string {
		return this._destinationPath;
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

	public get isComplete(): boolean {
		return this._isComplete;
	}

	public get streamCount(): number {
		return this._streamCount;
	}

	public get completedStreamCount(): number {
		return this._completedStreams;
	}

	public set streamCount(value: number) {
		if (this._isDownloading) {
			throw new Error('Cannot change stream count while downloading.');
		}
		this._streamCount = Math.max(1, value);
	}

	public get maxSimultaneousStreams(): number {
		return this._maxSimultaneousStreams;
	}

	public set maxSimultaneousStreams(value: number) {
		value = Math.max(1, value);
		const increase: boolean = value > this._maxSimultaneousStreams;
		this._maxSimultaneousStreams = value;
		if (increase && this._started && this._isDownloading) {
			this.startStreams();
		}
	}

	public get timeout(): number {
		return this._timeout;
	}

	public set timeout(value: number) {
		this._timeout = value;
		for (const stream of this._streams) {
			stream.download.timeout = value;
		}
	}

	private readonly _activeStreams = new Set<Stream>();
	private readonly _pausedStreams = new Set<Stream>();

	protected readonly _url: string;
	protected readonly _destinationPath: string;
	protected readonly _streams: Stream[] = [];

	private _streamCount: number = 1;
	private _maxSimultaneousStreams: number = 1;
	private _timeout: number = 0;
	private _isDownloading: boolean = false;
	private _totalBytes: number = 0;
	private _requestedBytes: number = 0;
	private _downloadedBytes: number = 0;
	private _completedStreams: number = 0;
	private _headers: http.OutgoingHttpHeaders = {};
	private _isComplete: boolean = false;
	private _isResuming: boolean = false;
	private _started: boolean = false;
	private _resumeStreamsTimeout: NodeJS.Timeout | null = null;

	public constructor(
		url: string,
		destinationPath: string) {
		this._url = url;
		this._destinationPath = destinationPath;
	}

	public setHeader(key: string, value: string): void {
		HTTPHeaderUtil.setHeader(this._headers, key, value);
	}

	public setHeaders(headers: http.OutgoingHttpHeaders): void {
		this._headers = { ...headers };
	}

	public start(): void {
		void this.startDownload(false);
	}

	public resume(): void {
		void this.startDownload(true);
	}

	public stop(): void {
		this.cancelPausedStreamCheck();

		for (const stream of this._streams) {
			stream.download.stop();
		}

		this._isDownloading = false;
	}

	protected prepareStreams(): Stream[] {
		const chunkSize: number = Math.floor(this._totalBytes / this._streamCount);
		return this.createStreams(this._totalBytes, chunkSize);
	}

	protected createStreams(totalBytes: number, chunkSize: number): Stream[] {
		const streams: Stream[] = [];
		let start: number = 0;
		let end: number = chunkSize;
		while (start < totalBytes) {
			const stream: Stream = this.createStream(
				streams.length,
				start,
				Math.min(end, totalBytes) - 1
			);
			streams.push(stream);
			start = end;
			end += chunkSize;
		}
		return streams;
	}

	protected async joinStreams(): Promise<void> {
		const fileStreams: string[] = this._streams.map(stream => stream.targetPath);
		await FileSystem.joinFiles(fileStreams, this._destinationPath);
		for (const stream of fileStreams) {
			FileSystem.removeFile(stream);
		}
	}

	private async startDownload(resume: boolean): Promise<void> {
		if (this._isDownloading) {
			throw new Error('Download already in progress.');
		}

		this._isDownloading = true;
		this._isComplete = false;
		this._isResuming = resume;
		this._completedStreams = 0;

		await this.prepareDownload();
		if (this._completedStreams === this._streamCount) {
			await this.completeDownload();
			return;
		}


		if (!resume || !FileSystem.exists(this._destinationPath)) {
			FileSystem.createFile(this._destinationPath);
		}

		this.startStreams();
		this.startPausedStreamCheck();
	}

	private async prepareDownload(): Promise<void> {
		this._totalBytes = 0;
		this._requestedBytes = 0;
		this._downloadedBytes = 0;
		this._activeStreams.clear();
		this._pausedStreams.clear();

		const request = new AsyncResolvingHTTPRequest(
			this._url,
			HTTPMethod.GET,
			this._headers
		);

		const response: http.IncomingMessage = await request.resolve();
		const responseSize: HTTPResponseSize = HTTPResponseSize.parse(response);

		const acceptRanges = response.headers['accept-ranges'];
		const acceptByteRanges: boolean = typeof acceptRanges === 'string' && acceptRanges.includes('bytes');
		if (!acceptByteRanges) {
			throw new Error('Server does not support byte ranges');
		}

		const totalBytes: number = responseSize.totalBytes;
		this._totalBytes = totalBytes;
		this._requestedBytes = totalBytes;

		const streams: Stream[] = this.prepareStreams();
		this._streamCount = streams.length;

		for (const stream of streams) {
			this._streams.push(stream);

			if (!FileSystem.exists(stream.targetPath)) {
				continue;
			}

			const size: number = FileSystem.getFileSize(stream.targetPath);
			if (size > stream.totalBytes) {
				this.onStreamError?.(stream, new Error('Stream file size exceeds expected size, deleting file.'));
				FileSystem.removeFile(stream.targetPath);
				return;
			}

			this._requestedBytes -= size;

			if (size === stream.totalBytes) {
				stream.shouldSkip = true;
				this._completedStreams++;
			}
		}
	}

	private createStream(index: number, start: number, end: number): Stream {
		const chunkPath: string = this._destinationPath + `.part${index}`;
		const headers: http.OutgoingHttpHeaders = { ...this._headers };
		HTTPHeaderUtil.setHeader(headers, 'Range', `bytes=${start}-${end}`);
		const download = new HTTPDownload(
			this._url,
			chunkPath,
		);
		const stream = new Stream(download, index, start, end);
		stream.isResuming = this._isResuming;

		download.setHeaders(headers);
		download.timeout = this._timeout;
		download.onStart = () => this.onDownloadStreamStart(stream);
		download.onProgress = (downloadStream: IHTTPDownload, chunkSize: number) => this.onDownloadStreamProgress(downloadStream, chunkSize);
		download.onError = (_download: IHTTPDownload, error: Error) => this.onDownloadStreamError(stream, error);
		download.onComplete = () => { void this.onDownloadStreamComplete(stream); };
		return stream;
	}

	private startStreams(): void {
		const active: number = this._activeStreams.size;

		let availableStreams: number = Math.min(
			this._maxSimultaneousStreams - active,
			this._streamCount - active
		);

		for (let i = 0; i < this._streams.length && availableStreams > 0; i++) {
			const stream: Stream | undefined = this._streams[i];
			if (stream == null || stream.isDownloading || stream.isComplete) {
				continue;
			}

			if (stream.isPaused || stream.shouldSkip) {
				continue;
			}

			this._activeStreams.add(stream);
			availableStreams--;

			if (stream.isResuming) {
				stream.download.resume();
			}
			else {
				stream.download.start();
			}
		}
	}

	private onDownloadStreamStart(stream: Stream): void {
		if (!this._started) {
			this._started = true;
			this.onStart?.(this);
		}
		this.onStreamStart?.(stream);
	}

	private onDownloadStreamProgress(_download: IHTTPDownload, chunkSize: number): void {
		this._downloadedBytes += chunkSize;
		this.onProgress?.(this, chunkSize);
	}

	private onDownloadStreamError(stream: Stream, error: Error): void {
		this._activeStreams.delete(stream);

		if (this.isFatalError(error)) {
			this.stop();
			this.onError?.(this, error);
			return;
		}

		this.pauseStream(stream, MultiStreamHTTPDownload.STREAM_ERROR_DELAY);
		this.onStreamError?.(stream, error);
		this.startStreams();
	}

	private isFatalError(error: Error): boolean {
		return error instanceof HTTPError;
	}

	private startPausedStreamCheck(): void {
		if (this._resumeStreamsTimeout != null) {
			return;
		}

		this._resumeStreamsTimeout = setInterval(
			() => this.checkResumableStreams(),
			MultiStreamHTTPDownload.STREAM_CHECK_INTERVAL
		);
	}

	private cancelPausedStreamCheck(): void {
		if (this._resumeStreamsTimeout != null) {
			clearTimeout(this._resumeStreamsTimeout);
			this._resumeStreamsTimeout = null;
		}
	}

	private pauseStream(stream: Stream, delay: number): void {
		stream.resumeAt = new Date().getTime() + delay;
		this._pausedStreams.add(stream);
	}

	private checkResumableStreams(): void {
		const now = new Date().getTime();
		const pausedStreams: Stream[] = Array.from(this._pausedStreams);
		let hasResumedStreams: boolean = false;
		for (const stream of pausedStreams) {
			if (stream.resumeAt <= now) {
				stream.resumeAt = 0;
				stream.isResuming = true;
				this._pausedStreams.delete(stream);
				hasResumedStreams = true;
			}
		}

		if (hasResumedStreams && this._activeStreams.size < this._maxSimultaneousStreams) {
			this.startStreams();
		}
	}

	private async onDownloadStreamComplete(stream: Stream): Promise<void> {
		this._activeStreams.delete(stream);
		this._completedStreams++;
		this.onStreamComplete?.(stream);

		if (this._completedStreams < this._streamCount) {
			this.startStreams();
		}
		else {
			await this.completeDownload();
		}
	}

	private async completeDownload(): Promise<void> {
		this.cancelPausedStreamCheck();

		this.onStreamJoin?.(this);
		await this.joinStreams();

		this._isDownloading = false;
		this._isComplete = true;
		this.onComplete?.(this);
	}
}
