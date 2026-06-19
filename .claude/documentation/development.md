# Development Workflow

## Project layout

```
src/
  index.ts          # public barrel — the entire exported surface
  http/             # HttpMethod, HttpProtocol, HttpStatusCode, HttpHeaderUtil, HttpError
  request/          # HttpRequest, ResolvingHttpRequest, AsyncResolvingHttpRequest
  response/         # HttpResponseReader, HttpResponseSize
  download/         # HttpDownload, MultiStreamHttpDownload, Stream, HttpDownloadProgress, I*
  support/          # HttpFormatter, TimeoutError, FileSystem (internal)
test/               # mirrors src/; *.test.ts + TestHelper + FakeHttpDownload
dist/               # build output (gitignored), dual ESM+CJS + d.ts
```

## Commands

| Command | What it does |
|---------|--------------|
| `npm run build` | `tsdown` → `dist/` (ESM `.mjs`, CJS `.cjs`, `.d.mts`/`.d.cts`, sourcemaps) |
| `npm run dev` | `tsdown --watch` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `:watch` / `:coverage` | `node:test` via `tsx` (see testing.md) |
| `npm run lint` / `lint:fix` | ESLint (flat config, type-aware) |
| `npm run format` / `format:check` | dprint |
| `npm run check:exports` | `attw --pack .` — verifies the dual-package export map |
| `npm run prepublishOnly` | typecheck → build → check:exports |

## Toolchain roles

- **tsdown** — bundler/emitter. `unbundle: true` (file-per-module output), `dts: true`,
  `format: ['esm','cjs']`, `target: 'node18'`, `clean: true`. Produces the dual package.
- **tsc** — type-checking only (`noEmit` in practice); also the type engine ESLint uses.
- **ESLint** (flat config) — correctness + project invariants (one class/file, explicit
  accessibility, no `enum`, no floating promises). `eslint-config-prettier` runs last to
  disable layout rules so they never fight dprint.
- **dprint** — owns all formatting (see code-style.md).
- **attw** — guards against broken `import`/`require` resolution in `package.json#exports`.

## TypeScript / ESM specifics (important)

- Source uses **`.ts` import specifiers** (`import X from './X.ts'`). This works via
  `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` (TS 5.7+), which
  rewrite `.ts` → `.js` on emit with no postprocessor. **Always write `.ts` in import
  paths** in new source files.
- `verbatimModuleSyntax` is on → use `import type` for type-only imports (the codebase
  does this consistently, e.g. `import type * as http from 'http'`).
- `module: nodenext`, `target: esnext` in tsconfig; tsdown emits to `node18`.
- Strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — expect
  to handle `undefined` from index access (hence `match[1]!` after a successful regex
  match) and to guard optional properties precisely.

## Conventions for the exported surface

- Public classes use `export default`; `src/index.ts` re-exports them as **named**
  exports. Add new public types there. Interfaces are re-exported with `export type`.
- Keep `FileSystem` and other internal helpers **out** of `src/index.ts`.

## What Claude Code can / cannot do here

- **Can:** read/edit source & tests, run build/test/lint/format/typecheck commands.
- **Should:** run `/read-documentation-index` first (per CLAUDE.md), follow TDD, run
  `lint` + `format` + `typecheck` + `test` before declaring work complete, keep the
  barrel and docs in sync when the public API changes.
- **Cannot/should not:** publish to npm, or commit/push unless asked.

## Note on documentation maintenance

Update `architecture.md` / `api-reference.md` when behavior or the public surface
changes. After adding/removing doc files, run `/update-documentation-index`.
