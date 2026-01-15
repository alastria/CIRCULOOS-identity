import { ethers } from 'ethers'

export const STORAGE_SLOTS = {
  DIAMOND: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('diamond.standard.diamond.storage')),
  TRUSTED_ISSUER: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('alastria.trusted.issuer.storage')),
  CREDENTIAL: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('alastria.credential.registry.storage')),
  REVOCATION: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('alastria.revocation.registry.storage')),
  PROOF: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('alastria.proof.registry.storage'))
}

