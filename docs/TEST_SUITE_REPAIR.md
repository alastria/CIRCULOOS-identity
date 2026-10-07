# Test suite repair (2026-10-07)

Branch `feat/employee-credential`, based on `details-en` (`6a34ad5`). Test files only: no production
code under `src/` was changed. Done before adding the employee credential, so that work has a
trustworthy red/green signal.

## How to run the suites locally

```bash
set -a && . ./.env-sample && set +a        # the config loader needs RPC_URL, CHAIN_ID, APP_PUBLIC_URL
(cd libs/file-store && pnpm run build)      # verifier/issuer resolve it from dist/
# pnpm 10 skips install scripts: better-sqlite3 needs its native binary
(cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npx --no-install prebuild-install)
(cd libs/common && pnpm exec vitest run)
(cd apps/issuer && pnpm exec vitest run)
(cd apps/verifier && pnpm exec vitest run)
(cd apps/contracts && pnpm test)
```

## Result

| Package | Before | After |
|---|---|---|
| `libs/common` | 27 passed · 8 failed (3 files did not load) | 39 passed |
| `apps/issuer` | 128 passed · 93 failed · 10 skipped | 229 passed · 16 skipped |
| `apps/verifier` | 245 passed · 72 failed | 307 passed · 11 skipped |
| `apps/contracts` | 97 passing | 97 passing (untouched) |

## What was wrong

Every failure came from tests that had not followed deliberate refactors:

- **Storage API** renamed (`loadAll`/`writeAtomic` → `loadIssuance`/`saveIssuance`/`loadVC`/`saveVC`; option `store` → `storage`).
- **Config** moved to a typed loader (`libs/common/src/config`), so mocks of env reads and of `@circuloos/common` without `loadConfig` broke.
- **EIP-712 fixtures** signed with the types in force before `6a34ad5`; regenerated with the current types (`apps/issuer/tests/helpers/holder-signature.helper.ts`).
- **Routes** moved under `/api/v1` and now need the auth cookie (`apps/issuer/tests/helpers/auth-cookie.helper.ts`).
- **VC 2.0**: `credentialSubject.id` is a DID, context `https://www.w3.org/ns/credentials/v2`, `validFrom` instead of `issuanceDate`.
- **Verifier `/verify`** now has the "simplified" request/response shape (`{credential}` → `{valid, issuer, holder, checks, error}`).
- **Logging** moved from `console` to pino.
- **Windows**: verifier batch tests never closed their SQLite files (`EBUSY`); they now close them and use per-test dirs under `os.tmpdir()`.
- Three `libs/common` specs used `describe` without importing it.

## Skipped tests

**OBSOLETE (14)** — the behaviour no longer exists; each skip carries a comment with the reason.
In short: "empty object means not found" (old file store), the removed `/issue/debug/:id` endpoint, a
removed `console.debug` try/catch, verifier host/port from the shared config file, the verifier's
trustedIssuers/Holders option lists, the removed holder-proof check in `/verify`, and the removed
on-chain subject check.

**KNOWN-BUG (2)** — `apps/verifier/tests/config-coverage.spec.ts`: `TRUSTED_ISSUER_SQL_DB_ENABLED=yes|on`
silently disables SQL; the parser in `libs/common/src/config/verifier.schema.ts` only accepts
`true/1/false/0` (the verifier's own parser accepting `yes/on`, `apps/verifier/src/config.ts:66`, is no
longer called).

## Production issues found (not fixed here; no test fails on them)

| # | Where | Issue | Impact |
|---|---|---|---|
| P1 | `libs/common/src/eip712/types/circuloos-marketplace.ts:51-52` | The issuance message signs `holderAddress \|\| id`; with `holderAddress` present, `credentialSubject.id` is not covered by the issuer signature. | Holder can be swapped without breaking the issuer signature. |
| P2 | `libs/common/src/verifier.ts:149` | `requireW3CCompliance` compares the DID `subjectId` with the recovered bare `0x` address as raw strings. | The holder check can never succeed. |
| P3 | `apps/verifier/src/routes/verify.ts` | The on-chain subject check and the holder-proof check were removed; `checks.notExpired` is always `VALID` (TODO at line 138). | `/verify` does not bind credential to holder nor check expiry. |
| P4 | `apps/verifier/src/routes/verify.ts` | On-chain/registry errors return 500 with the raw error text (previously 502 with a friendly message). | Internal error details reach the client. |
| P5 | `apps/verifier` | `POST /verify/presentation` has no tests. | — |
| P6 | `apps/issuer/src/services/issuanceService.ts:165-172` | The legacy-signature fallback only runs when the EIP-712 check throws; a legacy signature does not throw, it recovers a wrong address. | Legacy fallback is dead code. |
| P7 | `apps/issuer/src/routes/playground.ts:36,61` | Response schema drops `calldata`; reads a `holderAddress` that `createDraftVC` deleted (subject always zero address). | Playground only; not registered in production. |
| P8 | `apps/issuer/src/services/notification.service.ts:31` | Trailing `/` in `APP_PUBLIC_URL` produces `//claim`. | Cosmetic / broken link. |
| P9 | `libs/common/src/config/verifier.schema.ts` | See KNOWN-BUG above. | Config silently ignored. |

P1–P3 sit exactly where the employee credential and the login verification (plan phases A1/A3) are
built; they will be fixed there, with their own failing tests first.
