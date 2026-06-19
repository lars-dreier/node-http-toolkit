# node-http-toolkit

Zero-dependency HTTP client toolkit for Node.js: requests with full header
control, resumable and parallel file downloads, and automatic response
decoding. Built entirely on Node's built-in `http`/`https`/`zlib` modules.

- **Zero runtime dependencies** — nothing but Node built-ins, so no transitive
  supply-chain surface and a minimal install footprint.
- **Full control over request headers** — set any header freely, individually or
  in bulk; insertion order is preserved and nothing is added behind your back.
- **HTTP requests** — issue a request, follow redirects, and interpret status
  codes and byte-range metadata.
- **File downloads** — download a URL to disk, resume a partial download via an
  HTTP `Range` request, or download a single file in parallel byte-range
  segments.
- **Response decoding** — buffer a response body and automatically decompress
  `br`, `gzip`, and `deflate` (including chained) content-encodings.


Ships as a dual ESM/CJS package with TypeScript types.

## Requirements

Node.js >= 18.

## Install

```sh
npm install node-http-toolkit
```

```ts
// ESM
import { AsyncResolvingHttpRequest, HttpDownload } from "node-http-toolkit";
```

```js
// CommonJS
const { AsyncResolvingHttpRequest, HttpDownload } = require("node-http-toolkit");
```

## Quick start

### Make a request and read the body

`AsyncResolvingHttpRequest` follows redirects and rejects on HTTP errors;
`HttpResponseReader` buffers the response and decompresses it.

```ts
import { AsyncResolvingHttpRequest, HttpResponseReader } from "node-http-toolkit";

const request = new AsyncResolvingHttpRequest("https://example.com", "GET");
const response = await request.resolve();
const body = await new HttpResponseReader().readData(response);

console.log(body);
```

### Set request headers freely

Requests take a headers object as the third constructor argument — set anything
you like, including auth and custom headers. Insertion order is preserved.

```ts
import { AsyncResolvingHttpRequest } from "node-http-toolkit";

const request = new AsyncResolvingHttpRequest("https://example.com", "GET", {
  "Authorization": "Bearer <token>",
  "User-Agent": "my-app/1.0",
  "X-Custom-Header": "value",
});
const response = await request.resolve();
```

Downloads expose the same control after construction via `setHeader` /
`setHeaders`:

```ts
download.setHeader("Authorization", "Bearer <token>");
download.setHeaders({ "User-Agent": "my-app/1.0", "X-Custom-Header": "value" });
```

### Download a file

```ts
import { HttpDownload } from "node-http-toolkit";

const download = new HttpDownload("https://example.com/large.zip", "./large.zip");

download.onProgress = (d) => {
  console.log(`${d.downloadedBytes} / ${d.totalBytes} bytes`);
};
download.onComplete = () => console.log("done");
download.onError = (_d, error) => console.error(error);

download.start();
```

Resume an interrupted download instead of restarting it — `resume()` sends a
`Range` header computed from the bytes already on disk:

```ts
download.resume();
```

### Download in parallel segments

`MultiStreamHttpDownload` splits one file into byte-range segments and fetches
them concurrently. The server must advertise `Accept-Ranges: bytes`.

```ts
import { MultiStreamHttpDownload } from "node-http-toolkit";

const download = new MultiStreamHttpDownload("https://example.com/large.zip", "./large.zip");
download.streamCount = 8;            // number of segments
download.maxSimultaneousStreams = 4; // concurrency cap

download.onComplete = () => console.log("done");
download.start();
```

### Measure throughput

`HttpDownloadProgress` wraps any download and reports bytes per second.

```ts
import { HttpDownload, HttpDownloadProgress, HttpFormatter } from "node-http-toolkit";

const download = new HttpDownload("https://example.com/large.zip", "./large.zip");
const progress = new HttpDownloadProgress(download);

progress.onProgress = (current, total) => {
  const speed = HttpFormatter.formatBytes(progress.bytesPerSecond);
  console.log(`${current}/${total} — ${speed}/s`);
};

progress.start();
download.start();
```

## API

Everything below is exported from the package barrel.

### Requests

| Export | Role |
|--------|------|
| `AsyncResolvingHttpRequest` | Promise-based request with redirect/status handling. **Preferred entry point.** |
| `ResolvingHttpRequest` | Callback-based equivalent (redirects, status codes, byte counters). |
| `HttpRequest` | Single raw request; returns the undecoded response without inspecting status. |

### Downloads

| Export | Role |
|--------|------|
| `HttpDownload` | Single-file download to disk, with `Range`-based resume. |
| `MultiStreamHttpDownload` | Parallel byte-range segmented download. |
| `HttpDownloadProgress` | Throughput meter over any download. |
| `Stream` | One byte-range segment of a multi-stream download. |
| `IHttpDownload` | Type-only download contract. |
| `IHttpDownloadProgress` | Type-only throughput-meter contract. |

### Responses

| Export | Role |
|--------|------|
| `HttpResponseReader` | Buffer a response body and decompress `br`/`gzip`/`deflate`. |
| `HttpResponseSize` | Parse byte sizes (`content-length` / `content-range`) from a response. |

### HTTP primitives

| Export | Role |
|--------|------|
| `HttpError` | Error carrying `statusCode` and `statusMessage` (raised for `>= 400`). |
| `TimeoutError` | Error raised on socket inactivity timeout. |
| `HttpHeaderUtil` | Static, case-insensitive header get/set/remove/merge/normalize helpers. |
| `HttpFormatter` | Format a byte count as a human-readable size (`1536 → "1.50 KB"`). |
| `HttpMethod` | Const-object enum of HTTP verbs. |
| `HttpProtocol` | Const-object enum: `http:` / `https:`. |
| `HttpStatusCode` | Const-object enum of the status codes the toolkit acts on. |

## License

ISC © Lars Dreier
