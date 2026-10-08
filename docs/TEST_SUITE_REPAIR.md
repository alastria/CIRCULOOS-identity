# Test suite repair (2026-10-07)

> **Disclosure note.** P1, P3, P4, P11, P13, P14 and the committed secrets are security issues,
> tracked in private GitHub security advisories. This file describes them: publish this branch only
> together with the fixes and the advisories.

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
| P1 | `libs/common/src/eip712/types/circuloos-marketplace.ts:51-52` | The issuance message signs `holderAddress \|\| id`; with `holderAddress` present, `credentialSubject.id` is not covered by the issuer signature. | **Fixed** with the employee credential: the holder is always derived from `credentialSubject.id` (`subjectAddress`, `eip712/utils.ts`); a disagreeing `holderAddress` is rejected. |
| P2 | `libs/common/src/verifier.ts:149` | `requireW3CCompliance` compares the DID `subjectId` with the recovered bare `0x` address as raw strings. | **Fixed**: compares normalised addresses. |
| P3 | `apps/verifier/src/routes/verify.ts` | The on-chain subject check and the holder-proof check were removed; `checks.notExpired` is always `VALID` (TODO at line 138). | `/verify` does not bind credential to holder nor check expiry. |
| P4 | `apps/verifier/src/routes/verify.ts` | On-chain/registry errors return 500 with the raw error text (previously 502 with a friendly message). | Internal error details reach the client. |
| P5 | `apps/verifier` | `POST /verify/presentation` has no tests. | — |
| P6 | `apps/issuer/src/services/issuanceService.ts:165-172` | The legacy-signature fallback only runs when the EIP-712 check throws; a legacy signature does not throw, it recovers a wrong address. | Legacy fallback is dead code. |
| P7 | `apps/issuer/src/routes/playground.ts:36,61` | Response schema drops `calldata`; reads a `holderAddress` that `createDraftVC` deleted (subject always zero address). | Playground only; not registered in production. |
| P8 | `apps/issuer/src/services/notification.service.ts:31` | Trailing `/` in `APP_PUBLIC_URL` produces `//claim`. | Cosmetic / broken link. |
| P9 | `libs/common/src/config/verifier.schema.ts` | See KNOWN-BUG above. | Config silently ignored. |
| P10 | `libs/common/src/eip712/types/circuloos-marketplace.ts` | Marketplace dates are signed as `toLocaleDateString('es-ES')` without a fixed time zone; the issuer signs in the browser and the server rebuilds the message in its own time zone. | Signatures can fail to verify near midnight across time zones; changes within the same day are not covered. The employee schema signs the exact ISO strings. |
| P11 | `apps/issuer/src/services/registry.service.ts:78-80` | `recordIssuance(vcHash, subject)` passes the subject **DID** where the contract expects an address; the error is logged and swallowed. | **Fixed (A2)**: the subject address is passed, and the outcome is kept on the issuance (`onchain.status`: recorded / failed / disabled). Verified against a real local node. |
| P13 | `apps/issuer/src/controllers/issueController.ts` `revokeCredential` | Any authenticated session (even a holder) could revoke any credential; the request signature was never checked; revocation was database-only. | **Fixed (A2)**: role issuer (and signer of the credential) or admin, EIP-712 `CredentialRevocation` signature verified, revoked on-chain first. |
| P14 | `apps/contracts` `CredentialStatusFacet.issueCredential` | Unrestricted: any address can record a credential hash first and then controls its revocation. | **Fixed (contract)**: `issueCredential`/`recordIssuance` revert with `NotTrustedIssuer(caller)` unless the caller is in the trusted issuer registry; the recording issuer can still revoke after being removed. Verifiers also check the recorded issuer (A3). |
| P15 | `apps/web/app/admin/my-keys/page.tsx` | Revokes on-chain from the admin wallet, but issuances are recorded by the backend key, so the contract rejects it (`NotIssuer`). | Open — use the issuer API to revoke. |
| P12 | `apps/issuer/src/services/credential.service.ts` `loadVC` | After the claim, finalize() stores a presentation (no `id`) under the VC id; `loadVC` discards objects without `id`. | A claimed credential cannot be loaded with `loadVC`; `loadIssuedCredential` was added for the employee reference. |

P3 (verification for login) is planned for phase A3. P1–P3 sat exactly where the employee credential and the login verification (plan phases A1/A3) are
built; they will be fixed there, with their own failing tests first.

## Tracking (2026-10-08)

| Item | Tracked in |
|---|---|
| P1 | Security advisory GHSA-7xhc-9xpf-4wq2 (draft, private) |
| P2 | Issue #2 |
| P3 | Security advisory GHSA-qfm6-qx8j-3f47 (draft, private) |
| P4 | Security advisory GHSA-g564-24x2-wgq2 (draft, private) |
| P5 | Issue #3 |
| P6 | Issue #4 |
| P7 | Issue #5 |
| P8 | Issue #6 |
| P9 | Issue #7 |
| P10 | Issue #8 |
| P11 | Security advisory GHSA-p35x-973w-c6ww (draft, private) |
| P12 | Issue #9 |
| P13 | Security advisory GHSA-f348-g9qr-p33q (draft, private) |
| P14 | Security advisory GHSA-mprv-v6hr-mqwx (draft, private) |
| P15 | Issue #11 |
| Committed secrets (`.env.docker`, `details-en`) | Security advisory GHSA-rmvr-9wfj-373x (draft, private) |
| Test suite drift | Issue #10 |
