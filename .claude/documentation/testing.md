---
title: "Testing Guide"
description: "How the test suite is structured and run: the node:test runner via tsx, the test helpers and doubles, and the naming/comment conventions."
category: "guide"
tags: ["testing", "node-test", "tsx", "test-helpers", "conventions"]
last_updated: "2026-06-19T19:03:11Z"
related_docs: ["development.md", "code-style.md"]
---

# Testing Guide

## Table of Contents
1. [Runner and Setup](#runner-and-setup)
2. [Running Tests](#running-tests)
3. [Test Layout](#test-layout)
4. [Test Helpers and Doubles](#test-helpers-and-doubles)
   - [TestHelper](#testhelper)
   - [FakeHttpDownload](#fakehttpdownload)
5. [Conventions](#conventions)
6. [Type-Checking the Test Tree](#type-checking-the-test-tree)

---

## Runner and Setup

Tests use the **built-in `node:test` runner** with `node:assert/strict`,
executed through **tsx** so TypeScript runs without a separate compile step.
There is no Jest, Vitest, Mocha, or assertion library.

```ts
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
```

## Running Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Run all `test/**/*.test.ts` once |
| `npm run test:coverage` | Run with `--experimental-test-coverage` |
| `npm run test:watch` | Re-run on change |

The underlying invocation is `tsx --test "test/**/*.test.ts"`.

## Test Layout

`test/` mirrors `src/` one-to-one. Each source file has a sibling spec under the
matching folder:

```
test/
  TestHelper.ts                 shared fixtures (not a spec)
  download/
    FakeHttpDownload.ts         test double (not a spec)
    Stream.test.ts
  http/
    HttpError.test.ts
    HttpHeaderUtil.test.ts
  request/
    AsyncResolvingHttpRequest.test.ts
    HttpRequest.test.ts
    ResolvingHttpRequest.test.ts
  response/
    HttpResponseReader.test.ts
    HttpResponseSize.test.ts
  support/
    FileSystem.test.ts
    HttpFormatter.test.ts
    TimeoutError.test.ts
```

Specs end in `.test.ts`; support files (`TestHelper.ts`, `FakeHttpDownload.ts`)
do not, so the glob skips them.

## Test Helpers and Doubles

### TestHelper

`test/TestHelper.ts` provides shared builders. Prefer these over hand-rolling
fixtures:

- `stubResponse(statusCode, headers?)` — a minimal `IncomingMessage` (status +
  headers + no-op `destroy`) for code paths that read nothing else.
- `streamResponse(body, headers?)` — adorns a `PassThrough` with headers so it can
  stand in for a streamed response; drive the body through the same `PassThrough`.
- `startLoopbackServer(handler)` — starts a real `http.Server` on an ephemeral
  port (`listen(0)`) and resolves `{ server, url }`. Use for end-to-end request
  tests; **close it in `afterEach`**.
- `readBody(message)` — collects a request/response stream to a string.

The loopback-server pattern (real server on a random port, closed in `afterEach`)
is how the request layer is tested without mocking Node's `http`. Example from
`HttpRequest.test.ts`:

```ts
let server: http.Server | undefined;
afterEach(async () => {
  if (server === undefined) return;
  const running = server;
  server = undefined;
  await new Promise<void>((resolve) => running.close(() => resolve()));
});
```

### FakeHttpDownload

`test/download/FakeHttpDownload.ts` is a hand-written double implementing
`IHttpDownload`. Its state fields are **mutable** so a test can set
`downloadedBytes`, `isDownloading`, etc. directly, and its control methods
(`start`/`resume`/`stop`) are inert. Use it to test code that consumes the
download contract (e.g. `HttpDownloadProgress`) without real I/O.

## Conventions

- **Structure:** `describe` per class (and often a nested `describe` per method),
  `it` per behavior.
- **Given/When/Then:** each `it` body carries `// Given`, `// When`, `// Then`
  comments narrating the scenario. Follow this — it is consistent across the suite.
- **Issue markers:** some test names end with `[#N]` referencing the issue/bug the
  test pins (e.g. `flushes a PUT request with a body instead of hanging [#6]`).
  Add the marker when a test guards a specific regression.
- **Async rejection:** use `assert.rejects(promise, /pattern/)` for expected
  failures rather than try/catch.

## Type-Checking the Test Tree

The build `tsconfig.json` has `rootDir: ./src` and must not see test files, so the
test tree is type-checked through a separate **`tsconfig.test.json`** that extends
it, sets `rootDir: .` / `noEmit: true`, and widens `include` to `src` + `test`.

ESLint wires the test tree to that config and **disables
`@typescript-eslint/no-floating-promises` for `test/**`** — `node:test`'s
`describe`/`it` return promises that must not be awaited at the call site, so the
rule would be all false positives there. The rule stays **on** in `src/`, where an
unawaited promise is a real defect. Keep test code inside this carve-out; don't
disable the rule in `src/`.
