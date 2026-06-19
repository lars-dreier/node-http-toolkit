# Code Style and Best Practices

Layout is owned by **dprint**, correctness/conventions by **ESLint**. Run `npm run
format` and `npm run lint` before considering work done. The conventions below are
either machine-enforced (noted) or established consistently across the codebase.

## Formatting (dprint — enforced)

- **Tabs** for indentation, width 2; line width 120; LF line endings.
- Single quotes; semicolons required; no trailing commas (except multi-line params).
- `nextControlFlowPosition: nextLine` — `else`/`catch`/`finally` go on their own line:
  ```typescript
  if (x) {
  	...
  }
  else {
  	...
  }
  ```

## Naming conventions

- **Folders** lowercase (`http`, `request`, `download`, `support`).
- **Files** PascalCase, one per class, named after the class (`HttpDownload.ts`).
- Prefer **`Http`** over `HTTP` in identifiers.
- Private fields and the constructor's private params use **`_camelCase`** (`_url`,
  `_totalBytes`). Static constants are `UPPER_SNAKE_CASE` (`STREAM_ERROR_DELAY`).

## Structural rules (ESLint — enforced)

- **One class per file** (`max-classes-per-file`, expression classes excepted).
- **Explicit access modifiers** on every member (`explicit-member-accessibility`) — see
  below.
- **No TypeScript `enum`** (`no-restricted-syntax`) — use the const-object pattern.
- **No floating promises** in `src/` (`no-floating-promises`); use `void` to mark an
  intentional fire-and-forget (e.g. `void this.sendRequest(...)`). Disabled in `test/`
  because `node:test` blocks return promises that must not be awaited.

## Idioms used throughout

- **Loose null checks**: `== null` / `!= null` (matches `null` and `undefined`);
  loose `==`/`!=` is also used for value comparisons (e.g. `method != HttpMethod.GET`).
- **Constructor parameter properties** for dependencies/config (`private readonly _url:
  string` in the constructor signature).
- **Callbacks over events** for public lifecycle hooks (`onResolve`, `onProgress`, ...);
  the optional-call form `this.onProgress?.(...)`.
- **Static utility classes** for stateless helpers (`HttpHeaderUtil`, `HttpFormatter`,
  `FileSystem`, `HttpResponseSize.parse`).

## Self-Code Review

After completing any feature or task, always perform a thorough self-review checking:

- Code style and consistency with project conventions
- Type annotations and clarity
- Error handling and edge cases
- Performance considerations
- Documentation completeness
- Test coverage adequacy

## Type Annotations

Use explicit type annotations for variables when the type is not immediately clear from the assignment. This includes:

- Method return values that aren't constructors (e.g., `const items: Item[] = service.getItems()`)
- Complex expressions or calculations (e.g., `const result: boolean = condition1 && condition2`)
- When clarity improves readability (e.g., arrays, union types)
- **NOT needed** when using `new ClassName()` - the type is obvious from the constructor

## Class Documentation

Keep class comments concise and focused on what the class does rather than how it does it. Avoid overly technical
implementation details in favor of clear, simple descriptions of purpose.

## Access Modifiers

Always use explicit access modifiers (public, private, protected) on ALL methods, constructors, and fields. Never omit
access modifiers.

## Enum Patterns

**Const Object Enums**: Use const object pattern instead of TypeScript enums for better performance and cleaner
generated code. These are called "const assertion enums" or "string literal unions":

```typescript
const EnumName = {
	Value1: 'value1',
	Value2: 'value2',
	Value3: 'value3'
} as const;
type EnumName = typeof EnumName[keyof typeof EnumName];
export default EnumName;
```
