import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { IStorageAdapter } from './interfaces'
import { encrypt, decrypt, hashForIndex, isEncrypted } from './encryption'

export class SqliteStorageAdapter implements IStorageAdapter {
    private db: Database.Database
    private encryptionKey: string | null
    private indexPepper: string

    constructor(dbPath: string, options?: { encryptionKey?: string, indexPepper?: string }) {
        // Ensure directory exists
        const dir = path.dirname(dbPath)
        if (dbPath !== ':memory:' && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        this.db = new Database(dbPath)

        // Encryption key from options or environment
        // SECURITY: Encryption is REQUIRED in production
        this.encryptionKey = options?.encryptionKey || process.env.VC_ENCRYPTION_KEY || null

        const isProduction = process.env.NODE_ENV === 'production'

        if (isProduction && !this.encryptionKey) {
            throw new Error(
                'SECURITY ERROR: VC_ENCRYPTION_KEY is required in production. ' +
                'Credentials cannot be stored without encryption in production environments.'
            )
        }

        // SECURITY: Index pepper must be unique per deployment
        const indexPepper = options?.indexPepper || process.env.VC_INDEX_PEPPER
        if (isProduction && !indexPepper) {
            throw new Error(
                'SECURITY ERROR: VC_INDEX_PEPPER is required in production. ' +
                'Generate a unique random string for each deployment.'
            )
        }
        this.indexPepper = indexPepper || (() => {
            // Generate random pepper for development (changes each restart for safety)
            const crypto = require('crypto')
            console.warn('[SQLite] Using random index pepper for development (changes each restart)')
            return crypto.randomBytes(16).toString('hex')
        })()

        if (this.encryptionKey) {
            console.log('[SQLite] Credential encryption ENABLED')
        } else {
            console.warn('[SQLite] WARNING: Credentials stored without encryption (development only)')
        }

        this.initSchema()
    }

    private initSchema(): void {
        this.db.exec(`
      -- Verifiable Credentials
      CREATE TABLE IF NOT EXISTS vcs (
        id TEXT PRIMARY KEY,
        holder_address TEXT NOT NULL,
        vc_data TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_vcs_holder ON vcs(holder_address);

      -- Verifiable Presentations (verification history)
      CREATE TABLE IF NOT EXISTS vps (
        id TEXT PRIMARY KEY,
        vp_data TEXT NOT NULL,
        issuer TEXT,
        holder TEXT,
        verified_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_vps_issuer ON vps(issuer);
      CREATE INDEX IF NOT EXISTS idx_vps_holder ON vps(holder);

      -- Issuances (workflow state)
      CREATE TABLE IF NOT EXISTS issuances (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT,
        holder_address TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_issuances_status ON issuances(status);
      CREATE INDEX IF NOT EXISTS idx_issuances_holder ON issuances(holder_address);
    `)

        // Migrations
        try {
            const vcsColumns = this.db.prepare("PRAGMA table_info(vcs)").all() as any[]
            const vcsColumnNames = vcsColumns.map(c => c.name)

            if (!vcsColumnNames.includes('vc_data')) {
                this.db.exec('ALTER TABLE vcs ADD COLUMN vc_data TEXT')
                // Assuming 'data' existed before, but we don't have that in the CREATE TABLE above for old schema
                // If this is a fresh init, it's fine. If migration, we might need more logic.
            }
            if (!vcsColumnNames.includes('holder_address')) {
                this.db.exec('ALTER TABLE vcs ADD COLUMN holder_address TEXT')
                this.db.exec("UPDATE vcs SET holder_address = 'unknown' WHERE holder_address IS NULL")
            }

            const issuancesColumns = this.db.prepare("PRAGMA table_info(issuances)").all() as any[]
            const issuancesColumnNames = issuancesColumns.map(c => c.name)

            if (!issuancesColumnNames.includes('holder_address')) {
                this.db.exec('ALTER TABLE issuances ADD COLUMN holder_address TEXT')
            }
        } catch (err) {
            console.warn('Migration check failed:', err)
        }
    }

    // VCs
    async saveVC(id: string, vc: any): Promise<void> {
        const holderAddress = this.extractHolderAddress(vc)
        const holderHash = this.encryptionKey
            ? hashForIndex(holderAddress, this.indexPepper)
            : holderAddress

        // Encrypt VC data if encryption key is set
        const vcJson = JSON.stringify(vc)
        const vcData = this.encryptionKey
            ? encrypt(vcJson, this.encryptionKey)
            : vcJson

        const stmt = this.db.prepare(
            'INSERT OR REPLACE INTO vcs (id, holder_address, vc_data) VALUES (?, ?, ?)'
        )
        stmt.run(id, holderHash, vcData)
    }

    async loadVC(id: string): Promise<any | null> {
        const stmt = this.db.prepare('SELECT vc_data FROM vcs WHERE id = ?')
        const row = stmt.get(id) as { vc_data: string } | undefined

        if (!row) return null

        // Decrypt if encrypted
        try {
            if (this.encryptionKey && isEncrypted(row.vc_data)) {
                const decrypted = decrypt(row.vc_data, this.encryptionKey)
                return JSON.parse(decrypted)
            }
            return JSON.parse(row.vc_data)
        } catch (err) {
            console.error('[SQLite] Failed to load/decrypt VC:', err)
            return null
        }
    }

    /**
     * List VCs by holder address (requires knowing the original address for lookup)
     */
    async listVCsByHolder(holderAddress: string): Promise<any[]> {
        const holderHash = this.encryptionKey
            ? hashForIndex(holderAddress.toLowerCase(), this.indexPepper)
            : holderAddress.toLowerCase()

        const stmt = this.db.prepare('SELECT id, vc_data FROM vcs WHERE holder_address = ? ORDER BY created_at DESC')
        const rows = stmt.all(holderHash) as { id: string, vc_data: string }[]

        return rows.map(row => {
            try {
                if (this.encryptionKey && isEncrypted(row.vc_data)) {
                    const decrypted = decrypt(row.vc_data, this.encryptionKey)
                    return JSON.parse(decrypted)
                }
                return JSON.parse(row.vc_data)
            } catch {
                return null
            }
        }).filter(Boolean)
    }

    // VPs
    async saveVP(id: string, vp: any, metadata?: { issuer?: string, holder?: string }): Promise<void> {
        const issuer = metadata?.issuer || this.extractIssuer(vp) || null
        const holder = metadata?.holder || this.extractHolder(vp) || null

        const stmt = this.db.prepare(
            'INSERT OR REPLACE INTO vps (id, vp_data, issuer, holder) VALUES (?, ?, ?, ?)'
        )
        stmt.run(id, JSON.stringify(vp), issuer, holder)
    }

    async loadVP(id: string): Promise<any | null> {
        const stmt = this.db.prepare('SELECT vp_data FROM vps WHERE id = ?')
        const row = stmt.get(id) as { vp_data: string } | undefined
        return row ? JSON.parse(row.vp_data) : null
    }

    async listVPs(filter?: { issuer?: string, holder?: string }): Promise<any[]> {
        let query = 'SELECT vp_data FROM vps WHERE 1=1'
        const params: any[] = []

        if (filter?.issuer) {
            query += ' AND issuer = ?'
            params.push(filter.issuer)
        }
        if (filter?.holder) {
            query += ' AND holder = ?'
            params.push(filter.holder)
        }

        query += ' ORDER BY verified_at DESC'

        const stmt = this.db.prepare(query)
        const rows = stmt.all(...params) as { vp_data: string }[]
        return rows.map(row => JSON.parse(row.vp_data))
    }

    // Issuances
    async saveIssuance(id: string, data: any): Promise<void> {
        const status = data.status || 'DRAFT'
        const holderAddress = data.holderAddress ? data.holderAddress.toLowerCase() : null

        const stmt = this.db.prepare(
            `INSERT OR REPLACE INTO issuances (id, data, status, holder_address, updated_at) 
       VALUES (?, ?, ?, ?, unixepoch())`
        )
        stmt.run(id, JSON.stringify(data), status, holderAddress)
    }

    async loadIssuance(id: string): Promise<any | null> {
        const stmt = this.db.prepare('SELECT data FROM issuances WHERE id = ?')
        const row = stmt.get(id) as { data: string } | undefined
        return row ? JSON.parse(row.data) : null
    }

    async listIssuances(filter?: { status?: string, holderAddress?: string, limit?: number, offset?: number }): Promise<{ issuances: any[], total: number }> {
        const limit = filter?.limit || 100
        const offset = filter?.offset || 0

        let sql = 'SELECT id, data, status, created_at, updated_at FROM issuances WHERE 1=1'
        const params: any[] = []

        if (filter?.status) {
            sql += ' AND status = ?'
            params.push(filter.status)
        }

        if (filter?.holderAddress) {
            sql += ' AND holder_address = ?'
            params.push(filter.holderAddress.toLowerCase())
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        params.push(limit, offset)

        const stmt = this.db.prepare(sql)
        const rows = stmt.all(...params) as any[]

        const issuances = rows.map(row => {
            const data = JSON.parse(row.data)
            return {
                id: row.id,
                status: row.status || 'DRAFT',
                holderAddress: data.holderAddress || null,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                expiresAt: data.expiresAt || null,
                ...data
            }
        })

        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM issuances WHERE 1=1'
        const countParams: any[] = []
        if (filter?.status) {
            countSql += ' AND status = ?'
            countParams.push(filter.status)
        }
        if (filter?.holderAddress) {
            countSql += ' AND holder_address = ?'
            countParams.push(filter.holderAddress.toLowerCase())
        }

        const countStmt = this.db.prepare(countSql)
        const countResult = countStmt.get(...countParams) as { total: number }

        return { issuances, total: countResult.total }
    }

    // Utility
    close(): void {
        this.db.close()
    }

    // Private helpers
    private extractHolderAddress(vc: any): string {
        // Try to extract holder from credentialSubject
        const subject = vc?.credentialSubject || vc?.vc?.credentialSubject
        if (subject?.id) {
            // Handle DID format (did:ethr:0x...)
            const id = subject.id.toString()
            if (id.startsWith('did:ethr:')) {
                const parts = id.split(':')
                return parts[parts.length - 1].toLowerCase()
            }
            return id.toLowerCase()
        }
        if (subject?.holderAddress) {
            return subject.holderAddress.toString().toLowerCase()
        }
        return 'unknown'
    }

    private extractIssuer(vp: any): string | null {
        // Extract from verifiableCredential
        const vc = vp?.verifiableCredential?.[0] || vp?.vc
        if (vc?.issuer) {
            const issuer = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id
            return this.normalizeAddress(issuer)
        }
        return null
    }

    private extractHolder(vp: any): string | null {
        if (vp?.holder) {
            return this.normalizeAddress(vp.holder)
        }
        return null
    }

    private normalizeAddress(addr: string): string {
        if (addr.startsWith('did:ethr:')) {
            const parts = addr.split(':')
            return parts[parts.length - 1].toLowerCase()
        }
        return addr.toLowerCase()
    }
}
