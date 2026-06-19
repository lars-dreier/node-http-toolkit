# API Reference

The public surface is exactly what `src/index.ts` re-exports. Everything else
(notably `support/FileSystem`) is internal. Default exports are re-exported as named
exports; enums are exported by name.

## Requests

### `HttpRequest`
`new HttpRequest(url, method, headers?, postData?)`
- `send(): Promise<http.IncomingMessage>` — performs one request, resolves with the
  raw response. Non-GET methods write `postData` (if any) and end the request.
- Throws `Error` for unsupported protocols (non `http:`/`https:`).

### `ResolvingHttpRequest`
`new ResolvingHttpRequest(url, method, headers?, postData?)` — callback-style.
- `maxRedirects: number` — default `10`.
- `onResolve?: (response) => void`, `onError?: (error) => void`.
- `resolve(): void` — starts resolution; result/err arrive via the callbacks.
- `get totalBytes`, `get requestedBytes` — populated on success.

### `AsyncResolvingHttpRequest`
`new AsyncResolvingHttpRequest(url, method, headers?, postData?)` — promise-style.
- `maxRedirects?: number` — applied only if set.
- `resolve(): Promise<http.IncomingMessage>` — resolves with the final response after
  redirects/status handling; rejects on error.
- `get totalBytes`, `get requestedBytes`.

## Responses

### `HttpResponseReader`
- `readData(response): Promise<string>` — buffers and decodes the body
  (`br`/`gzip`/`deflate`, chained encodings supported). Rejects on non-buffer data,
  early close, stream error, or unknown encoding.

### `HttpResponseSize`
`new HttpResponseSize(totalBytes, contentLength, start, end)`
- `static parse(response): HttpResponseSize` — `200` → content-length; `206` → parses
  & validates `content-range`. Throws on missing/invalid headers, length mismatch, or
  unexpected status.

## Downloads

### `IHttpDownload` (interface)
Common contract: callbacks `onStart/onProgress/onComplete/onError`; getters `url`,
`isDownloading`, `isComplete`, `totalBytes`, `requestedBytes`, `downloadedBytes`,
`targetPath`; `timeout` get/set; `setHeader`/`setHeaders`; `start`/`resume`/`stop`.

### `HttpDownload implements IHttpDownload`
`new HttpDownload(url, destinationPath)`
- `setHeader(key, value)`, `setHeaders(headers)`.
- `start()` — fresh download (`w`); throws if already downloading.
- `resume()` — appends (`a`), computes `Range` from existing file size; completes
  immediately if already past the requested end.
- `stop()` — pauses/destroys the response.
- `timeout` — per-socket inactivity ms (`0` = disabled); fires `TimeoutError`.

### `MultiStreamHttpDownload implements IHttpDownload`
`new MultiStreamHttpDownload(url, destinationPath)`
- `streamCount` get/set (≥1; throws if set while downloading) — desired segments.
- `maxSimultaneousStreams` get/set (≥1) — concurrency; raising it mid-download starts
  more streams.
- `timeout` get/set — propagates to every segment's `HttpDownload`.
- `get streams`, `get streamCount`, `get completedStreamCount`.
- Extra callbacks: `onStreamStart`, `onStreamComplete`, `onStreamError`, `onStreamJoin`.
- Requires server `Accept-Ranges: bytes` (throws otherwise). Retries transient stream
  errors; `HttpError` is fatal. Joins `.partN` files into the destination on completion.

### `Stream`
`new Stream(download, index, start, end)` — one byte-range segment.
- `download: IHttpDownload`, `index`, `start`, `end` (readonly).
- State: `shouldSkip`, `resumeAt`, `isResuming`; `get isPaused` (= `resumeAt > 0`).
- Pass-throughs: `isDownloading`, `isComplete`, `targetPath`, `downloadedBytes`,
  `totalBytes` (segment size = `end - start + 1`).

### `HttpDownloadProgress implements IHttpDownloadProgress`
`new HttpDownloadProgress(download, refreshInterval = 100, callbackInterval = 1000)`
- `onProgress?: (current, total) => void`.
- `get bytesPerSecond`.
- `start()` (throws if already running) / `stop()`. Auto-stops when the download ends.

### `IHttpDownloadProgress` (interface)
- `get bytesPerSecond(): number`.

## HTTP primitives & errors

### `HttpHeaderUtil` (all static)
`getHeader`, `setHeader`, `removeHeader` (case-insensitive); `mergeHeaders`,
`normalizeHeaders` (lowercased keys).

### `HttpError extends Error`
`new HttpError(statusCode, statusMessage)` — `name = 'HttpError'`, message
`HTTP Error <code>: <message>`.

### `TimeoutError extends Error`
`new TimeoutError()` — `name = 'TimeoutError'`, message `Connection timeout`.

### `HttpFormatter` (static)
`formatBytes(bytes): string` — human-readable size (`Bytes`/`KB`/`MB`/`GB`/`TB`,
clamped to TB), `'0 Bytes'` for `<= 0`.

## Const-object enums (string/number literal unions)

- `HttpMethod` — `GET HEAD POST PUT DELETE CONNECT OPTIONS TRACE PATCH`.
- `HttpProtocol` — `Http: 'http:'`, `Https: 'https:'`.
- `HttpStatusCode` — the codes acted on: `NO_CONNECTION(0)`, `OK(200)`,
  `PARTIAL_CONTENT(206)`, `MULTIPLE_CHOICES(300)`, `MOVED_PERMANENTLY(301)`,
  `FOUND(302)`, `SEE_OTHER(303)`, `TEMPORARY_REDIRECT(307)`, `PERMANENT_REDIRECT(308)`,
  `BAD_REQUEST(400)`, `REQUESTED_RANGE_NOT_SATISFIABLE(416)`.
