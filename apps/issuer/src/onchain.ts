import { ethers } from 'ethers'
import * as path from 'path'
import * as fs from 'fs'

export function createCredentialRegistry(address: string, signerOrProvider: any) {
  try {
    // Load ABI from file system
    const abiPath = path.join(__dirname, '../abi/CredentialRegistry.json')
    const abiContent = fs.readFileSync(abiPath, 'utf8')
    const abi = JSON.parse(abiContent)
    return new ethers.Contract(address, abi, signerOrProvider)
  }
  catch (err) {
    throw new Error('CredentialRegistry ABI not found. Run contract compile to generate ABI artifacts.')
  }
}
