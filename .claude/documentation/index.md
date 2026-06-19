# Documentation Index

Quick reference to the knowledge base. Read the file that matches your task.

## [overview.md](overview.md)

Purpose, tech stack, project layout, public API surface, and core commands.

**Use when:**

- Getting oriented for the first time
- Looking up build/test/lint commands or the directory layout

## [architecture.md](architecture.md)

How the request pipeline, download orchestration, response decoding, and `IHttpDownload` polymorphism fit together, with data flow and the callback model.

**Use when:**

- Tracing how a request or download flows through the system
- Working on multi-stream downloads, segment lifecycle, or the layered `HttpRequest` design

## [api-reference.md](api-reference.md)

Member-level reference for every public export from `src/index.ts`: classes, interfaces, enums, with constructors, methods, properties, and callbacks.

**Use when:**

- Looking up a specific class, method, enum, or callback shape
- Confirming what is publicly exported

## [code-style.md](code-style.md)

Naming, OOP, enum, accessibility, formatting, and import conventions, plus the ESLint/dprint rules that enforce them.

**Use when:**

- Writing or editing source to match conventions
- Resolving a lint/format error or adding a const-object enum / class file

## [development.md](development.md)

How to build, type-check, lint, format, and publish: dual tsconfig setup, dual ESM/CJS build, and common pitfalls.

**Use when:**

- Running or debugging the build, typecheck, or publish flow
- Configuring tsdown or hitting a build/export-validation pitfall

## [testing.md](testing.md)

How the test suite is structured and run: the `node:test` runner via tsx, test helpers and doubles, and naming/comment conventions.

**Use when:**

- Writing or running tests
- Using `TestHelper` / `FakeHttpDownload` doubles or following test conventions
