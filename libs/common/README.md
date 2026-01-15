# @circuloos/common

Helpers and types shared across the monorepo: EIP-712 helpers, JWT helpers, validators and shared types.

Use from packages via relative import during development or add as workspace dependency for packaged usage.

Modularization notes:
- Place persistence K/V or SQL adapters implementing `src/adapters/persistence.ts`.
- Place KMS adapters implementing `src/adapters/kms.ts` (local file key, AWS KMS, HSM).
- Config values are sourced from `process.env`; load the repo root `.env`/`.env.local` with `scripts/run-with-env.mjs`.

OTP flow:
- `OTP_EXPIRY_SECONDS` in the root `.env` controls expiry (default 300s = 5min).
- OTP should NOT be stored in the VC; only a short-lived audit entry stores otp hash for issuance verification.
