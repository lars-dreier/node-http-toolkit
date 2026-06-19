# Testing

TDD is a core project value. Tests live under `test/`, mirroring `src/` (e.g.
`test/request/HttpRequest.test.ts` ↔ `src/request/HttpRequest.ts`).

## Stack

- **Runner:** Node's built-in `node:test` (`describe`/`it`/`afterEach`), assertions via
  `node:assert/strict`.
- **Executor:** `tsx` runs the `.ts` tests directly — no build step.
- **Type-checking:** the test tree is outside the build `tsconfig.json` (`rootDir:
  ./src`). `tsconfig.test.json` widens the program to `src` + `test` so `tsc --noEmit`
  and ESLint's type-aware rules cover tests.

## Commands

```bash
npm test               # tsx --test "test/**/*.test.ts"
npm run test:watch     # re-run on change
npm run test:coverage  # with --experimental-test-coverage
```

## Conventions

- **Given / When / Then** comments structure each test body:
  ```typescript
  it('issues a GET and resolves with the raw response ...', async () => {
  	// Given a loopback server on a non-default port
  	...
  	// When a GET is issued to that port
  	...
  	// Then the request reaches the port and the raw body comes back
  	...
  });
  ```
- Some test names carry an issue reference, e.g. `... [#4]`, tying the test to the bug
  it pins. Add one when a test is written to lock a specific fixed defect.
- Real network paths are exercised against a **loopback server on an ephemeral port**,
  closed in `afterEach`.

## Test doubles (`test/`)

- **`TestHelper`** (static) — shared fixtures:
  - `stubResponse(statusCode, headers)` — minimal `IncomingMessage` for header/status
    paths.
  - `streamResponse(passThrough, headers)` — adorns a stream to stand in for a streamed
    response; drive the body through the same `PassThrough`.
  - `startLoopbackServer(handler)` → `{ server, url }` on `127.0.0.1:0`.
  - `readBody(message)` — collect a stream to a string.
- **`FakeHttpDownload implements IHttpDownload`** — hand-written fake with mutable
  public fields and inert control methods, for testing code that depends on the
  download contract (e.g. `HttpDownloadProgress`) without real I/O. Prefer this over
  mocking frameworks; the `IHttpDownload` seam exists precisely for this.

## Guidelines

- Mirror the `src/` path and name files `<Class>.test.ts`.
- Drive behavior through the public API; use the `IHttpDownload` interface and fakes to
  isolate units.
- Close servers/timers in `afterEach` to avoid leaks.
