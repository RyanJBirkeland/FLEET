## 1. getDiffFileStats malformed-input edge cases (T-13 · P2)

- [x] 1.1 Open `src/main/agent-manager/__tests__/auto-merge-policy.test.ts` and locate the `numstat line parsing` describe block
- [x] 1.2 Add test: numstat output is a single line with no tab delimiter (e.g. `"notabshere\n"`) — assert `evaluateAutoReviewRules` is called once and no exception is thrown
- [x] 1.3 Add test: numstat output is `"abc\t2\tsrc/foo.ts\n"` (non-numeric additions) — assert `evaluateAutoReviewRules` is called with one entry where `additions` is `NaN` and `path` is `"src/foo.ts"`
- [x] 1.4 Add test: numstat output is `"3\t1\tsrc/my component.ts\n"` (path with spaces) — assert `evaluateAutoReviewRules` is called with `path: "src/my component.ts"`
- [x] 1.5 Run `npx vitest run --config vitest.config.main.ts src/main/agent-manager/__tests__/auto-merge-policy.test.ts` — all tests pass

## 2. isCssOnlyChange edge cases (T-14 · P2)

- [x] 2.1 Locate the `isCssOnlyChange` describe block in `src/main/agent-manager/__tests__/auto-merge-policy.test.ts`
- [x] 2.2 Add test: `isCssOnlyChange(["src/theme.CSS"])` → `true` (uppercase extension, i flag)
- [x] 2.3 Add test: `isCssOnlyChange(["src/vars.SCSS"])` → `true`
- [x] 2.4 Add test: `isCssOnlyChange(["src/theme.Css"])` → `true` (mixed case)
- [x] 2.5 Add test: `isCssOnlyChange(["dist/bundle.min.css"])` → `true` (double extension)
- [x] 2.6 Add test: `isCssOnlyChange(["src/somecss.ts"])` → `false` (stem contains "css" but extension is .ts)
- [x] 2.7 Add test: `isCssOnlyChange(["src/theme.CSS", "src/index.ts"])` → `false` (uppercase CSS + TS mixed)
- [x] 2.8 Run `npx vitest run --config vitest.config.main.ts src/main/agent-manager/__tests__/auto-merge-policy.test.ts` — all tests pass

## 3. test-touch-check.ts coverage (T-16 · P2)

- [x] 3.1 Create `src/main/agent-manager/__tests__/test-touch-check.test.ts` — no vi.mock needed; all dependencies injected via `TestTouchCheckDeps`
- [x] 3.2 Import `listChangedFiles`, `detectUntouchedTests` from `'../test-touch-check'`; import `makeLogger` from `'./test-helpers'`
- [x] 3.3 Add `listChangedFiles` describe block with tests:
  - (a) injected `execFile` resolves with `{ stdout: "", stderr: "" }` → returns `[]`
  - (b) stdout `"src/a.ts\nsrc/b.ts\nsrc/c.ts\n"` → returns `["src/a.ts", "src/b.ts", "src/c.ts"]`
  - (c) stdout `"src/a.ts\n\n  \nsrc/b.ts\n"` → returns `["src/a.ts", "src/b.ts"]` (blank lines filtered)
  - (d) injected `execFile` rejects with `new Error("git failed")` → returns `[]` and `logger.warn` called once
  - (e) stdout `"  src/a.ts  \n"` (leading/trailing whitespace) → returns `["src/a.ts"]`
- [x] 3.4 Add `detectUntouchedTests` describe block with tests:
  - (a) `changedFiles: []` → returns `[]`
  - (b) `changedFiles: ["src/foo.ts"]`, `fileExists` always returns `false` → returns `[]`
  - (c) `changedFiles: ["src/foo.ts", "src/foo.test.ts"]`, `fileExists` returns `true` for `"src/foo.test.ts"` → returns `[]`
  - (d) `changedFiles: ["src/foo.ts"]`, `fileExists` returns `true` for `"src/foo.test.ts"` → returns `["src/foo.ts"]`
  - (e) `changedFiles: ["src/foo.ts"]`, `fileExists` returns `false` for `"src/foo.test.ts"` and `true` for `"src/__tests__/foo.test.ts"` → returns `["src/foo.ts"]`
  - (f) `changedFiles: ["src/foo.test.ts"]`, `fileExists` always returns `true` → returns `[]` (test file not treated as source)
  - (g) `changedFiles: ["src/theme.css"]`, `fileExists` always returns `true` → returns `[]` (non-source extension)
- [x] 3.5 Run `npx vitest run --config vitest.config.main.ts src/main/agent-manager/__tests__/test-touch-check.test.ts` — all tests pass

## 4. classifyFailureReason precedence completeness (T-34 · P3)

- [x] 4.1 Open `src/main/agent-manager/__tests__/failure-classifier.test.ts`
- [x] 4.2 Locate the `pattern precedence` describe block and add:
  - (a) `classifyFailureReason("credential unavailable: invalid token")` → `'environmental'` (environmental registered before auth)
  - (b) `classifyFailureReason("refusing to proceed due to timeout")` → `'environmental'` (environmental registered before timeout)
- [x] 4.3 Add a new `incomplete_files pattern matching` describe block (parallel to the existing per-pattern blocks) with tests:
  - (a) `classifyFailureReason("files to change checklist not satisfied")` → `'incomplete_files'`
  - (b) `classifyFailureReason("missing: src/foo.ts")` → `'incomplete_files'`
  - (c) `classifyFailureReason("incomplete files detected")` → `'incomplete_files'`
  - (d) case-insensitive: `classifyFailureReason("MISSING: src/foo.ts")` → `'incomplete_files'`
- [x] 4.4 Add test in the `registerFailurePattern API` describe block (or pattern precedence block):
  - Register `{ type: 'custom_timeout', keywords: ['timeout'] }` after builtins
  - `classifyFailureReason("timeout occurred")` → `'timeout'` (not `'custom_timeout'`)
  - (Uses existing `afterEach(() => resetRegistryToBuiltins())` cleanup automatically)
- [x] 4.5 Run `npx vitest run --config vitest.config.main.ts src/main/agent-manager/__tests__/failure-classifier.test.ts` — all tests pass

## 5. Full suite verification

- [x] 5.1 Run `npm run test:main` — all tests pass with zero failures
- [x] 5.2 Run `npm run typecheck` — zero errors
- [x] 5.3 Run `npm run lint` — zero errors (warnings OK)
- [x] 5.4 Update `docs/modules/agent-manager/index.md` — ensure `test-touch-check.ts` has a row; add it if missing
