---
title: "Architecture"
description: "How the request pipeline, download orchestration, response decoding, and the IHttpDownload polymorphism fit together, including data flow and the callback model."
category: "architecture"
tags: ["architecture", "request-pipeline", "downloads", "multi-stream", "callbacks", "data-flow"]
last_updated: "2026-06-19T19:03:11Z"
related_docs: ["overview.md", "api-reference.md"]
---

# Architecture

## Table of Contents
1. [Shape of the System](#shape-of-the-system)
2. [The Request Pipeline](#the-request-pipeline)
   - [Layer 1: HttpRequest](#layer-1-httprequest)
   - [Layer 2: ResolvingHttpRequest](#layer-2-resolvinghttprequest)
   - [Layer 3: AsyncResolvingHttpRequest](#layer-3-asyncresolvinghttprequest)
3. [Single-File Download](#single-file-download)
4. [Multi-Stream Download](#multi-stream-download)
   - [Segment Lifecycle](#segment-lifecycle)
   - [Concurrency and Retry](#concurrency-and-retry)
   - [Joining Segments](#joining-segments)
5. [Response Interpretation](#response-interpretation)
6. [The IHttpDownload Polymorphism](#the-ihttpdownload-polymorphism)
7. [Callback / Event Model](#callback--event-model)
8. [Error Model](#error-model)

---

## Shape of the System

There is no framework, dependency-injection container, or global state. The
architecture is a set of plain classes that compose by construction: a higher
layer instantiates the layer below it and wires callbacks. Dependencies always
point downward (downloads depend on the request pipeline, never the reverse).

```
              consumers
                 |
   HttpDownloadProgress (meter)        Stream (segment)
                 |                          |
        +--------+--------------------------+
        |                                   |
   HttpDownload  <----- depends on -----  MultiStreamHttpDownload
        |                                   |  (composes many HttpDownload)
        +------------------+----------------+
                           |
              AsyncResolvingHttpRequest        HttpResponseSize
                           |                    HttpResponseReader
                  ResolvingHttpRequest
                           |
                      HttpRequest
                           |
                   node:http / node:https
```

`http/` (errors, header util, enums) and `support/` (formatter, filesystem,
timeout error) are leaf utilities consumed across the layers.

## The Request Pipeline

A request is built from three classes, each adding one concern. This is a
deliberate separation: raw transport, protocol-level resolution, and Promise
ergonomics are independently testable.

### Layer 1: HttpRequest

`request/HttpRequest.ts` is the thinnest layer. It performs **one** HTTP or HTTPS
request and resolves with the **raw, undecoded** `http.IncomingMessage`. It does
not look at the status code.

Key behaviors:
- Picks `https` vs `http` by inspecting `url.protocol` against `HttpProtocol`;
  throws `Unsupported protocol` for anything else.
- Picks `.get()` for `GET` and `.request()` for every other method. For non-GET
  it writes `postData` (if present) and calls `request.end()` — without this a
  `PUT`/`DELETE` would hang (regression covered by tests tagged `[#6]`).
- Sends headers **exactly as supplied, in insertion order**, giving the caller
  full control of the header block (test: "preserves header insertion order").
- Surfaces transport errors via the Promise rejection (`request.once('error')`).

### Layer 2: ResolvingHttpRequest

`request/ResolvingHttpRequest.ts` drives an `HttpRequest` to a *usable* response.
It is **callback-based** (`onResolve` / `onError`), not Promise-based. Its job is
status-code interpretation:

- `200 OK` → reads `content-length` into `totalBytes`/`requestedBytes`, resolves.
- `206 Partial Content` → parses `content-range` (`bytes start-end/total`) into
  `totalBytes` (total) and `requestedBytes` (`end - start + 1`), resolves.
- `301/302/303` → redirect, re-issued as **GET** (per HTTP semantics).
- `307/308` → redirect, re-issued with the **original method**.
- `>= 400` → `handleErrorResponse`, raising an `HttpError`.
- `300..399` or `< 200` (unhandled) → generic `Unhandled status code` error.

Redirects are capped by `maxRedirects` (default 10) and resolved against the
current URL with `new URL(location, currentUrl)`, so relative `Location` headers
work. The redirect counter and current URL are instance state.

### Layer 3: AsyncResolvingHttpRequest

`request/AsyncResolvingHttpRequest.ts` is a Promise wrapper over layer 2. It
constructs a `ResolvingHttpRequest`, forwards an optional `maxRedirects`, maps
`onResolve` → `resolve` and `onError` → `reject`, and exposes `totalBytes` /
`requestedBytes` (read through to the inner request). **This is the class the
download code actually uses.**

## Single-File Download

`download/HttpDownload.ts` downloads one URL to one file. Flow:

1. `start()` (fresh, `w` flags) or `resume()` (append, `a` flags) sets state and
   calls `sendRequest`.
2. `resume()` computes the on-disk file size as the offset, then builds/adjusts
   the `Range` header. If a caller-supplied `Range` already fully covers what's on
   disk, it short-circuits to `onFileComplete`.
3. `sendRequest` awaits an `AsyncResolvingHttpRequest`, parses size with
   `HttpResponseSize`, then pipes the response into an `fs.WriteStream`.
4. `data` events accumulate `downloadedBytes` and fire `onProgress`. The
   write-stream `close` event triggers `onFileComplete`.
5. An optional per-socket inactivity `timeout` raises a `TimeoutError`.
6. `stop()` pauses/destroys the response and clears the downloading flag.

`HttpDownload` implements `IHttpDownload`.

## Multi-Stream Download

`download/MultiStreamHttpDownload.ts` downloads a single file in parallel by
splitting it into byte-range segments, each fetched by its own `HttpDownload`. It
also implements `IHttpDownload`, so it is a drop-in for the single-file case from
the consumer's perspective. **It requires a server that advertises
`Accept-Ranges: bytes`** — `prepareDownload` throws otherwise.

### Segment Lifecycle

- `prepareDownload` issues one request to learn `totalBytes` and confirm range
  support, then `prepareStreams`/`createStreams` slice `[0, totalBytes)` into
  `streamCount` chunks. Each chunk becomes a `Stream` wrapping an `HttpDownload`
  whose target is `<destination>.part<index>` and whose `Range` header is set.
- For an existing `.part` file: if its size equals the segment size, the segment
  is marked `shouldSkip` and counted complete; if it exceeds the expected size the
  part file is deleted (corrupt) and `onStreamError` fires; otherwise its bytes
  are subtracted from `requestedBytes` so resume accounting is correct.

### Concurrency and Retry

- `maxSimultaneousStreams` caps how many segments run at once. `startStreams`
  fills available slots from the pending segments, respecting `isDownloading`,
  `isComplete`, `isPaused`, and `shouldSkip`.
- Raising `maxSimultaneousStreams` mid-download immediately starts more segments.
- A non-fatal segment error (anything **not** an `HttpError`) pauses that segment
  for `STREAM_ERROR_DELAY` (5000 ms) and frees its slot. A polling interval
  (`STREAM_CHECK_INTERVAL`, 500 ms) flips paused segments back to resumable once
  their delay elapses and refills slots.
- A **fatal** error (`HttpError`) stops the whole download and fires `onError`.
  See [Error Model](#error-model).

### Joining Segments

When every segment completes, `completeDownload` calls `joinStreams`, which uses
`FileSystem.joinFiles` to concatenate the `.part` files into the destination in
order, then deletes the parts. `onStreamJoin` fires just before the join,
`onComplete` after.

## Response Interpretation

Two classes read meaning off a response:

- **`HttpResponseSize`** (`response/HttpResponseSize.ts`) — a value object with a
  static `parse(response)`. For `200` it derives size from `content-length`; for
  `206` it parses `content-range` and **validates** the parsed length against
  `content-length` (throws on mismatch). Any other status throws. Used by both
  download classes to learn sizes.
- **`HttpResponseReader`** (`response/HttpResponseReader.ts`) — buffers the body
  to completion and decodes it to a string, reversing `content-encoding`. It
  supports chained encodings by splitting the header on `,` and decompressing in
  reverse order (`br` → brotli, `gzip` → gunzip, `deflate` → inflate). It guards
  against a body that is not a `Buffer`, a stream that closes before `end`, and
  stream errors, deduplicating via a `_hasError` latch.

`HttpResponseSize` parses sizes the same way `ResolvingHttpRequest` does (same
content-range regex); the two were written for different layers (download sizing
vs. request resolution) and have not been unified.

## The IHttpDownload Polymorphism

`download/IHttpDownload.ts` is the central abstraction. Both `HttpDownload` and
`MultiStreamHttpDownload` implement it, and `HttpDownloadProgress` depends only on
it. That is why a throughput meter can wrap either download type unchanged, and
why `MultiStreamHttpDownload` can hold a collection of `IHttpDownload` segments
(through `Stream.download`). `FakeHttpDownload` in the test tree implements the
same interface to stand in for real I/O.

The interface covers identity (`url`, `targetPath`), progress counters
(`totalBytes`, `requestedBytes`, `downloadedBytes`), lifecycle flags
(`isDownloading`, `isComplete`), `timeout`, header setters, the lifecycle
callbacks, and the `start`/`resume`/`stop` controls.

## Callback / Event Model

The library uses **assignable callback properties**, not an `EventEmitter`. A
consumer sets `download.onProgress = (d, chunk) => ...`. Conventions:

- Callbacks are optional and invoked with optional chaining (`this.onX?.(...)`).
- Download callbacks pass the `IHttpDownload` itself as the first argument so a
  shared handler can read live state.
- `MultiStreamHttpDownload` adds segment-level callbacks (`onStreamStart`,
  `onStreamComplete`, `onStreamError`, `onStreamJoin`) alongside the aggregate
  ones. It wires each child `HttpDownload`'s callbacks to its own aggregation
  logic in `createStream`.
- `HttpDownloadProgress` runs two timers: a short `refreshInterval` (default
  100 ms) that recomputes `bytesPerSecond` roughly once per second, and a
  `callbackInterval` (default 1000 ms) that fires `onProgress(current, total)`.
  It stops itself when the underlying download stops downloading.

## Error Model

Two custom error types, both setting `name` explicitly so `instanceof` and name
checks both work:

- **`HttpError`** (`http/HttpError.ts`) — carries `statusCode` and
  `statusMessage`; raised by `ResolvingHttpRequest` for `>= 400` responses.
- **`TimeoutError`** (`support/TimeoutError.ts`) — raised on socket inactivity in
  `HttpDownload`.

`MultiStreamHttpDownload.isFatalError` treats `HttpError` as fatal (no point
retrying a `404`) and everything else (transport/stream errors, timeouts) as
transient and retryable. This is the single decision point that distinguishes
"retry the segment" from "abort the whole download".
