# TaskOrbit Agent Guide

This file is for coding agents working in this repository.
Follow it together with direct user instructions.
If user instructions conflict with this file, user instructions win.

## Repository Snapshot

- Frontend app: Angular 20 (standalone components) in `src/`.
- Backend API: Express + PostgreSQL in `server/`.
- Frontend package manager: npm (`package-lock.json` at repo root).
- Backend package manager: npm (`server/package-lock.json`).
- Frontend tests: Karma + Jasmine (`ng test`).
- Backend tests: Jest + Supertest (`server/tests`).
- TypeScript is strict on frontend (`tsconfig.json` has `strict: true`).

## Directory Map

- `src/app/core/`: cross-cutting guards, interceptors, session service.
- `src/app/features/`: feature slices (`auth`, `dashboard`, `taskorbit`, etc.).
- `src/app/features/**/interfaces/`: frontend domain contracts.
- `src/app/features/**/services/`: frontend API/state services.
- `server/modules/`: backend module-per-domain controllers and routes.
- `server/middlewares/`: auth, role, error, not-found middleware.
- `server/utils/`: helpers (`responses`, `validators`, `jwt`, `audit`).
- `server/tests/`: backend tests grouped by `integration`, `modules`, `middlewares`, `utils`.

## Install and Setup Commands

Run from repository root unless noted.

- Install frontend deps: `npm ci`
- Install backend deps: `npm --prefix server ci`
- Backend env template: `server/.env.example`
- Initialize database schema/seeds: `npm --prefix server run init-db`

## Run Commands

- Frontend dev server: `npm start`
- Frontend default URL: `http://localhost:4200`
- Backend dev server (nodemon): `npm --prefix server run dev`
- Backend start (node): `npm --prefix server run start`
- Backend default URL: `http://localhost:3000`
- API base used by frontend services is hardcoded to `http://localhost:3000/api/...`

## Build Commands

- Frontend production build: `npm run build`
- Frontend dev watch build: `npm run watch`
- Backend has no compile step (plain Node.js / CommonJS).

## Lint and Format Commands

There is no official lint script in either `package.json`.
Do not invent a new lint tool unless user asks.

Use formatting checks only when needed:

- Frontend format check: `npx prettier --check "src/**/*.{ts,html,scss}"`
- Frontend format write: `npx prettier --write "src/**/*.{ts,html,scss}"`

Formatting defaults already configured:

- `.editorconfig`: UTF-8, spaces, 2-space indent, trim trailing whitespace.
- `package.json` Prettier: single quotes, print width 100, Angular parser for HTML.

## Test Commands

### Frontend (Angular/Karma/Jasmine)

- Run all frontend tests (watch mode): `npm run test`
- Run all once in CI/headless style:
  `npm run test -- --watch=false --browsers=ChromeHeadless`
- Run a single spec file:
  `npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/features/taskorbit/pages/proyectos-listado/proyectos-listado.component.spec.ts`
- Run tests in one folder:
  `npm run test -- --watch=false --browsers=ChromeHeadless --include=src/app/features/notifications/services`

Notes:

- `--include` is supported by `ng test` in this workspace.
- Prefer file-level targeting with `--include` instead of editing specs (`fit`/`fdescribe`).

### Backend (Jest/Supertest)

- Run all backend tests: `npm --prefix server test`
- Run with coverage: `npm --prefix server run test:coverage`
- Run one backend test file:
  `npm --prefix server test -- tests/modules/proyectos.controller.test.js`
- Run one test name pattern:
  `npm --prefix server test -- tests/modules/proyectos.controller.test.js -t "createProyecto should allow ADMIN role"`

Coverage thresholds are defined in `server/package.json` (global minimums).

## Frontend Code Style

- Use standalone Angular components (`standalone: true`) as existing code does.
- Prefer `inject(...)` over constructor injection in new code.
- Keep local component state in signals (`signal`, `computed`) where already used.
- Keep RxJS pipelines concise; map API envelopes to `data` in services.
- Use explicit interfaces/types for API payloads and domain models.
- Avoid `any`; if unavoidable, narrow quickly and keep scope small.
- Keep guard/interceptor behavior functional (`CanActivateFn`, `HttpInterceptorFn`).
- Preserve lazy route loading style in `app.routes.ts` (`loadComponent` dynamic imports).
- Keep user-facing and domain naming consistent with current Spanish terminology.

## Backend Code Style

- Use CommonJS (`require`, `module.exports`) to match current backend.
- Keep module structure: `*.routes.js` wires endpoints, `*.controller.js` handles logic.
- Reuse helpers from `server/utils/responses.js` (`success`, `fail`) for API shape.
- Reuse validators from `server/utils/validators.js` for request validation.
- Keep controller functions `async` with `try/catch`; call `next(error)` for unexpected errors.
- For DB transactions: `BEGIN`/`COMMIT`/`ROLLBACK` and always `client.release()` in `finally`.
- Keep SQL parameterized (`$1`, `$2`, ...) and avoid string interpolation for values.
- Continue mapping DB snake_case rows to API camelCase DTOs via mapper helpers.

## Imports and Dependency Hygiene

- In TypeScript files, group imports as:
  Angular/framework -> third-party -> local relative modules.
- Keep imported symbols specific; avoid wildcard imports.
- Remove unused imports when touching a file.
- Do not add new dependencies without user request.

## Naming Conventions

- Classes, interfaces, components, services: `PascalCase`.
- Variables, functions, methods, properties: `camelCase`.
- Constants shared across module scope: `UPPER_SNAKE_CASE` when truly constant.
- Angular filenames: kebab-case with suffixes (`*.component.ts`, `*.service.ts`, `*.interface.ts`).
- Backend files: kebab-case + role suffix (`*.controller.js`, `*.routes.js`, `*.middleware.js`).
- Keep role and estado literals aligned with existing unions and backend validators.

## Error Handling and Logging

- Frontend: surface friendly UI errors via signals like `errorMessage`/`formError`.
- Frontend: use `catchError` with safe fallbacks (`of([])`, etc.) when partial failure is acceptable.
- Backend: return 4xx with `fail(...)` for validation/authorization errors.
- Backend: reserve thrown/unhandled errors for truly unexpected conditions.
- Existing code uses structured `console.info`/`console.error` tags; keep that style when extending logs.

## Testing Conventions

- Frontend specs live next to source as `*.spec.ts`.
- Backend tests live in `server/tests/**` as `*.test.js`.
- In Jest tests, mock DB and side effects with `jest.mock(...)` as current tests do.
- Use `jest.clearAllMocks()` in `beforeEach` when mocks are reused.
- For Express controller unit tests, use lightweight mocked `req/res/next` objects.

## Agent Workflow Expectations

- Prefer minimal, targeted edits over broad refactors.
- Do not modify `dist/`, `coverage/`, or `node_modules/` content.
- Keep changes localized to the feature/module being edited.
- Run the narrowest relevant tests first, then broader suites if needed.
- If adding behavior, add or update tests in the same area when feasible.

## Cursor/Copilot Rules Check

Checked repository for additional agent instruction files:

- `.cursor/rules/`: not found
- `.cursorrules`: not found
- `.github/copilot-instructions.md`: not found

If any of these files are added later, treat them as authoritative repo rules.
