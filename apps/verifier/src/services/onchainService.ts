import { FileStore } from '@circuloos/file-store'
import { ethers } from 'ethers'
const CredentialRegistryAbi: any = require('../../abi/CredentialRegistry.json')
const RevocationRegistryAbi: any = require('../../abi/RevocationRegistry.json')

export class OnchainService {
  credentialRegistry: any
  revocationRegistry: any
  provider: any
  store: FileStore

  constructor(opts: { rpcUrl: string, credentialRegistryAddress?: string, revocationRegistryAddress?: string, store: FileStore }) {
    this.provider = new ethers.providers.JsonRpcProvider(opts.rpcUrl)
    if (opts.credentialRegistryAddress) this.credentialRegistry = new ethers.Contract(opts.credentialRegistryAddress, CredentialRegistryAbi, this.provider)
    if (opts.revocationRegistryAddress) this.revocationRegistry = new ethers.Contract(opts.revocationRegistryAddress, RevocationRegistryAbi, this.provider)
    this.store = opts.store
    this.initListeners()
  }

  async initListeners() {
    if (this.credentialRegistry) {
  this.credentialRegistry.on('CredentialIssued', (vcHash: any, issuer: any, subject: any, timestamp: any, event: any) => {
        // persist to file-store under key onchain/issued/<vcHash>
        this.store.writeAtomic(`onchain/issued/${vcHash}.json`, { vcHash, issuer, subject, txHash: event.transactionHash, timestamp: Number(timestamp) }).catch(()=>{})
      })
    }
    if (this.revocationRegistry) {
      this.revocationRegistry.on('CredentialRevoked', (vcHash: any, revoker: any, timestamp: any, event: any) => {
        this.store.writeAtomic(`onchain/revoked/${vcHash}.json`, { vcHash, revoker, txHash: event.transactionHash, timestamp: Number(timestamp) }).catch(()=>{})
      })
    }
  }

  async isIssued(vcHash: string) {
    if (!this.credentialRegistry) return false
    return await this.credentialRegistry.isIssued(vcHash)
  }

  async isRevoked(vcHash: string) {
    if (!this.revocationRegistry) return false
    return await this.revocationRegistry.isRevoked(vcHash)
  }
}
