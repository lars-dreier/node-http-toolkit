# Project Overview

`node-http-toolkit` — an HTTP client + file-download library for Node.js (≥18),
built on Node core only (`http`, `https`, `zlib`, `fs`). Two concerns: issuing
requests and reading/decoding their responses, and downloading URLs to disk
(single-stream or segmented/parallel). The public surface is the `src/index.ts`
barrel; classes are grouped under `src/{http,request,response,download,support}/`
and detailed in [api-reference.md](api-reference.md) / [architecture.md](architecture.md).

Request / response:

- `HttpRequest` — perform an HTTP/HTTPS request (GET or POST-with-body) and obtain
  the raw response.
- `ResolvingHttpRequest` / `AsyncResolvingHttpRequest` — wrap `HttpRequest` with
  status-code resolution: redirect following (capped), `200`/`206` handling, and
  content-length / content-range parsing.
- `HttpResponseReader` — read and decompress (`br`/`gzip`/`deflate`) a response body.

Downloads:

- `HttpDownload` — download a URL to a file with progress callbacks, resume
  (HTTP `Range`), per-socket timeout, and custom headers.
- `MultiStreamHttpDownload` (+ `Stream`) — segmented/parallel download: split a file
  into byte-range streams, throttle concurrency, retry failed streams, then join.
- `HttpDownloadProgress` — throughput meter (bytes/sec) over an `IHttpDownload`.

Support types:

- `HttpError` — error carrying status code + message. `TimeoutError` — socket timeout.
- `HttpHeaderUtil` — case-insensitive header get/set/remove/merge.
- `HttpFormatter` — byte → human-readable string. `HttpResponseSize` — size parsing.
- `HttpMethod` / `HttpStatusCode` / `HttpProtocol` — const-object enums.
- `IHttpDownload` / `IHttpDownloadProgress` — interfaces decoupling the download code.

Internally, `src/support/FileSystem.ts` provides the small file helper
`MultiStreamHttpDownload` needs (join/exists/create/size/remove); it is plumbing and
not part of the public barrel.

The package is authored in ESM TypeScript (source uses `.ts` import specifiers,
rewritten on emit) and is built with **tsdown** into dual **ESM + CommonJS** outputs
plus type declarations, consumable from both `import` and `require`.
