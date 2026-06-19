# Architecture

Built only on Node core (`http`, `https`, `zlib`, `fs`, `path`, `util`) — no runtime
dependencies. Five layers, each importing only from layers below it:
`download → request → response → http → support`. Collaborators are passed through
constructors (`new Stream(download, ...)`, `new HttpDownloadProgress(download)`), so
the two seams that vary — the request transport and the download contract — are
swappable: `AsyncResolvingHttpRequest` is the single entry the download layer uses to
fetch, and `IHttpDownload` is the interface every download-consuming class depends on.

Concurrency is callback- and timer-driven, not stream-pipeline-driven: requests
deliver via `onResolve`/`onError`, downloads via `on*` lifecycle hooks, and
`MultiStreamHttpDownload`/`HttpDownloadProgress` drive work from `setInterval` pollers.
There is no shared mutable state between instances; each download owns its own segments,
sets, and timers.

## Layers

```
download/   HttpDownload, MultiStreamHttpDownload, Stream, HttpDownloadProgress
            IHttpDownload, IHttpDownloadProgress          (orchestration + I/O)
   |
request/    HttpRequest -> ResolvingHttpRequest -> AsyncResolvingHttpRequest
   |
response/   HttpResponseReader, HttpResponseSize           (interpret a response)
   |
http/       HttpMethod, HttpProtocol, HttpStatusCode,      (primitives + errors)
            HttpHeaderUtil, HttpError
   |
support/    HttpFormatter, TimeoutError, FileSystem        (leaf utilities)
```

`support/FileSystem.ts` is **internal plumbing** — used by `MultiStreamHttpDownload`
but deliberately not re-exported from `src/index.ts`.

## Request pipeline

Three classes form a deliberate chain, each adding one concern:

1. **`HttpRequest`** — performs exactly one HTTP/HTTPS request and resolves with the
   raw, undecoded `http.IncomingMessage`. Chooses `http`/`https` and `get`/`request`
   based on URL protocol and method. Sends headers in insertion order, giving the
   caller full control of the header block. No redirect/status logic.
2. **`ResolvingHttpRequest`** — drives an `HttpRequest` to a *usable* response:
   follows redirects (capped by `maxRedirects`, default 10), treats `200`/`206` as
   success while parsing `content-length`/`content-range` into `totalBytes` /
   `requestedBytes`, and surfaces 4xx/5xx and unexpected codes as errors. Delivers
   results through **`onResolve` / `onError` callbacks** (not a promise). 301/302/303
   downgrade the method to GET; 307/308 preserve the original method.
3. **`AsyncResolvingHttpRequest`** — thin promise adapter over
   `ResolvingHttpRequest`. Wires the callbacks to `resolve`/`reject` and re-exposes
   `totalBytes` / `requestedBytes`. **This is the form the download layer consumes.**

This callback-core + promise-wrapper split is intentional: the callback core keeps
redirect recursion straightforward; the wrapper gives consumers `async/await`.

## Response interpretation

- **`HttpResponseSize.parse(response)`** — static parser turning status code +
  headers into `{ totalBytes, contentLength, start, end }`. `200` → content-length;
  `206` → parses `content-range` and validates the computed length against
  `content-length`. The download layer uses this instead of reading headers inline.
- **`HttpResponseReader`** — buffers a body to completion and decodes it to a string,
  transparently reversing `br`/`gzip`/`deflate`, including **chained** encodings
  (decompresses in reverse order of the `content-encoding` list).

## Download layer

Both downloaders implement **`IHttpDownload`** (url, byte counts, timeout, lifecycle
callbacks, `start`/`resume`/`stop`). This interface is the decoupling seam:
`HttpDownloadProgress` and `MultiStreamHttpDownload`'s segments depend on the
interface, not the concrete class — so a `Stream` segment, a real download, or a
`FakeHttpDownload` (tests) are interchangeable.

- **`HttpDownload`** — one URL → one file. Resumes via a `Range` request computed from
  the existing file size, supports a per-socket inactivity timeout (`TimeoutError`),
  pipes the response into a write stream (`w` for `start`, `a` for `resume`).
- **`MultiStreamHttpDownload`** — segmented/parallel download. Flow:
  1. `prepareDownload` issues one request, requires `Accept-Ranges: bytes`, reads
     total size, and builds `Stream` segments (one `HttpDownload` each, with a
     `Range` header and a `.partN` target file).
  2. Resume detection: existing `.partN` files sized == segment ⇒ skipped; oversized
     ⇒ deleted; partial ⇒ resumed.
  3. `startStreams` admits up to `maxSimultaneousStreams` concurrently.
  4. Transient stream failures pause the stream for `STREAM_ERROR_DELAY` (5 s) and are
     retried by a `STREAM_CHECK_INTERVAL` (500 ms) poller; `HttpError` is **fatal**
     (`isFatalError`) and aborts the whole download.
  5. When all segments complete, `joinStreams` concatenates the `.partN` files into the
     destination (via `FileSystem.joinFiles`) and deletes the parts.
  - Extra callbacks beyond `IHttpDownload`: `onStreamStart/Complete/Error/Join`.
- **`HttpDownloadProgress`** — throughput meter over any `IHttpDownload`. Two timers:
  a fast refresh interval recomputes bytes/sec (sampled per ≥1 s window), a slower
  callback interval emits `onProgress(current, total)`. Stops itself once the download
  is no longer downloading.

## Error model

- **`HttpError`** (status code + message) — failure responses; treated as fatal by the
  multi-stream retry logic.
- **`TimeoutError`** — socket inactivity timeout.
- Both set `this.name`; both extend `Error`.

## Cross-cutting

- **`HttpHeaderUtil`** — case-insensitive header get/set/remove/merge/normalize, used
  everywhere headers are manipulated (e.g. building `Range` headers).
- **Const-object enums** (`HttpMethod`/`HttpProtocol`/`HttpStatusCode`) are the only
  "enum" mechanism (TS `enum` is banned by ESLint).
