/**
 * Plan A4.0 — full rehearsal of the Red-B deployment against a local Hardhat node posing as
 * Red-B (chainId 2020), with keys held by a fake Web3Signer (no private key reaches any script
 * or service). Runs the scripts in apps/contracts/scripts/redb exactly as on the VPS
 * (deploy → trusted issuers → verify → smoke), then the whole credential flow on the result:
 * issuance through Web3Signer, login verified against the chain, on-chain revocation.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { spawn, execFile, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import { ethers } from 'ethers'
import {
  createTrustedIssuerRegistryClient,
  getCredentialType,
  hashVC,
  EMPLOYEE_SCHEMA_ID,
  REVOCATION_TYPES,
  buildRevocationMessage,
  InMemoryLoginChallengeStore,
  buildLoginTypedData,
  verifyEmployeeLogin,
} from '@circuloos/common'
import { IssuanceService } from '../../src/services/issuanceService'
import { devWallet } from './local-chain'
import { startFakeWeb3Signer, type FakeWeb3Signer } from './fake-web3signer'

vi.mock('../../src/services/notification.service', () => ({
  NotificationService: vi.fn().mockImplementation(() => ({ sendClaimInfo: vi.fn() })),
}))

const CONTRACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'contracts')
const HARDHAT_CLI = path.join(CONTRACTS_DIR, 'node_modules', 'hardhat', 'internal', 'cli', 'cli.js')
const owner = devWallet(7) // Diamond owner, held by Web3Signer
const backendKey = devWallet(8) // issuer backend's on-chain key, held by Web3Signer
const alastria = devWallet(2) // human trusted issuer (signs credentials in the browser)
const holder = devWallet(4)
const ORG = { legalName: 'Khoani B&A S.L.', taxID: 'ESB12345678', addressCountry: 'ES' }

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

describe('A4.0 — Red-B deployment rehearsal (local node as chainId 2020, keys in Web3Signer)', () => {
  let node: ChildProcess
  let rpcUrl: string
  let provider: ethers.providers.JsonRpcProvider
  let web3signer: FakeWeb3Signer
  let tmpDir: string
  let manifestPath: string

  /** Runs a scripts/redb script through `hardhat run --network redb`, as on the VPS. */
  function runScript(script: string, env: Record<string, string> = {}): Promise<{ code: number; output: string }> {
    const base = { ...process.env }
    for (const k of ['DEPLOYER_PRIVATE_KEY', 'PRIVATE_KEY', 'ISSUER_PRIVATE_KEY', 'DIAMOND_OWNER_PRIVATE_KEY', 'LOCAL_DEPLOYER_PRIVATE_KEY', 'DEV_DEPLOYER_PRIVATE_KEY']) delete base[k]
    const fullEnv = {
      ...base,
      REDB_RPC_URL: rpcUrl,
      REDB_CHAIN_ID: '2020',
      EXPECTED_CHAIN_ID: '2020',
      WEB3SIGNER_URL: web3signer.url,
      OWNER_ADDRESS: owner.address,
      BACKEND_ADDRESS: backendKey.address,
      MANIFEST_PATH: manifestPath,
      ALLOW_DIRTY_TREE: 'true',
      ...env,
    }
    return new Promise((resolve) => {
      execFile(process.execPath, [HARDHAT_CLI, 'run', '--network', 'redb', `scripts/redb/${script}`], { cwd: CONTRACTS_DIR, env: fullEnv, timeout: 120_000 }, (err, stdout, stderr) =>
        resolve({ code: err ? (err as any).code ?? 1 : 0, output: stdout + stderr }),
      )
    })
  }

  beforeAll(async () => {
    const port = await freePort()
    rpcUrl = `http://127.0.0.1:${port}`
    node = spawn(process.execPath, [HARDHAT_CLI, 'node', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: CONTRACTS_DIR,
      env: { ...process.env, HARDHAT_CHAIN_ID: '2020' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    node.stderr!.on('data', () => {}) // keep the pipe drained so the node never blocks on it
    await new Promise<void>((resolve, reject) => {
      let out = ''
      node.stdout!.on('data', (c: Buffer) => {
        out += c.toString()
        if (out.includes('Started HTTP')) resolve()
      })
      node.once('exit', (code) => reject(new Error(`hardhat node exited (${code}): ${out}`)))
    })
    provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    web3signer = await startFakeWeb3Signer([owner, backendKey])
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-redb-rehearsal-'))
    manifestPath = path.join(tmpDir, 'deployed-redb.json')
  }, 120_000)

  afterAll(async () => {
    provider?.removeAllListeners()
    await web3signer?.stop()
    if (node && node.exitCode === null) {
      const exited = new Promise((r) => node.once('exit', r))
      node.kill()
      await exited
    }
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('the chain id guard aborts before any transaction when the network is not the expected one', async () => {
    const height = await provider.getBlockNumber()
    const run = await runScript('deploy-redb.ts', { EXPECTED_CHAIN_ID: '31337' })
    expect(run.code).not.toBe(0)
    expect(run.output, run.output).toMatch(/expected 31337/)
    expect(await provider.getBlockNumber()).toBe(height)
    expect(fs.existsSync(manifestPath)).toBe(false)
  }, 180_000)

  it('A4.3 deploys the Diamond through Web3Signer and writes the manifest', async () => {
    const run = await runScript('deploy-redb.ts')
    expect(run.code, run.output).toBe(0)
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    expect(manifest.chainId).toBe(2020)
    expect(manifest.owner.toLowerCase()).toBe(owner.address.toLowerCase())
    expect(Object.keys(manifest.facets)).toEqual(['DiamondLoupeFacet', 'OwnershipFacet', 'TrustedIssuerFacet', 'CredentialStatusFacet', 'PausableFacet'])
    expect(manifest.transactions).toHaveLength(9)
    expect(web3signer.requests.every((r) => r.params[0].from.toLowerCase() === owner.address.toLowerCase())).toBe(true)
    expect(web3signer.requests.every((r) => r.params[0].gasPrice !== undefined && r.params[0].maxFeePerGas === undefined)).toBe(true)
  }, 180_000)

  it('A4.3 refuses to overwrite an existing manifest (no second deployment by mistake)', async () => {
    const height = await provider.getBlockNumber()
    const run = await runScript('deploy-redb.ts')
    expect(run.code).not.toBe(0)
    expect(run.output).toMatch(/Refusing to overwrite/)
    expect(await provider.getBlockNumber()).toBe(height)
  }, 180_000)

  it('A4.4 adds the trusted issuers (backend key and Alastria issuer), idempotently', async () => {
    const env = { TRUSTED_ISSUERS: `${backendKey.address},${alastria.address}` }
    expect((await runScript('add-trusted-issuers-redb.ts', env)).code).toBe(0)
    const again = await runScript('add-trusted-issuers-redb.ts', env)
    expect(again.code).toBe(0)
    expect(again.output).toMatch(/already trusted, skipped/)
  }, 180_000)

  it('A4.5 verification passes, and fails on a wrong expectation', async () => {
    const ok = await runScript('verify-redb.ts', { EXPECTED_TRUSTED_ISSUERS: `${alastria.address},${backendKey.address}` })
    expect(ok.code, ok.output).toBe(0)
    expect(ok.output).toMatch(/all checks passed/)

    const wrong = await runScript('verify-redb.ts', { EXPECTED_TRUSTED_ISSUERS: alastria.address })
    expect(wrong.code).not.toBe(0)
    expect(wrong.output).toMatch(/trusted issuers are exactly/)
  }, 180_000)

  it('A4.6 smoke test records and revokes a synthetic hash with the backend key', async () => {
    const run = await runScript('smoke-redb.ts')
    expect(run.code, run.output).toBe(0)
    expect(run.output).toMatch(/\[smoke-redb\] passed/)
  }, 180_000)

  it('end to end on the deployed Diamond: issue through Web3Signer, log in, revoke, login rejected', async () => {
    const { diamondAddress } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const registry = createTrustedIssuerRegistryClient({ address: diamondAddress, rpcUrl })
    const service = new IssuanceService({
      storage: (() => {
        const issuances = new Map<string, any>()
        const vcs = new Map<string, any>()
        return {
          loadIssuance: async (id: string) => issuances.get(id) ?? null,
          saveIssuance: async (id: string, d: any) => void issuances.set(id, d),
          loadVC: async (id: string) => vcs.get(id) ?? null,
          saveVC: async (id: string, vc: any) => void vcs.set(id, vc),
        }
      })() as any,
      hmacSecret: 'test-secret',
      trustedIssuerRegistry: registry,
      onchain: { diamondAddress, rpcUrl, web3signerUrl: web3signer.url, signerAddress: backendKey.address },
    })
    const prepared = await service.prepare('ana@khoani.example', holder.address, undefined, undefined, {
      credentialType: EMPLOYEE_SCHEMA_ID,
      organization: ORG,
    })
    const { types, messageBuilder } = getCredentialType(EMPLOYEE_SCHEMA_ID)!.schema.issuance
    await service.mint(prepared.id, await alastria._signTypedData(prepared.domain, types, messageBuilder(prepared.draftVc)), alastria.address, prepared.domain)
    expect((await (service as any).credential.loadIssuance(prepared.id)).onchain.status).toBe('recorded')

    const status = new ethers.Contract(diamondAddress, ['function getCredentialStatus(bytes32) view returns (bool issued, bool revoked, bool suspended, address issuer, uint256 issuedAt, uint256 revokedAt)'], provider)
    const login = async () => {
      const issued = await (service as any).credential.loadIssuedCredential(prepared.draftVc.id)
      const challenges = new InMemoryLoginChallengeStore()
      const challenge = await challenges.issue(holder.address, 'iot-manager')
      const { domain, types: loginTypes, message } = buildLoginTypedData(issued, challenge)
      return verifyEmployeeLogin(
        { credential: issued, signature: await holder._signTypedData(domain, loginTypes, message), nonce: challenge.nonce, audience: 'iot-manager' },
        {
          challenges,
          isTrustedIssuer: (a) => registry.isTrustedIssuer(a),
          credentialStatus: async (hash) => {
            const s = await status.getCredentialStatus(hash)
            return { issued: s.issued, revoked: s.revoked, suspended: s.suspended, issuer: s.issuer }
          },
        },
      )
    }
    expect(await login()).toMatchObject({ ok: true, organization: ORG })

    const revocation = await alastria._signTypedData(prepared.domain, REVOCATION_TYPES, buildRevocationMessage(prepared.draftVc.id, 'revoked_by_issuer'))
    await service.revoke(prepared.id, { wallet: alastria.address, role: 'issuer', reason: 'revoked_by_issuer', signature: revocation, signerAddress: alastria.address })
    expect((await status.getCredentialStatus(hashVC(prepared.draftVc))).revoked).toBe(true)
    expect(await login()).toMatchObject({ ok: false, code: 'REVOKED' })
  }, 180_000)
})
