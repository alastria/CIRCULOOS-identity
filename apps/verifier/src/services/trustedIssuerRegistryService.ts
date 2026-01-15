import { Contract, providers, utils } from 'ethers'
import { FileStore } from '@circuloos/file-store'
import { createTrustedIssuerRegistryClient, trustedIssuerRegistryAbi, type TrustedIssuerRegistryClient } from '@circuloos/common'
import { config } from '../config'

type IssuerRecord = {
  address: string
  ensName?: string | null
  addedAtBlock: number
  addedBy: string
  addedTxHash: string
  removedAtBlock?: number
  removedBy?: string
  removedTxHash?: string
}

type StoredState = {
  issuers: Record<string, IssuerRecord>
  lastProcessedBlock: number
}

export class TrustedIssuerRegistryService {
  private store: FileStore
  private storageKey: string
  private provider: providers.JsonRpcProvider
  private contract: Contract
  private startBlock: number
  private listenerBound = false
  private client: TrustedIssuerRegistryClient

  constructor(opts: {
    storagePath?: string
    providerUrl?: string
    registryAddress?: string
    startBlock?: number
    store?: FileStore
    client?: TrustedIssuerRegistryClient
    sqlStore?: any
  }) {
    const { storagePath = 'trusted-issuers/state.json', providerUrl, registryAddress, startBlock = 0 } = opts
    this.store = opts.store ?? new FileStore(config.filestore.baseDir)
    this.client =
      opts.client ??
      createTrustedIssuerRegistryClient({
        address: registryAddress,
        rpcUrl: providerUrl,
      })
    this.provider = this.client.provider as providers.JsonRpcProvider
    this.contract = opts.client?.contract ?? new Contract(this.client.address, trustedIssuerRegistryAbi, this.provider)
    this.storageKey = storagePath
    this.startBlock = startBlock
    // optional sqlite-backed store
    if (opts.sqlStore) this.sqlStore = opts.sqlStore
  }

  async isTrustedIssuer(address: string): Promise<boolean> {
    return this.client.isTrustedIssuer(address)
  }

  async getState(): Promise<StoredState> {
    const state = await this.store.loadAll(this.storageKey)
    if (!state || !state.issuers) {
      return { issuers: {}, lastProcessedBlock: this.startBlock }
    }
    return state as StoredState
  }

  async saveState(state: StoredState) {
    await this.store.writeAtomic(this.storageKey, state)
  }

  // optional sqlite methods
  private sqlStore?: any


  async sync(fromBlock?: number) {
    const currentState = await this.getState()
    let start = fromBlock !== undefined ? fromBlock : Math.max(this.startBlock, currentState.lastProcessedBlock)
    const latest = await this.provider.getBlockNumber()
    // if the provider's latest block is behind our stored last processed block
    // (for example after switching to a fresh local node), force a full resync
    if (latest < start) {
      // reset to genesis and reindex
      start = 0
    }

    const addedFilter = this.contract.filters.IssuerAdded()
    const removedFilter = this.contract.filters.IssuerRemoved()

    const [addedEvents, removedEvents] = await Promise.all([
      this.contract.queryFilter(addedFilter, start, latest),
      this.contract.queryFilter(removedFilter, start, latest),
    ])

    const issuers = { ...currentState.issuers }

    for (const event of addedEvents) {
      const [issuer, addedBy] = event.args as [string, string]
      const address = utils.getAddress(issuer)
      const ensName = await this.safeLookup(address)
      issuers[address.toLowerCase()] = {
        address,
        ensName,
        addedAtBlock: event.blockNumber,
        addedBy: utils.getAddress(addedBy),
        addedTxHash: event.transactionHash,
      }
    }

    for (const event of removedEvents) {
      const [issuer, removedBy] = event.args as [string, string]
      const address = utils.getAddress(issuer)
      const key = address.toLowerCase()
      const existing = issuers[key]
      if (existing) {
        issuers[key] = {
          ...existing,
          removedAtBlock: event.blockNumber,
          removedBy: utils.getAddress(removedBy),
          removedTxHash: event.transactionHash,
        }
      } else {
        issuers[key] = {
          address,
          ensName: await this.safeLookup(address),
          addedAtBlock: 0,
          addedBy: utils.getAddress(removedBy),
          addedTxHash: '',
          removedAtBlock: event.blockNumber,
          removedBy: utils.getAddress(removedBy),
          removedTxHash: event.transactionHash,
        }
      }
    }

    const nextState: StoredState = {
      issuers,
      lastProcessedBlock: latest + 1,
    }

    await this.saveState(nextState)
    return nextState
  }

  async start() {
    if (this.listenerBound) return
    await this.sync()

    const handleAdded = async (issuer: string, addedBy: string, event: any) => {
      const state = await this.getState()
      const key = utils.getAddress(issuer).toLowerCase()
      const ensName = await this.safeLookup(issuer)
      const updated: StoredState = {
        issuers: {
          ...state.issuers,
          [key]: {
            address: utils.getAddress(issuer),
            ensName,
            addedAtBlock: event.blockNumber,
            addedBy: utils.getAddress(addedBy),
            addedTxHash: event.transactionHash,
          },
        },
        lastProcessedBlock: Math.max(state.lastProcessedBlock, event.blockNumber + 1),
      }
      await this.saveState(updated)
      if (this.sqlStore) {
        try {
          this.sqlStore.saveIssuer({
            address: utils.getAddress(issuer),
            ensName,
            addedAtBlock: event.blockNumber,
            addedBy: utils.getAddress(addedBy),
            addedTxHash: event.transactionHash,
            removedAtBlock: null,
            removedBy: null,
            removedTxHash: null,
          })
        } catch (err) {
          // ignore sql errors
        }
      }
    }

    const handleRemoved = async (issuer: string, removedBy: string, event: any) => {
      const state = await this.getState()
      const key = utils.getAddress(issuer).toLowerCase()
      const existing = state.issuers[key]
      const record: IssuerRecord = existing
        ? {
          ...existing,
          removedAtBlock: event.blockNumber,
          removedBy: utils.getAddress(removedBy),
          removedTxHash: event.transactionHash,
        }
        : {
          address: utils.getAddress(issuer),
          ensName: await this.safeLookup(issuer),
          addedAtBlock: 0,
          addedBy: utils.getAddress(removedBy),
          addedTxHash: '',
          removedAtBlock: event.blockNumber,
          removedBy: utils.getAddress(removedBy),
          removedTxHash: event.transactionHash,
        }
      const updated: StoredState = {
        issuers: {
          ...state.issuers,
          [key]: record,
        },
        lastProcessedBlock: Math.max(state.lastProcessedBlock, event.blockNumber + 1),
      }
      await this.saveState(updated)
      if (this.sqlStore) {
        try {
          this.sqlStore.removeIssuer(utils.getAddress(issuer), event.blockNumber, utils.getAddress(removedBy), event.transactionHash)
        } catch (err) {
          // ignore sql errors
        }
      }
    }

    this.contract.on('IssuerAdded', handleAdded)
    this.contract.on('IssuerRemoved', handleRemoved)
    this.listenerBound = true
  }

  async stop() {
    if (!this.listenerBound) return
    this.contract.removeAllListeners('IssuerAdded')
    this.contract.removeAllListeners('IssuerRemoved')
    this.listenerBound = false
  }

  async listIssuers(opts?: { includeRemoved?: boolean }): Promise<IssuerRecord[]> {
    const includeRemoved = opts?.includeRemoved ?? false
    if (this.sqlStore) {
      return this.sqlStore.list(includeRemoved)
    }
    const state = await this.getState()
    const records = Object.values(state.issuers)
    if (includeRemoved) {
      return records.sort((a, b) => a.address.localeCompare(b.address))
    }
    return records.filter((r) => !r.removedAtBlock).sort((a, b) => a.address.localeCompare(b.address))
  }

  private async safeLookup(address: string): Promise<string | null> {
    try {
      const resolved = await this.provider.lookupAddress(utils.getAddress(address))
      return resolved || null
    } catch (err) {
      return null
    }
  }
}
