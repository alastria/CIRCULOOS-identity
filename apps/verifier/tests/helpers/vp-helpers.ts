import { Wallet, utils } from 'ethers'

export interface VerifiablePresentation {
  '@context': string[]
  type: string[]
  holder: string
  verifiableCredential: any[]
  issuanceDate: string
  expirationDate: string
}

export interface SignedVP {
  presentation: VerifiablePresentation
  signature: string
  signer: string
  domain?: any
  challenge?: string
}

/**
 * Sign a VP using EIP-712
 */
export async function signVP(
  vp: VerifiablePresentation,
  wallet: Wallet,
  challenge?: string
): Promise<SignedVP> {
  const domain = {
    name: 'VerifiablePresentation',
    version: '1',
    chainId: 1
  }

  const types = {
    Presentation: [
      { name: 'holder', type: 'address' },
      { name: 'verifiableCredential', type: 'string' },
      { name: 'issuanceDate', type: 'string' },
      { name: 'expirationDate', type: 'string' },
      ...(challenge ? [{ name: 'challenge', type: 'string' }] : [])
    ]
  }

  const value: any = {
    holder: vp.holder,
    verifiableCredential: JSON.stringify(vp.verifiableCredential),
    issuanceDate: vp.issuanceDate,
    expirationDate: vp.expirationDate
  }

  if (challenge) {
    value.challenge = challenge
  }

  const signature = await wallet._signTypedData(domain, types, value)

  return {
    presentation: vp,
    signature,
    signer: wallet.address,
    domain,
    challenge
  }
}
