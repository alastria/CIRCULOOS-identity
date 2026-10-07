# Employee credential (CirculoosEmployeeCredential)

Added 2026-10-07 on branch `feat/employee-credential`. It is the source of truth for
"this person works for this organisation", for apps such as the CIRCULOOS IoT fleet panel
that grant access per organisation.

## Model

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://schema.org", "https://w3id.org/security/suites/eip712signature/2023/v1"],
  "type": ["VerifiableCredential", "CirculoosEmployeeCredential"],
  "issuer": "did:alastria:quorum:0x<issuer>",
  "validFrom": "2026-11-01T00:00:00.000Z",
  "validUntil": "2027-11-01T00:00:00.000Z",
  "credentialSubject": {
    "id": "did:alastria:quorum:0x<holder wallet>",
    "worksFor": { "@type": "Organization", "legalName": "Khoani B&A S.L.", "taxID": "ESB12345678", "addressCountry": "ES" },
    "email": "…", "emailBinding": "…", "issuanceId": "…", "preparedAt": "…"
  }
}
```

- The organisation is identified by its **tax ID**, not by a DID: no organisation DID registry is needed.
  Consumers must match organisations on `taxID`, never on `legalName` (legal names change).
- `taxID` is normalised: country prefix + identifier, uppercase, no separators
  (`ESB12345678`, `IT01234567890`, `CHE123456789`). The prefix must match `addressCountry`
  (ISO 3166-1 alpha-2); the EU VAT prefixes `EL` (Greece) and `XI` (Northern Ireland) are accepted.
- Validation errors (`OrganizationValidationError.code`): `MISSING_LEGAL_NAME`, `MISSING_TAX_ID`,
  `MISSING_COUNTRY`, `INVALID_COUNTRY`, `MISSING_COUNTRY_PREFIX`, `COUNTRY_MISMATCH`, `INVALID_TAX_ID`.

## Signature (EIP-712 schema `circuloos-employee`)

`libs/common/src/eip712/types/circuloos-employee.ts`. The issuer signs:

| Field | Source |
|---|---|
| `holder` (address) | `credentialSubject.id` |
| `worksFor` (struct `Organization { legalName, taxID, addressCountry }`) | `credentialSubject.worksFor` |
| `credentialId`, `issuerDID` | `id`, `issuer` |
| `validFrom`, `validUntil` | the exact ISO strings (not reformatted for display) |

Changing any of them makes the signature recover a different address. A
`credentialSubject.holderAddress` that disagrees with `credentialSubject.id` is rejected.

Verifiers should verify an employee credential **with the employee schema explicitly**
(`verifyCredentialIssuance(domain, vc, sig, 'circuloos-employee')`), not through
`detectCredentialType`, whose result depends on the order of the presented `type` array.

## Issuing (issuer API)

`POST /api/v1/issue/prepare` accepts, besides `email` and `holderAddress`:

| Field | Meaning |
|---|---|
| `credentialType` | `circuloos-marketplace` (default) or `circuloos-employee` |
| `organization` | `{ legalName, taxID, addressCountry }` — required for `circuloos-employee`; 400 with `code` if invalid |
| `employeeCredentialId` | marketplace only: an issued employee credential of the same holder (see below) |

`mint` and `finalize` pick the signing/claim schema from the draft's type. The web issuer form
(`apps/web/app/issuer`) offers the employee type with legal name, tax ID and country; the claim
page signs with the matching claim schema and shows the organisation name.

Custom claims can no longer overwrite the subject `id`, `holderAddress`, `worksFor` or
`employeeCredential` (they used to be spread last).

## Marketplace credential v2 references the employee credential

The marketplace issuance schema (now version 2.0.0) signs two more fields,
`employeeCredentialId` and `employeeCredentialHash` (empty when there is no reference).
The subject carries `employeeCredential: { id, credentialHash }`, where `credentialHash` is
`hashVC(employeeVC)` — the same key the on-chain credential status uses. The issuer only
accepts the reference if the employee credential exists, is issued (has a proof) and belongs
to the same holder.

**Breaking:** marketplace credentials signed before this change no longer verify (their
signed message lacks the two new fields, and the subject holder is now taken from
`credentialSubject.id`). All marketplace credentials issued so far were test credentials.
