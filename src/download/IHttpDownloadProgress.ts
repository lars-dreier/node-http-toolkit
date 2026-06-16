/**
 * Contract for a download throughput meter, exposing the current
 * bytes-per-second rate.
 */
export default interface IHttpDownloadProgress {
	get bytesPerSecond(): number;
}
