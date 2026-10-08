# Deploying the identity Diamond on Alastria Red-B (runbook)

Plan phase A4. **Prepared and rehearsed locally, not executed.** Every step marked 🔴 sends
permanent transactions to Red-B (chainId 2020) or changes the VPS, and runs only with Pablo's
explicit go-ahead at the moment of execution.

## Decisions this runbook implements

| # | Decision |
|---|---|
| D1 | A **dedicated Web3Signer** instance for identity on the VPS (not shared with the IoT panel's) |
| D2 | **Separate keys**: Diamond owner ≠ issuer backend key (a stolen backend key can be removed by the owner) |
| D3 | Trusted issuers: the backend key + the wallets of the Alastria people who issue (hardware wallet preferred) |
| D4 | `PausableFacet` included: emergency brake for credential status writes |
| D5 | Company managers sign the login without chainId; Alastria issuers use a browser-reachable Red-B RPC (public read-only, or the token endpoint for staff only) |
| D6 | No `AttestationBatchFacet` (unused by the employee credential and the panel) |
| D7 | Smoke test with a synthetic hash (two permanent records) |
| D8 | Run from the VPS (the only host that reaches the private regular node) |

## What the code provides

`apps/contracts/scripts/redb/` — each script checks the chain id before any transaction
(`EXPECTED_CHAIN_ID`, default 2020), signs through Web3Signer (no private key anywhere), uses
legacy transactions at the network's own `eth_gasPrice` (0 on Red-B), never writes `.env` or
checkpoint files, and records its transactions in the manifest.

| Script | Step | Effect |
|---|---|---|
| `pnpm redb:deploy` (`deploy-redb.ts`) | A4.3 🔴 | Deploys `DiamondCutFacet`, `Diamond`, `DiamondInit`, the 5 facets and runs the `diamondCut` (9 tx). Refuses a dirty working tree and an existing manifest; writes the manifest at the end |
| `pnpm redb:trusted-issuers` (`add-trusted-issuers-redb.ts`) | A4.4 🔴 | `addTrustedIssuer` for each address in `TRUSTED_ISSUERS`; already trusted ones are skipped |
| `pnpm redb:verify` (`verify-redb.ts`) | A4.5 | Read-only: every facet's bytecode equals the compiled artifact, exact selector routing, owner, ERC-165 interfaces, not paused, trusted issuer list, unknown credential status. Exit 1 on any mismatch |
| `pnpm redb:smoke` (`smoke-redb.ts`) | A4.6 🔴 | The backend key records and revokes a synthetic hash `keccak256("circuloos-identity-redb-smoke:<diamond>:<timestamp>")` |

Issuer backend (G2): `WEB3SIGNER_URL` + `ISSUER_ONCHAIN_ADDRESS` make it sign `recordIssuance` /
`revokeCredential` through Web3Signer; `ADMIN_ADDRESSES` lists the human admin wallets of the
issuer web (the owner key in Web3Signer cannot log in with MetaMask).

## Rehearsal (A4.0)

`apps/issuer/tests/integration/redb-rehearsal.realchain.spec.ts` runs the four scripts exactly as
above against a local `hardhat node` posing as Red-B (`HARDHAT_CHAIN_ID=2020`), with the owner and
backend keys held by a fake Web3Signer, then the whole flow on the result: employee credential
issued and recorded through Web3Signer, login verified against the chain, on-chain revocation,
login rejected. It also checks the chain-id guard and the refusal to overwrite a manifest.

The real Web3Signer is exercised for the first time in A4.1 (signature check) and A4.6.

## Steps

### A4.1 🔴 Web3Signer for identity on the VPS
1. Unprivileged user and keystore directory; generate **two** keys on the VPS (owner, backend).
2. Keystore passwords in the existing Vault (KV v2), AppRole scoped to those two secrets only.
3. systemd unit for the identity Web3Signer: `127.0.0.1` only, free port, `--access-logs-enabled`,
   `ExecStartPre` fetching the passwords from Vault into a `tmpfs` runtime path (same pattern as
   the IoT panel's Red-B Web3Signer).
4. Check: `eth_accounts` lists both addresses; a test `eth_signTransaction` recovers the right
   address. No transaction sent.

**Done 2026-10-08.** On the VPS (host and paths recorded in the private ops runbook):

| Item | Value |
|---|---|
| Service | `<signer-unit>.service` (enabled), a dedicated unprivileged user, `127.0.0.1:<signer-port>`, `--chain-id=2020`, access logs on |
| Keys (generated on the VPS) | owner `0x2F77f56dc5AEcA83914b87dB28A6D3CA2bfcDcA0` · issuer backend `0xD3fD4Fbd479D1984b9E4FB5aDe42b67Cbf15bA92` |
| Keystores | `<signer-dir>/keystore/{owner,backend}.json` (V3, scrypt), `600`, service user only |
| Password | only in Vault (`127.0.0.1:<vault-port>`, the IoT panel's instance): KV v2 `<vault-kv-path>`; read-only policy and AppRole `<vault-approle>` (token TTL 300 s); copied to `tmpfs` (`<runtime-dir>`) by `ExecStartPre`, removed on stop |
| Binaries | shared read-only with the IoT panel's signers (`<shared-binaries-dir>/{jre,web3signer}`) to save disk |
| JVM heap | `-Xmx512m`: the two scrypt keystores are decrypted in parallel; 256m failed with `OutOfMemoryError` |

Checks: `eth_accounts` lists both keys; a test transaction (chainId 2020, not broadcast) signed by
each key recovers the right address; stopping the service removes the runtime password; the IoT
panel's signers and both Vault instances stay active. **Depends on that Vault being unsealed**
(manual unseal after a reboot, same as the panel's Red-B signer).

### A4.2 Read-only checks on Red-B (from the VPS)
`eth_chainId` = `0x7e4`, `eth_gasPrice` = `0x0`, `web3_clientVersion` = `besu/22.10.3`, the node's
block height equals the public endpoint's.

**Done 2026-10-08 (read-only, from the VPS against the private regular node):**

| Check | Result |
|---|---|
| `eth_chainId` / `eth_gasPrice` / client | 2020 / `0x0` / `besu/v22.10.3` |
| Sync | `eth_syncing=false`, 5 peers, latest block 2 s old |
| Fork | **pre-London** (no `baseFeePerGas`): EIP-1559 transactions are not accepted — the scripts and `Web3SignerSigner` send legacy transactions |
| Block gas limit | 10,485,760 |
| `eth_estimateGas` of every contract deployment on Red-B (constructors executed on Red-B's EVM, nothing written) | all succeed; largest `Diamond` 2,279,119 (21.7 % of a block); `DiamondCutFacet` 2,198,273 |
| `diamondCut` (measured locally, cannot be estimated before the facets exist) | 1,328,203 (12.7 %); `addTrustedIssuer` 97,836 |
| Owner / backend keys on Red-B | nonce 0, no code, balance 0 (none needed: gas price 0) |

### A4.3 🔴 Deploy
```bash
cd apps/contracts && pnpm install --frozen-lockfile && pnpm compile
EXPECTED_CHAIN_ID=2020 REDB_RPC_URL=<redb-node-rpc> \
WEB3SIGNER_URL=http://127.0.0.1:<port> OWNER_ADDRESS=<owner> \
MANIFEST_PATH=<path>/deployed-redb.json pnpm redb:deploy
```

**Done 2026-10-08 12:51 UTC** — run from Pablo's machine through SSH tunnels to the private
node and to the identity Web3Signer (decision D8 revised: no repository copy or dependencies on
the VPS, keys never leave it), from commit `15a98a7` with a clean tree.

| Contract | Address on Red-B |
|---|---|
| **Diamond** | **`0x227840022759D9a7f8c291d50Cde478863A7aDd9`** |
| Owner | `0x2F77f56dc5AEcA83914b87dB28A6D3CA2bfcDcA0` (Web3Signer) |
| DiamondCutFacet | `0xEA17c653dcffB827C208192117845385c808C2FC` |
| DiamondInit | `0x06A5eFb79F9Df81C8985Ab1d5AEA3530143121bA` |
| DiamondLoupeFacet | `0x15dE887d90D7d0Ff299C6592dD8236959BCa4272` |
| OwnershipFacet | `0xb3a47fa88a50fb70a0076b677F6fA3692141E74c` |
| TrustedIssuerFacet | `0x8812D2c68A60280244394E3e2997eAd15cFfD5A4` |
| CredentialStatusFacet | `0x60628A8b797799FAE38e943d916dAa18e9FF7D75` |
| PausableFacet | `0xa85bc98136976E21242d1208644A701107AE039b` |

Manifest with the 9 transaction hashes: `apps/contracts/deployments/redb/deployed-redb.json`.
A4.5 verification run right after: all 22 checks passed (bytecode of the 6 contracts equals the
compiled artifacts, exact selector routing, owner, ERC-165, not paused, no trusted issuer yet).

### A4.4 🔴 Trusted issuers
```bash
… TRUSTED_ISSUERS=<backend key>,<alastria issuer 1>,… pnpm redb:trusted-issuers
```

### A4.5 Verify
```bash
… EXPECTED_TRUSTED_ISSUERS=<same list> pnpm redb:verify
```

### A4.6 🔴 Smoke test
```bash
… BACKEND_ADDRESS=<backend key> pnpm redb:smoke
```

### A4.7 Record
Commit the manifest (addresses and transaction hashes only) and the consumer settings, without
applying them yet: issuer (`DIAMOND_ADDRESS`, `RPC_URL`, `CHAIN_ID=2020`, `WEB3SIGNER_URL`,
`ISSUER_ONCHAIN_ADDRESS`, `ADMIN_ADDRESSES`), verifier (`DIAMOND_ADDRESS`, `RPC_URL`, `CHAIN_ID`),
IoT panel (identity Diamond address and RPC).

## If something goes wrong

| Situation | Response |
|---|---|
| A deploy step fails midway | What was deployed is abandoned (no effect); the manifest is only written at the end, so rerun from scratch |
| Bug in a facet | Owner replaces it with `diamondCut`; state is kept |
| Incident in production | A pauser calls `pause()`: credential status writes stop; trusted issuer management keeps working |
| Backend key compromised | Pause; owner `removeTrustedIssuer(old)`, new key in Web3Signer, `addTrustedIssuer(new)`, unpause. Keep the old key out of service but not destroyed: only it can revoke what it recorded |
| Owner key compromised | `transferOwnership` to a new key while it is still ours; the new owner is automatically a pauser and the old one stops being one |
