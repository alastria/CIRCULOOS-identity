# Circuloos VC Wallet Snap

MetaMask Snap for securely managing Verifiable Credentials.

## Features

- **Secure VC Storage**: VCs are encrypted and stored using MetaMask's secure state management
- **Key Derivation**: Uses BIP-44 to derive a unique private key for signing VPs
- **User Confirmation**: All operations require explicit user approval via native MetaMask dialogs
- **Anti-Replay Support**: Generate VPs with challenge tokens to prevent replay attacks

## Running Locally

```bash
# Install dependencies
pnpm install

# Build the snap
pnpm build

# Start development server (localhost:8080)
pnpm start
```

## RPC Methods

### `save_vc`
Store a Verifiable Credential in the Snap's encrypted state.

```typescript
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: 'local:http://localhost:8080',
    request: {
      method: 'save_vc',
      params: { vc: myVC }
    }
  }
});
```

### `get_vcs`
Retrieve all stored VCs (optionally filtered by type).

```typescript
const vcs = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: 'local:http://localhost:8080',
    request: {
      method: 'get_vcs',
      params: { type: 'EducationalCredential' } // optional
    }
  }
});
```

### `create_vp`
Create and sign a Verifiable Presentation with the Snap's derived key.

```typescript
const vp = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: 'local:http://localhost:8080',
    request: {
      method: 'create_vp',
      params: {
        vcIds: ['vc-id-1', 'vc-id-2'],
        challenge: 'abc123...', // optional
        verifierDomain: 'My Verifier', // optional
        expiresInMinutes: 5 // optional
      }
    }
  }
});
```

## Integration

See `apps/web/src/hooks/useSnap.ts` for a React integration example.
