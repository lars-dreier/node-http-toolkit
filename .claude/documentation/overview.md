---
title: "Project Overview"
description: "What node-http-toolkit is, its tech stack, project layout, public API surface, and the commands to build, test, and lint it."
category: "overview"
tags: ["overview", "stack", "structure", "commands", "public-api"]
last_updated: "2026-06-19T19:03:11Z"
related_docs: ["architecture.md", "api-reference.md", "development.md"]
---

# Project Overview

## Table of Contents
1. [Purpose](#purpose)
2. [Technology Stack](#technology-stack)
3. [Project Layout](#project-layout)
4. [Public API Surface](#public-api-surface)
5. [Zero-Dependency Design](#zero-dependency-design)
6. [Commands at a Glance](#commands-at-a-glance)

---

## Purpose

`node-http-toolkit` is a small HTTP client toolkit for Node.js. It provides three
capabilities, layered on Node's built-in `http`/`https` modules:

- **HTTP requests** — issue a request and get the raw response, follow redirects,
  and interpret status codes and byte-range metadata.
- **File downloads** — download a URL to disk, resume a partial download via an
  HTTP `Range` request, and download a single file in parallel byte-range segments.
- **Response decoding** — buffer a response body and transparently decompress
  `br`, `gzip`, and `deflate` (including chained) content-encodings.

It is a **library**, published to npm as a dual ESM/CJS package. There is no CLI
and no application entry point; consumers import classes from the package barrel.

## Technology Stack

| Concern | Choice | Version | Notes |
|---------|--------|---------|-------|
| Language | TypeScript | 6.0.3 | `strict`, `module: nodenext`, `target: esnext` |
| Runtime | Node.js | >= 18 (build target) | Uses only built-in modules |
| Build | tsdown | 0.22.2 | Unbundled dual ESM/CJS + `.d.ts` |
| Test runner | `node:test` via tsx | tsx 4.22.4 | No Jest/Vitest; built-in runner |
| Lint | ESLint + typescript-eslint | 10.5.0 / 8.61.0 | Flat config, type-aware rules |
| Format | dprint | 0.54.0 | Owns all layout; tabs, width 120 |
| Export check | `@arethetypeswrong/cli` | 0.18.3 | Validates published type exports |

Source is authored with `.ts` extensions in relative imports
(`allowImportingTsExtensions` + `rewriteRelativeImportExtensions`); `tsc`/tsdown
rewrite them to `.js` on emit. See [code-style.md](code-style.md).

## Project Layout

```
src/
  index.ts          Public barrel — the only entry point consumers import
  download/         File download orchestration
    HttpDownload.ts            Single-file download (resume via Range)
    MultiStreamHttpDownload.ts Parallel byte-range segmented download
    HttpDownloadProgress.ts    Throughput meter over any IHttpDownload
    Stream.ts                  One byte-range segment of a multi-stream download
    IHttpDownload.ts           Download contract (shared by both downloads)
    IHttpDownloadProgress.ts   Throughput-meter contract
  request/          Request pipeline (layered, see architecture.md)
    HttpRequest.ts             Raw transport (http/https .get/.request)
    ResolvingHttpRequest.ts    Redirects + status/byte-count handling (callbacks)
    AsyncResolvingHttpRequest.ts  Promise wrapper over ResolvingHttpRequest
  response/         Response interpretation
    HttpResponseReader.ts      Buffer body + decode br/gzip/deflate
    HttpResponseSize.ts        Parse size from status code + headers
  http/             HTTP primitives
    HttpError.ts               Error carrying status code + message
    HttpHeaderUtil.ts          Header get/set/remove/merge/normalize helpers
    HttpMethod.ts              const-object enum of HTTP verbs
    HttpProtocol.ts            const-object enum: http:/https:
    HttpStatusCode.ts          const-object enum of acted-on status codes
  support/          Cross-cutting helpers
    HttpFormatter.ts           Byte count -> human-readable size string
    FileSystem.ts              File helpers (internal; not exported)
    TimeoutError.ts            Error for inactivity timeout
test/               Mirrors src/ one-to-one; node:test specs + helpers
dist/               Build output (gitignored)
```

The folder names are lowercase; class files are PascalCase and match the class
they export. Each file holds exactly one primary class (enforced by ESLint).

## Public API Surface

Everything consumers can use is re-exported from `src/index.ts`. Anything not in
that barrel (for example `FileSystem`) is internal:

| Export | Kind | Role |
|--------|------|------|
| `HttpRequest` | class | Single raw request, returns undecoded response |
| `ResolvingHttpRequest` | class | Callback-based request with redirect/status handling |
| `AsyncResolvingHttpRequest` | class | Promise wrapper over `ResolvingHttpRequest` |
| `HttpDownload` | class | Single-file download |
| `MultiStreamHttpDownload` | class | Parallel segmented download |
| `HttpDownloadProgress` | class | Throughput meter |
| `Stream` | class | One segment of a multi-stream download |
| `HttpResponseReader` | class | Buffer + decompress a response body |
| `HttpResponseSize` | class | Parse byte sizes from a response |
| `HttpFormatter` | class | Format a byte count as a size string |
| `HttpError` | class | Error with `statusCode` / `statusMessage` |
| `TimeoutError` | class | Error for connection inactivity timeout |
| `HttpHeaderUtil` | class | Static header manipulation helpers |
| `IHttpDownload` | interface (type-only) | Download contract |
| `IHttpDownloadProgress` | interface (type-only) | Meter contract |
| `HttpMethod` | const-object enum | HTTP verbs |
| `HttpProtocol` | const-object enum | URL schemes |
| `HttpStatusCode` | const-object enum | Status codes |

Full member-level detail is in [api-reference.md](api-reference.md).

## Zero-Dependency Design

`package.json` lists **no `dependencies`** — only `devDependencies`. All runtime
behavior is built on Node built-ins: `http`, `https`, `zlib`, `fs`, `path`,
`util`, `url`. This keeps the install footprint minimal and means the toolkit has
no transitive supply-chain surface at runtime. `sideEffects: false` lets bundlers
tree-shake unused exports.

## Commands at a Glance

| Command | What it does |
|---------|--------------|
| `npm run build` | Build dist (tsdown: ESM + CJS + types) |
| `npm run dev` | Build in watch mode |
| `npm run typecheck` | `tsc --noEmit` (src only) |
| `npm test` | Run all `test/**/*.test.ts` with the node:test runner |
| `npm run test:coverage` | Tests with experimental coverage |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` / `lint:fix` | ESLint (correctness + conventions) |
| `npm run format` / `format:check` | dprint (layout) |
| `npm run check:exports` | Validate published type exports (attw) |
| `npm run prepublishOnly` | typecheck + build + check:exports |

See [development.md](development.md) for how these fit together and the
build/typecheck split between `tsconfig.json` and `tsconfig.test.json`.