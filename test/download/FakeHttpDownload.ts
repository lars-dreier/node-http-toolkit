import type IHttpDownload from '../../src/download/IHttpDownload.ts';

/**
 * Hand-written fake IHttpDownload for exercising code that depends on the
 * download contract without real I/O. Fields are mutable so tests can drive the
 * observable state directly; the control methods are inert.
 */
export default class FakeHttpDownload implements IHttpDownload {
	public onStart?: (download: IHttpDownload) => void;
	public onProgress?: (download: IHttpDownload, chunkSize: number) => void;
	public onComplete?: (download: IHttpDownload) => void;
	public onError?: (download: IHttpDownload, error: Error) => void;

	public url: string = 'http://127.0.0.1/';
	public isDownloading: boolean = false;
	public isComplete: boolean = false;
	public totalBytes: number = 0;
	public requestedBytes: number = 0;
	public downloadedBytes: number = 0;
	public targetPath: string = '';
	public timeout: number = 0;

	public setHeader(): void {}
	public setHeaders(): void {}
	public start(): void {}
	public resume(): void {}
	public stop(): void {}
}
