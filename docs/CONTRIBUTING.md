# Contributing to ClinicOS

## Before you start

Read `docs/ENGINEERING_GUIDE.md` first — it is the binding contract for file layout,
naming, and conventions. New backend modules and frontend features must follow it
exactly; the route registries (`apps/api/src/modules/index.ts`,
`apps/web/src/router.tsx`) depend on agreed file paths.

## Workflow

1. Check `docs/PROGRESS.md` for current status before starting work.
2. For a new backend domain: create `apps/api/src/modules/<domain>/` with
   `*.model.ts` / `*.service.ts` / `*.controller.ts` / `*.routes.ts` / `*.test.ts`,
   then add exactly one line mounting it in `modules/index.ts`.
3. For a new frontend feature: create `apps/web/src/features/<domain>/` with
   `api.ts` and `pages/<Name>Page.tsx`, then add the lazy route in `router.tsx` and,
   if it needs a nav entry, `nav-config.ts`.
4. Every new Zod schema goes in `packages/validation/src/<domain>.ts` and is
   exported from `packages/validation/src/index.ts` — this is the single source of
   truth consumed by both the API's `validate()` middleware and the frontend's
   `zodResolver()`.
5. Every new DTO/enum goes in `packages/types/src` — never redefine a shape locally
   in an app.

## Before opening a PR

- `npm run typecheck` (root) passes with no errors.
- `npm run lint` (root) passes.
- `npm test` passes for any workspace you touched.
- New mutations: is there a permission check? An audit-log call for anything listed
  in spec §37? A test for the permission boundary and, if applicable, the state
  transition?
- Money fields are integer paise. Dates are UTC in storage, clinic-local at the
  display edge. No hard deletes on tenant-owned records.

## Commit style

Follow the existing history's tone: imperative, one logical change per commit,
explain *why* in the body when the reason isn't obvious from the diff.

## Getting help

`docs/DECISIONS.md` explains *why* the architecture looks the way it does — check
there before proposing a structural change, since most non-obvious choices (money as
paise, event collections instead of embedded arrays, tenant resolution from session
not request body, etc.) are deliberate and documented.
