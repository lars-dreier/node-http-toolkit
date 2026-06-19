---
title: "API Reference"
description: "Member-level reference for every public export from src/index.ts: classes, interfaces, and enums with constructors, methods, properties, and callbacks."
category: "reference"
tags: ["api", "reference", "public-exports", "classes", "enums"]
last_updated: "2026-06-19T19:03:11Z"
related_docs: ["overview.md", "architecture.md"]
---

# API Reference

## Table of Contents
1. [Requests](#requests)
   - [HttpRequest](#httprequest)
   - [ResolvingHttpRequest](#resolvinghttprequest)
   - [AsyncResolvingHttpRequest](#asyncresolvinghttprequest)
2. [Downloads](#downloads)
   - [IHttpDownload](#ihttpdownload)
   - [HttpDownload](#httpdownload)
   - [MultiStreamHttpDownload](#multistreamhttpdownload)
   - [Stream](#stream)
   - [HttpDownloadProgress](#httpdownloadprogress)
   - [IHttpDownloadProgress](#ihttpdownloadprogress)
3. [Responses](#responses)
   - [HttpResponseReader](#httpresponsereader)
   - [HttpResponseSize](#httpresponsesize)
4. [HTTP Primitives](#http-primitives)
   - [HttpError](#httperror)
   - [HttpHeaderUtil](#httpheaderutil)
   - [HttpMethod](#httpmethod)
   - [HttpProtocol](#httpprotocol)
   - [HttpStatusCode](#httpstatuscode)
5. [Support](#support)
   - [HttpFormatter](#httpformatter)
   - [TimeoutError](#timeouterror)

---

All members below are part of the public barrel (`src/index.ts`). Method
signatures are abbreviated; see the source for exact types. `http` refers to
`node:http`. For how these compose, read [architecture.md](architecture.md).

## Requests

### HttpRequest

Single raw HTTP/HTTPS request; resolves with the undecoded response.

```ts
new HttpRequest(url: string, method: string, headers?: http.OutgoingHttpHeaders, postData?: string)
send(): Promise<http.IncomingMessage>
```

- Does not inspect status codes — use `ResolvingHttpRequest` for that.
- Sends headers in insertion order. Writes `postData` and ends the request for
  non-GET methods. Rejects on unsupported protocol or transport error.

### ResolvingHttpRequest

Callback-based request that follows redirects and interprets status codes.

```ts
new ResolvingHttpRequest(url, method, headers?, postData?)
maxRedirects: number          // default 10
onResolve?: (response: http.IncomingMessage) => void
onError?: (error: Error) => void
get totalBytes(): number
get requestedBytes(): number
resolve(): void
```

- `200`/`206` resolve via `onResolve`; `3xx` redirect; `>= 400` raise `HttpError`
  via `onError`. Parses `content-length` / `content-range` into the byte getters.

### AsyncResolvingHttpRequest

Promise wrapper over `ResolvingHttpRequest`. **Preferred entry point** for
request-with-resolution; used internally by the download classes.

```ts
new AsyncResolvingHttpRequest(url, method, headers?, postData?)
maxRedirects?: number         // forwarded to ResolvingHttpRequest if set
get totalBytes(): number
get requestedBytes(): number
resolve(): Promise<http.IncomingMessage>
```

## Downloads

### IHttpDownload

Shared contract for both download types (type-only export).

```ts
onStart?: (download: IHttpDownload) => void
onProgress?: (download: IHttpDownload, chunkSize: number) => void
onComplete?: (download: IHttpDownload) => void
onError?: (download: IHttpDownload, error: Error) => void
get url(): string
get isDownloading(): boolean
get isComplete(): boolean
get totalBytes(): number
get requestedBytes(): number
get downloadedBytes(): number
get targetPath(): string
get timeout(): number; set timeout(value: number)
setHeader(key: string, value: string): void
setHeaders(headers: http.OutgoingHttpHeaders): void
start(): void
resume(): void
stop(): void
```

### HttpDownload

Single-file download to disk.

```ts
new HttpDownload(url: string, destinationPath: string)
```

Implements `IHttpDownload`. Notable specifics:
- `start()` truncates (write mode); `resume()` appends and sends a `Range` header
  computed from the existing file size. Throws if already downloading.
- `timeout` (ms) sets a per-socket inactivity timeout; `0` disables it.
- `setHeader` / `setHeaders` set request headers (insertion order preserved).
- Counters: `totalBytes` (full resource), `requestedBytes` (this request's slice),
  `downloadedBytes` (received so far).

### MultiStreamHttpDownload

Parallel segmented download. Implements `IHttpDownload` plus segment controls.
Requires server `Accept-Ranges: bytes`.

```ts
new MultiStreamHttpDownload(url: string, destinationPath: string)

// Aggregate callbacks (from IHttpDownload): onStart, onProgress, onComplete, onError
onStreamStart?: (stream: Stream) => void
onStreamComplete?: (stream: Stream) => void
onStreamError?: (stream: Stream, error: Error) => void
onStreamJoin?: (download: IHttpDownload) => void

get streams(): Stream[]
get streamCount(): number; set streamCount(value)        // segments; min 1; can't change while downloading
get maxSimultaneousStreams(): number; set maxSimultaneousStreams(value)  // concurrency cap; min 1; raising mid-run starts more
get completedStreamCount(): number
// plus all IHttpDownload members (timeout setter fans out to every segment)
```

- A non-`HttpError` segment failure retries after 5 s; an `HttpError` aborts the
  whole download. On completion, `.part<n>` files are concatenated and removed.

### Stream

One byte-range segment of a `MultiStreamHttpDownload`.

```ts
new Stream(download: IHttpDownload, index: number, start: number, end: number)
readonly download, index, start, end
shouldSkip: boolean           // segment already complete on disk
resumeAt: number              // epoch ms when a paused segment may retry
isResuming: boolean
get isPaused(): boolean       // resumeAt > 0
get isDownloading / isComplete / targetPath / downloadedBytes  // delegate to download
get totalBytes(): number      // segment size = end - start + 1
```

### HttpDownloadProgress

Throughput meter over any `IHttpDownload`.

```ts
new HttpDownloadProgress(httpDownload: IHttpDownload, refreshInterval = 100, callbackInterval = 1000)
onProgress?: (current: number, total: number) => void
get bytesPerSecond(): number
start(): void                 // throws if already running
stop(): void                  // resets counters; called automatically when the download ends
```

### IHttpDownloadProgress

Type-only contract for a throughput meter.

```ts
get bytesPerSecond(): number
```

## Responses

### HttpResponseReader

Buffers a response body and decodes it to a string.

```ts
new HttpResponseReader()
readData(response: http.IncomingMessage): Promise<string>
```

- Reverses `content-encoding` for `br`, `gzip`, `deflate`, including chained
  encodings (decompressed in reverse order). Rejects on non-buffer data, early
  close, or stream error. An absent `content-encoding` returns the raw string.

### HttpResponseSize

Value object describing a response's size; built via a static parser.

```ts
new HttpResponseSize(totalBytes, contentLength, start, end)
static parse(response: http.IncomingMessage): HttpResponseSize
readonly totalBytes, contentLength, start, end
```

- `parse` handles `200` (from `content-length`) and `206` (from `content-range`,
  validated against `content-length`); any other status throws.

## HTTP Primitives

### HttpError

```ts
new HttpError(statusCode: number, statusMessage: string)  // extends Error
readonly statusCode, statusMessage
// message: `HTTP Error <code>: <message>`, name: 'HttpError'
```

Raised for `>= 400` responses; treated as a fatal error by multi-stream downloads.

### HttpHeaderUtil

Static helpers for header objects (case-insensitive on read).

```ts
static getHeader(headers, key): string | undefined
static setHeader(headers, key, value): void      // removes existing variants first
static removeHeader(headers, key): void          // removes key and its lowercase form
static mergeHeaders(headers, newHeaders): void
static normalizeHeaders(headers): http.IncomingHttpHeaders   // lowercases all keys
```

### HttpMethod

const-object enum (not a TS `enum`). Both a value and a type:

```ts
HttpMethod.GET | HEAD | POST | PUT | DELETE | CONNECT | OPTIONS | TRACE | PATCH
```

### HttpProtocol

```ts
HttpProtocol.Http   // 'http:'
HttpProtocol.Https  // 'https:'
```

### HttpStatusCode

The status codes the toolkit acts on (success, redirect, range-related):

```ts
NO_CONNECTION(0), OK(200), PARTIAL_CONTENT(206),
MULTIPLE_CHOICES(300), MOVED_PERMANENTLY(301), FOUND(302), SEE_OTHER(303),
TEMPORARY_REDIRECT(307), PERMANENT_REDIRECT(308),
BAD_REQUEST(400), REQUESTED_RANGE_NOT_SATISFIABLE(416)
```

## Support

### HttpFormatter

```ts
static formatBytes(bytes: number): string   // e.g. 1536 -> "1.50 KB"
```

- `<= 0` returns `"0 Bytes"`. Units: Bytes/KB/MB/GB/TB, clamped to TB beyond range.

### TimeoutError

```ts
new TimeoutError()   // extends Error; message 'Connection timeout', name 'TimeoutError'
```

Raised on socket inactivity timeout in `HttpDownload`; non-fatal (retryable) in
multi-stream downloads.

> Note: `FileSystem` (`src/support/FileSystem.ts`) is intentionally **not**
> exported. It is internal plumbing for the download code.
