import { BigNumber, Signer, providers, utils } from 'ethers'

/**
 * ethers v5 Signer that delegates transaction signing to a Web3Signer instance
 * (`eth_signTransaction` over JSON-RPC), so no private key lives in this process or its
 * environment. Used for the on-chain writes of the issuer backend and the Red-B deploy
 * (plan A4, gap G2) — the same custody model the IoT panel runs on Red-B.
 *
 * Only transactions are delegated: messages and typed data are never signed with this key.
 */
export class Web3SignerSigner extends Signer {
  readonly address: string

  constructor(
    private readonly url: string,
    address: string,
    readonly provider?: providers.Provider,
  ) {
    super()
    if (!utils.isAddress(address)) throw new Error(`Web3SignerSigner: invalid address ${address}`)
    this.address = utils.getAddress(address)
  }

  connect(provider: providers.Provider): Web3SignerSigner {
    return new Web3SignerSigner(this.url, this.address, provider)
  }

  async getAddress(): Promise<string> {
    return this.address
  }

  /**
   * Transactions without explicit fee fields are sent as legacy transactions at the network's
   * own eth_gasPrice. On Red-B that is 0; left to ethers v5, an EIP-1559 network would get a
   * 1.5 gwei priority fee that an unfunded account cannot pay.
   */
  async populateTransaction(transaction: utils.Deferrable<providers.TransactionRequest>): Promise<providers.TransactionRequest> {
    const tx = await utils.resolveProperties(transaction)
    if (tx.type == null && tx.gasPrice == null && tx.maxFeePerGas == null && tx.maxPriorityFeePerGas == null) {
      if (!this.provider) throw new Error('Web3SignerSigner: a provider is required to populate a transaction')
      return super.populateTransaction({ ...tx, type: 0, gasPrice: await this.provider.getGasPrice() })
    }
    return super.populateTransaction(tx)
  }

  async signTransaction(transaction: providers.TransactionRequest): Promise<string> {
    const tx = await utils.resolveProperties(transaction)
    const hex = (v: any) => BigNumber.from(v).toHexString().replace(/^0x0+(?=[0-9a-f])/, '0x')
    const params: Record<string, string> = { from: this.address }
    if (tx.to) params.to = String(tx.to)
    if (tx.data) params.data = utils.hexlify(tx.data)
    if (tx.value !== undefined && tx.value !== null) params.value = hex(tx.value)
    if (tx.gasLimit !== undefined && tx.gasLimit !== null) params.gas = hex(tx.gasLimit)
    if (tx.nonce !== undefined && tx.nonce !== null) params.nonce = hex(tx.nonce)
    if (tx.chainId !== undefined && tx.chainId !== null) params.chainId = hex(tx.chainId)
    if (tx.maxFeePerGas !== undefined && tx.maxFeePerGas !== null) {
      params.maxFeePerGas = hex(tx.maxFeePerGas)
      params.maxPriorityFeePerGas = hex(tx.maxPriorityFeePerGas ?? 0)
    } else if (tx.gasPrice !== undefined && tx.gasPrice !== null) {
      params.gasPrice = hex(tx.gasPrice)
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_signTransaction', params: [params] }),
    })
    const body = (await response.json()) as { result?: string; error?: { message?: string } }
    if (!body.result) {
      throw new Error(`Web3Signer eth_signTransaction failed: ${body.error?.message ?? JSON.stringify(body.error)}`)
    }
    return body.result
  }

  async signMessage(_message: string | utils.Bytes): Promise<string> {
    throw new Error('Web3SignerSigner.signMessage is not implemented: only transactions are delegated to Web3Signer')
  }

  async _signTypedData(_domain: any, _types: any, _value: any): Promise<string> {
    throw new Error('Web3SignerSigner._signTypedData is not implemented: only transactions are delegated to Web3Signer')
  }
}
