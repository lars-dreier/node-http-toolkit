// ESLint flat config.
//
// Roles (see .claude/documentation/code-style.md):
//   - eslint            : the linting engine + core JS rules
//   - typescript-eslint : TypeScript parser + TS-aware rules
//   - eslint-config-prettier : disables stylistic rules that would fight Prettier
//
// Prettier owns layout. ESLint owns correctness and project conventions.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
	// Files ESLint should never look at.
	{
		ignores: ['dist/', 'build/', 'out/', 'node_modules/', 'coverage/'],
	},

	// Base JavaScript recommendations.
	js.configs.recommended,

	// Type-aware TypeScript recommendations (uses the TS compiler for type info).
	...tseslint.configs.recommendedTypeChecked,

	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parserOptions: {
				// Resolve the nearest tsconfig.json automatically for type-aware rules.
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: {
				...globals.node,
			},
		},
		rules: {
			// --- Project architectural invariants ---------------------------------

			// OOP: one primary class per file. Expression classes are ignored so
			// small inline/anonymous classes do not trip the rule.
			'max-classes-per-file': ['error', { ignoreExpressions: true, max: 1 }],

			// Always declare access modifiers (public/private/protected) explicitly.
			'@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],

			// Enforce the const-object enum pattern: ban TypeScript `enum`.
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TSEnumDeclaration',
					message: 'Use the const-object enum pattern instead of `enum` (see code-style.md).',
				},
			],

			// --- Quality / bug-class rules ----------------------------------------

			// Catch unawaited promises — a common defect in async tool loops.
			'@typescript-eslint/no-floating-promises': 'error',
		},
	},

	// Plain JS / config files are not part of the TS program: disable type-aware
	// rules for them so ESLint does not try to load type information it lacks.
	{
		files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
		...tseslint.configs.disableTypeChecked,
	},

	// Must come last: turns off any rules that conflict with Prettier formatting.
	eslintConfigPrettier,
);
