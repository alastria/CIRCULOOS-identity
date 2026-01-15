import { utils } from 'ethers'

// Minimal stable serializer: use JSON.stringify with sorted keys (JCS-like)
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

export function canonicalize(vc: any): string {
  // perform a minimal canonicalization suitable for hashing in this repo
  return stableStringify(vc)
}

export function hashVC(vc: any): string {
  // Exclude proof from the hash calculation to ensure stability and avoid circular dependency
  const { proof, ...rest } = vc
  const s = canonicalize(rest)
  return utils.keccak256(utils.toUtf8Bytes(s))
}

