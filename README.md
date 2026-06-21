# node-http-toolkit

File downloads and HTTP requests for Node.js, built on the `http`/`https`/`zlib`
built-ins with no runtime dependencies.

- Download a URL to disk, and resume an interrupted download.
- Split one file into byte-range segments and download them in parallel, with a
  concurrency cap and per-segment retry.
- Follow redirects and reject on HTTP error responses.
- Read a response body with `br`/`gzip`/`deflate` decompression.
- Report download throughput in bytes per second.

Ships as a dual ESM/CJS package with TypeScript types.

## Requirements

Node.js >= 18.

## Install

```sh
npm install node-http-toolkit
```

```ts
// ESM
import { HttpDownload, MultiStreamHttpDownload } from "node-http-toolkit";
```

```js
// CommonJS
const { HttpDownload, MultiStreamHttpDownload } = require("node-http-toolkit");
```

## Downloading

### A single file

```ts
import { HttpDownload } from "node-http-toolkit";

const download = new HttpDownload("https://example.com/large.zip", "./large.zip");

download.onProgress = (d) => console.log(`${d.downloadedBytes} / ${d.totalBytes}`);
download.onComplete = () => console.log("done");
download.onError = (_d, error) => console.error(error);

download.start();
```

`resume()` continues an interrupted download instead of restarting it, sending a
`Range` header computed from the bytes already on disk:

```ts
download.resume();
```

### In parallel segments

`MultiStreamHttpDownload` splits one file into byte-range segments and fetches
them concurrently. The server must advertise `Accept-Ranges: bytes`.

```ts
import { MultiStreamHttpDownload } from "node-http-toolkit";

const download = new MultiStreamHttpDownload("https://example.com/large.zip", "./large.zip");
download.streamCount = 8;            // segments to split into
download.maxSimultaneousStreams = 4; // how many run at once

download.onComplete = () => console.log("done");
download.start();
```

### Measuring throughput

`HttpDownloadProgress` wraps any download and reports bytes per second.

```ts
import { HttpDownload, HttpDownloadProgress, HttpFormatter } from "node-http-toolkit";

const download = new HttpDownload("https://example.com/large.zip", "./large.zip");
const progress = new HttpDownloadProgress(download);

progress.onProgress = (current, total) => {
  console.log(`${current}/${total} — ${HttpFormatter.formatBytes(progress.bytesPerSecond)}/s`);
};

progress.start();
download.start();
```

Set request headers on a download with `setHeader` / `setHeaders` (for example an
`Authorization` header) before calling `start()`.

## Requests

`AsyncResolvingHttpRequest` follows redirects and rejects on HTTP errors;
`HttpResponseReader` buffers the response and applies any `content-encoding`.

```ts
import { AsyncResolvingHttpRequest, HttpResponseReader } from "node-http-toolkit";

const request = new AsyncResolvingHttpRequest("https://example.com", "GET", {
  Authorization: "Bearer <token>",
});
const response = await request.resolve();
const body = await new HttpResponseReader().readData(response);
```

Headers passed to the constructor are sent in the order given; no headers are
added automatically.

## API

Exported from the package barrel:

- **Downloads** — `HttpDownload`, `MultiStreamHttpDownload`, `HttpDownloadProgress`,
  `Stream`, and the type-only `IHttpDownload` / `IHttpDownloadProgress` contracts.
- **Requests** — `AsyncResolvingHttpRequest` (Promise-based),
  `ResolvingHttpRequest` (callback-based), `HttpRequest` (raw, no status
  handling).
- **Responses** — `HttpResponseReader` (buffer + decompress), `HttpResponseSize`
  (parse `content-length` / `content-range`).
- **Supporting** — `HttpError`, `TimeoutError`, `HttpHeaderUtil`, `HttpFormatter`,
  and the `HttpMethod` / `HttpProtocol` / `HttpStatusCode` constants.

## License

ISC © Lars Dreier
