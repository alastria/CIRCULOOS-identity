import initSqlJs, { Database } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { IStorageAdapter } from './interfaces'
import { encrypt, decrypt, hashForIndex, isEncrypted } from './encryption'

/**
 * SQLite storage using sql.js (pure JavaScript, no native bindings)
 * Works perfectly in Docker and all environments
 */
export class SqlJsStorageAdapter implements IStorageAdapter {
    private db: Database | null = null
    private dbPath: string
    private initialized = false
    private encryptionKey: string | null
    private indexPepper: string

    constructor(dbPath: string, options?: { encryptionKey?: string, indexPepper?: string }) {
        this.dbPath = dbPath

        // Encryption key from options or environment
        this.encryptionKey = options?.encryptionKey || process.env.VC_ENCRYPTION_KEY || null

        // Index pepper from options or environment
        const indexPepper = options?.indexPepper || process.env.VC_INDEX_PEPPER

        // If we are in production and encryption is missing, we should warn or throw
        // But since this adapter is often used in dev/docker, we'll just log
        const isProduction = process.env.NODE_ENV === 'production'

        if (isProduction && !this.encryptionKey) {
            console.error('SECURITY ERROR: VC_ENCRYPTION_KEY is required in production')
        }

        this.indexPepper = indexPepper || (() => {
            const crypto = require('crypto')
            console.warn('[SqlJs] Using random index pepper for development (changes each restart)')
            return crypto.randomBytes(16).toString('hex')
        })()

        if (this.encryptionKey) {
            console.log('[SqlJs] Credential encryption ENABLED')
        } else {
            console.warn('[SqlJs] WARNING: Credentials stored without encryption (development only)')
        }
    }

    private async init(): Promise<void> {
        if (this.initialized) return

        const SQL = await initSqlJs()

        // Load existing DB or create new one
        if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath)
            this.db = new SQL.Database(buffer)
        } else {
            this.db = new SQL.Database()
        }

        this.initSchema()
        this.initialized = true
    }

    private initSchema(): void {
        if (!this.db) return

        // Create tables
        this.db.run(`
      CREATE TABLE IF NOT EXISTS vcs (
        id TEXT PRIMARY KEY,
        holder_address TEXT NOT NULL,
        vc_data TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS vps (
        id TEXT PRIMARY KEY,
        vp_data TEXT NOT NULL,
        issuer TEXT,
        holder TEXT,
        verified_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS issuances (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS nonces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        nonce TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        used INTEGER NOT NULL DEFAULT 0
      );

      -- Blockchain Sync Tables
      CREATE TABLE IF NOT EXISTS blockchain_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        credential_hash TEXT NOT NULL UNIQUE,
        issuer_address TEXT NOT NULL,
        subject_address TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        is_revoked BOOLEAN NOT NULL DEFAULT 0,
        revoked_at INTEGER,
        revoked_by TEXT,
        revocation_reason TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS blockchain_trusted_issuers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL UNIQUE,
        added_by TEXT NOT NULL,
        removed_by TEXT,
        block_number INTEGER,
        tx_hash TEXT,
        timestamp INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        name TEXT,
        email TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pending_issuer_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL UNIQUE,
        name TEXT,
        email TEXT,
        requested_by TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY,
        last_synced_block INTEGER NOT NULL DEFAULT 0,
        last_sync_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)

        // Migrate existing tables (add missing columns)
        try {
            // Check if vcs table exists and get its columns
            const vcsTableInfo = this.db.exec("PRAGMA table_info(vcs)")
            const vcsColumns: string[] = []

            if (vcsTableInfo.length > 0 && vcsTableInfo[0].values.length > 0) {
                vcsColumns.push(...vcsTableInfo[0].values.map((row: any[]) => row[1] as string))
            }

            // Check if vc_data column exists (required)
            if (!vcsColumns.includes('vc_data')) {
                // If table exists but doesn't have vc_data, it's an old schema
                // We need to add the column or recreate the table
                if (vcsColumns.length > 0) {
                    // Table exists with old schema, add missing column
                    this.db.run('ALTER TABLE vcs ADD COLUMN vc_data TEXT')
                    // Try to migrate data from old column if it exists
                    if (vcsColumns.includes('data')) {
                        this.db.run('UPDATE vcs SET vc_data = data WHERE vc_data IS NULL')
                    }
                }
            }

            // Check if holder_address column exists
            if (!vcsColumns.includes('holder_address')) {
                // Add holder_address column if it doesn't exist (nullable first, then update)
                this.db.run('ALTER TABLE vcs ADD COLUMN holder_address TEXT')
                // Update existing rows with a default value
                this.db.run("UPDATE vcs SET holder_address = 'unknown' WHERE holder_address IS NULL")
            }

            // Check issuances table structure
            const issuancesTableInfo = this.db.exec("PRAGMA table_info(issuances)")
            const existingColumns: string[] = []

            if (issuancesTableInfo.length > 0 && issuancesTableInfo[0].values.length > 0) {
                existingColumns.push(...issuancesTableInfo[0].values.map((row: any[]) => row[1] as string))
            }

            // Add missing columns to issuances table
            if (!existingColumns.includes('data')) {
                this.db.run('ALTER TABLE issuances ADD COLUMN data TEXT NOT NULL DEFAULT \'{}\'')
                // Update existing rows if any
                this.db.run("UPDATE issuances SET data = '{}' WHERE data IS NULL")
            }

            if (!existingColumns.includes('status')) {
                this.db.run('ALTER TABLE issuances ADD COLUMN status TEXT')
                this.db.run("UPDATE issuances SET status = 'DRAFT' WHERE status IS NULL")
            }

            if (!existingColumns.includes('created_at')) {
                this.db.run('ALTER TABLE issuances ADD COLUMN created_at INTEGER DEFAULT (strftime(\'%s\', \'now\'))')
            }

            if (!existingColumns.includes('updated_at')) {
                this.db.run('ALTER TABLE issuances ADD COLUMN updated_at INTEGER DEFAULT (strftime(\'%s\', \'now\'))')
            }

            if (!existingColumns.includes('holder_address')) {
                this.db.run('ALTER TABLE issuances ADD COLUMN holder_address TEXT')
                // Try to populate from data JSON
                const rows = this.db.exec('SELECT id, data FROM issuances')
                if (rows.length > 0 && rows[0].values.length > 0) {
                    for (const row of rows[0].values) {
                        try {
                            const id = row[0] as string
                            const data = JSON.parse(row[1] as string)
                            if (data.holderAddress) {
                                this.db.run('UPDATE issuances SET holder_address = ? WHERE id = ?', [data.holderAddress.toLowerCase(), id])
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            }

            // Migrate blockchain_trusted_issuers to add name and email columns
            const trustedIssuersInfo = this.db.exec("PRAGMA table_info(blockchain_trusted_issuers)")
            const trustedIssuersColumns: string[] = []
            if (trustedIssuersInfo.length > 0 && trustedIssuersInfo[0].values.length > 0) {
                trustedIssuersColumns.push(...trustedIssuersInfo[0].values.map((row: any[]) => row[1] as string))
            }

            if (trustedIssuersColumns.length > 0 && !trustedIssuersColumns.includes('name')) {
                this.db.run('ALTER TABLE blockchain_trusted_issuers ADD COLUMN name TEXT')
            }

            if (trustedIssuersColumns.length > 0 && !trustedIssuersColumns.includes('email')) {
                this.db.run('ALTER TABLE blockchain_trusted_issuers ADD COLUMN email TEXT')
            }
        } catch (err) {
            // Table might not exist yet or migration failed, ignore
            console.warn('Migration check failed:', err)
        }

        // Create indexes (after ensuring columns exist)
        this.db.run('CREATE INDEX IF NOT EXISTS idx_vcs_holder ON vcs(holder_address)')
        this.db.run('CREATE INDEX IF NOT EXISTS idx_vps_issuer ON vps(issuer)')
        this.db.run('CREATE INDEX IF NOT EXISTS idx_vps_holder ON vps(holder)')
        this.db.run('CREATE INDEX IF NOT EXISTS idx_issuances_status ON issuances(status)')
        this.db.run('CREATE INDEX IF NOT EXISTS idx_issuances_holder ON issuances(holder_address)')
        this.db.run('CREATE INDEX IF NOT EXISTS idx_nonces_address ON nonces(address)')
        this.db.run('CREATE INDEX IF NOT EXISTS idx_nonces_expires ON nonces(expires_at)')
        this.db.run('CREATE INDEX IF NOT EXISTS idx_nonces_used ON nonces(used)')

        this.save()
    }

    private save(): void {
        if (!this.db || this.dbPath === ':memory:') return

        const dir = path.dirname(this.dbPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        const data = this.db.export()
        fs.writeFileSync(this.dbPath, Buffer.from(data))
    }

    async saveVC(id: string, vc: any): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        const holderAddress = this.extractHolderAddress(vc)
        const holderHash = this.encryptionKey
            ? hashForIndex(holderAddress, this.indexPepper)
            : holderAddress

        // Encrypt VC data if encryption key is set
        const vcJson = JSON.stringify(vc)
        const vcData = this.encryptionKey
            ? encrypt(vcJson, this.encryptionKey)
            : vcJson

        this.db.run(
            'INSERT OR REPLACE INTO vcs (id, holder_address, vc_data) VALUES (?, ?, ?)',
            [id, holderHash, vcData]
        )
        this.save()
    }

    async loadVC(id: string): Promise<any | null> {
        await this.init()
        if (!this.db) return null

        const result = this.db.exec('SELECT vc_data FROM vcs WHERE id = ?', [id])
        if (result.length === 0 || result[0].values.length === 0) return null

        const vcData = result[0].values[0][0] as string

        try {
            if (this.encryptionKey && isEncrypted(vcData)) {
                const decrypted = decrypt(vcData, this.encryptionKey)
                return JSON.parse(decrypted)
            }
            return JSON.parse(vcData)
        } catch (err) {
            console.error('[SqlJs] Failed to load/decrypt VC:', err)
            return null
        }
    }

    async saveVP(id: string, vp: any, metadata?: { issuer?: string, holder?: string }): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        const issuer = metadata?.issuer || this.extractIssuer(vp) || null
        const holder = metadata?.holder || this.extractHolder(vp) || null

        this.db.run(
            'INSERT OR REPLACE INTO vps (id, vp_data, issuer, holder) VALUES (?, ?, ?, ?)',
            [id, JSON.stringify(vp), issuer, holder]
        )
        this.save()
    }

    async loadVP(id: string): Promise<any | null> {
        await this.init()
        if (!this.db) return null

        const result = this.db.exec('SELECT vp_data FROM vps WHERE id = ?', [id])
        if (result.length === 0 || result[0].values.length === 0) return null

        return JSON.parse(result[0].values[0][0] as string)
    }

    async listVPs(filter?: { issuer?: string, holder?: string }): Promise<any[]> {
        await this.init()
        if (!this.db) return []

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

        const result = this.db.exec(query, params)
        if (result.length === 0) return []

        return result[0].values.map((row: any) => JSON.parse(row[0] as string))
    }

    async saveIssuance(id: string, data: any): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        const status = data.status || 'DRAFT'
        const holderAddress = data.holderAddress ? data.holderAddress.toLowerCase() : null

        this.db.run(
            `INSERT OR REPLACE INTO issuances (id, data, status, holder_address, updated_at) 
       VALUES (?, ?, ?, ?, strftime('%s', 'now'))`,
            [id, JSON.stringify(data), status, holderAddress]
        )
        this.save()
    }

    async loadIssuance(id: string): Promise<any | null> {
        await this.init()
        if (!this.db) return null

        const result = this.db.exec('SELECT data FROM issuances WHERE id = ?', [id])
        if (result.length === 0 || result[0].values.length === 0) return null

        return JSON.parse(result[0].values[0][0] as string)
    }

    async listIssuances(filter?: { status?: string, holderAddress?: string, limit?: number, offset?: number }): Promise<{ issuances: any[], total: number }> {
        await this.init()
        if (!this.db) return { issuances: [], total: 0 }

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

        const result = this.db.exec(sql, params)
        const issuances: any[] = []

        if (result.length > 0 && result[0].values.length > 0) {
            for (const row of result[0].values) {
                const [id, dataJson, status, createdAt, updatedAt] = row
                const data = JSON.parse(dataJson as string)

                issuances.push({
                    id: id as string,
                    status: status as string || 'DRAFT',
                    holderAddress: data.holderAddress || null,
                    createdAt: createdAt as number || null,
                    updatedAt: updatedAt as number || null,
                    expiresAt: data.expiresAt || null,
                    ...data // Include all data
                })
            }
        }

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
        const countResult = this.db.exec(countSql, countParams)
        const total = countResult.length > 0 && countResult[0].values.length > 0
            ? Number(countResult[0].values[0][0])
            : 0

        return { issuances, total }
    }

    close(): void {
        if (this.db) {
            this.save()
            this.db.close()
            this.db = null
            this.initialized = false
        }
    }

    // Helper methods
    private extractHolderAddress(vc: any): string {
        const subject = vc?.credentialSubject || vc?.vc?.credentialSubject
        if (subject?.id) {
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

    // Nonce management methods
    async saveNonce(address: string, nonce: string, expiresAt: number): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            'INSERT INTO nonces (address, nonce, expires_at, created_at, used) VALUES (?, ?, ?, ?, ?)',
            [address.toLowerCase(), nonce, Math.floor(expiresAt / 1000), Math.floor(Date.now() / 1000), 0]
        )
        this.save()
    }

    async getNonce(address: string, nonce: string): Promise<{ nonce: string; createdAt: Date; used: boolean; expiresAt: Date } | null> {
        await this.init()
        if (!this.db) return null

        const result = this.db.exec(
            'SELECT nonce, created_at, used, expires_at FROM nonces WHERE address = ? AND nonce = ?',
            [address.toLowerCase(), nonce]
        )

        if (result.length === 0 || result[0].values.length === 0) return null

        const row = result[0].values[0]
        const expiresAtSeconds = row[3] as number
        const currentTimeSeconds = Math.floor(Date.now() / 1000)

        // Check if expired
        if (expiresAtSeconds < currentTimeSeconds) {
            await this.deleteNonce(address, nonce)
            return null
        }

        return {
            nonce: row[0] as string,
            createdAt: new Date((row[1] as number) * 1000),
            used: (row[2] as number) === 1,
            expiresAt: new Date(expiresAtSeconds * 1000)
        }
    }

    async markNonceAsUsed(address: string, nonce: string): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            'UPDATE nonces SET used = 1 WHERE address = ? AND nonce = ?',
            [address.toLowerCase(), nonce]
        )
        this.save()
    }

    async deleteNonce(address: string, nonce: string): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            'DELETE FROM nonces WHERE address = ? AND nonce = ?',
            [address.toLowerCase(), nonce]
        )
        this.save()
    }

    async cleanupExpiredNonces(): Promise<number> {
        await this.init()
        if (!this.db) return 0

        const expiredThresholdSeconds = Math.floor((Date.now() - (15 * 60 * 1000)) / 1000)

        const result = this.db.exec(
            'SELECT COUNT(*) FROM nonces WHERE expires_at < ? OR (used = 1 AND created_at < ?)',
            [expiredThresholdSeconds, expiredThresholdSeconds]
        )

        const count = result.length > 0 && result[0].values.length > 0 ? (result[0].values[0][0] as number) : 0

        if (count > 0) {
            this.db.run(
                'DELETE FROM nonces WHERE expires_at < ? OR (used = 1 AND created_at < ?)',
                [expiredThresholdSeconds, expiredThresholdSeconds]
            )
            this.save()
        }

        return count
    }
    // Blockchain Sync Methods

    async getLastSyncedBlock(): Promise<number> {
        await this.init()
        if (!this.db) return 0

        const result = this.db.exec('SELECT last_synced_block FROM sync_state WHERE id = 1')
        if (result.length === 0 || result[0].values.length === 0) return 0

        return result[0].values[0][0] as number
    }

    async updateSyncState(blockNumber: number): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            'INSERT OR REPLACE INTO sync_state (id, last_synced_block, last_sync_time, updated_at) VALUES (1, ?, datetime("now"), datetime("now"))',
            [blockNumber]
        )
        this.save()
    }

    async insertCredentialIssuance(data: {
        credentialHash: string
        issuer: string
        subject: string
        blockNumber: number
        txHash: string
        timestamp: Date
    }): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            `INSERT OR REPLACE INTO blockchain_credentials 
            (credential_hash, issuer_address, subject_address, block_number, tx_hash, timestamp, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
            [
                data.credentialHash,
                data.issuer.toLowerCase(),
                data.subject.toLowerCase(),
                data.blockNumber,
                data.txHash,
                Math.floor(data.timestamp.getTime() / 1000) // Store as unix timestamp for consistency
            ]
        )
        this.save()
    }

    async updateCredentialRevocation(data: {
        credentialHash: string
        revoker: string
        blockNumber: number // Not stored in revocation columns but useful for context if we expanded schema
        txHash: string      // Same here
        timestamp: Date
        reason?: string
    }): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            `UPDATE blockchain_credentials 
            SET is_revoked = 1, 
                revoked_at = ?, 
                revoked_by = ?, 
                revocation_reason = ?,
                updated_at = datetime("now")
            WHERE credential_hash = ?`,
            [
                Math.floor(data.timestamp.getTime() / 1000),
                data.revoker.toLowerCase(),
                data.reason || null,
                data.credentialHash
            ]
        )
        this.save()
    }

    async insertTrustedIssuer(data: {
        address: string
        addedBy: string
        blockNumber: number
        txHash: string
        timestamp: Date
        isActive: boolean
    }): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            `INSERT OR REPLACE INTO blockchain_trusted_issuers
            (address, added_by, block_number, tx_hash, timestamp, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
            [
                data.address.toLowerCase(),
                data.addedBy.toLowerCase(),
                data.blockNumber,
                data.txHash,
                Math.floor(data.timestamp.getTime() / 1000),
                data.isActive ? 1 : 0
            ]
        )
        this.save()
    }

    async updateTrustedIssuer(data: {
        address: string
        removedBy: string
        blockNumber: number
        txHash: string
        timestamp: Date
        isActive: boolean
    }): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            `UPDATE blockchain_trusted_issuers
            SET is_active = ?,
                removed_by = ?,
                updated_at = datetime("now")
            WHERE address = ?`,
            [
                data.isActive ? 1 : 0,
                data.removedBy.toLowerCase(),
                data.address.toLowerCase()
            ]
        )
        this.save()
    }

    async getBlockchainStats(): Promise<{
        totalCredentials: number
        activeCredentials: number
        revokedCredentials: number
        totalIssuers: number
        activeIssuers: number
    }> {
        await this.init()
        if (!this.db) return { totalCredentials: 0, activeCredentials: 0, revokedCredentials: 0, totalIssuers: 0, activeIssuers: 0 }

        const credsResult = this.db.exec(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_revoked = 1 THEN 1 ELSE 0 END) as revoked
            FROM blockchain_credentials
        `)

        const issuersResult = this.db.exec(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
            FROM blockchain_trusted_issuers
        `)

        const totalCreds = credsResult.length > 0 ? (credsResult[0].values[0][0] as number) : 0
        const revokedCreds = credsResult.length > 0 ? (credsResult[0].values[0][1] as number) : 0

        const totalIssuers = issuersResult.length > 0 ? (issuersResult[0].values[0][0] as number) : 0
        const activeIssuers = issuersResult.length > 0 ? (issuersResult[0].values[0][1] as number) : 0

        return {
            totalCredentials: totalCreds,
            activeCredentials: totalCreds - revokedCreds,
            revokedCredentials: revokedCreds,
            totalIssuers: totalIssuers,
            activeIssuers: activeIssuers
        }
    }

    async getBlockchainCredentials(filter?: {
        limit?: number
        offset?: number
        issuer?: string
        subject?: string
        revoked?: boolean
    }): Promise<any[]> {
        await this.init()
        if (!this.db) return []

        const limit = filter?.limit || 50
        const offset = filter?.offset || 0

        let sql = 'SELECT * FROM blockchain_credentials WHERE 1=1'
        const params: any[] = []

        if (filter?.issuer) {
            sql += ' AND issuer_address = ?'
            params.push(filter.issuer.toLowerCase())
        }
        if (filter?.subject) {
            sql += ' AND subject_address = ?'
            params.push(filter.subject.toLowerCase())
        }
        if (filter?.revoked !== undefined) {
            sql += ' AND is_revoked = ?'
            params.push(filter.revoked ? 1 : 0)
        }

        sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        params.push(limit, offset)

        const result = this.db.exec(sql, params)
        if (result.length === 0) return []

        // Map columns to object
        const columns = result[0].columns
        return result[0].values.map(row => {
            const obj: any = {}
            columns.forEach((col, i) => {
                obj[col] = row[i]
            })
            return obj
        })
    }

    async countBlockchainCredentials(filter?: {
        issuer?: string
        subject?: string
        revoked?: boolean
    }): Promise<number> {
        await this.init()
        if (!this.db) return 0

        let sql = 'SELECT COUNT(*) FROM blockchain_credentials WHERE 1=1'
        const params: any[] = []

        if (filter?.issuer) {
            sql += ' AND issuer_address = ?'
            params.push(filter.issuer.toLowerCase())
        }
        if (filter?.subject) {
            sql += ' AND subject_address = ?'
            params.push(filter.subject.toLowerCase())
        }
        if (filter?.revoked !== undefined) {
            sql += ' AND is_revoked = ?'
            params.push(filter.revoked ? 1 : 0)
        }

        const result = this.db.exec(sql, params)
        if (result.length === 0) return 0
        return result[0].values[0][0] as number
    }

    async getTrustedIssuers(filter?: { active?: boolean }): Promise<any[]> {
        await this.init()
        if (!this.db) return []

        let sql = 'SELECT * FROM blockchain_trusted_issuers WHERE 1=1'
        const params: any[] = []

        if (filter?.active !== undefined) {
            sql += ' AND is_active = ?'
            params.push(filter.active ? 1 : 0)
        }

        sql += ' ORDER BY timestamp DESC'

        const result = this.db.exec(sql, params)
        if (result.length === 0) return []

        const columns = result[0].columns
        return result[0].values.map(row => {
            const obj: any = {}
            columns.forEach((col, i) => {
                obj[col] = row[i]
            })
            return obj
        })
    }

    // ============ Pending Issuer Metadata Methods ============

    /**
     * Save pending issuer metadata before blockchain TX
     * This will be associated with the issuer when IssuerAdded event is captured
     */
    async savePendingIssuerMetadata(data: {
        address: string
        name?: string
        email?: string
        requestedBy?: string
    }): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            `INSERT OR REPLACE INTO pending_issuer_metadata
            (address, name, email, requested_by, created_at)
            VALUES (?, ?, ?, ?, datetime("now"))`,
            [
                data.address.toLowerCase(),
                data.name || null,
                data.email || null,
                data.requestedBy?.toLowerCase() || null
            ]
        )
        this.save()
    }

    /**
     * Get pending issuer metadata by address
     */
    async getPendingIssuerMetadata(address: string): Promise<{
        address: string
        name?: string
        email?: string
        requestedBy?: string
    } | null> {
        await this.init()
        if (!this.db) return null

        const result = this.db.exec(
            `SELECT address, name, email, requested_by FROM pending_issuer_metadata WHERE address = ?`,
            [address.toLowerCase()]
        )

        if (result.length === 0 || result[0].values.length === 0) return null

        const row = result[0].values[0]
        return {
            address: row[0] as string,
            name: row[1] as string | undefined,
            email: row[2] as string | undefined,
            requestedBy: row[3] as string | undefined
        }
    }

    /**
     * Delete pending issuer metadata after it's been consumed
     */
    async deletePendingIssuerMetadata(address: string): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            `DELETE FROM pending_issuer_metadata WHERE address = ?`,
            [address.toLowerCase()]
        )
        this.save()
    }

    /**
     * Insert trusted issuer with metadata from pending
     * This is called when IssuerAdded event is captured
     */
    async insertTrustedIssuerWithMetadata(data: {
        address: string
        addedBy: string
        blockNumber: number
        txHash: string
        timestamp: Date
        isActive: boolean
        name?: string
        email?: string
    }): Promise<void> {
        await this.init()
        if (!this.db) throw new Error('Database not initialized')

        this.db.run(
            `INSERT OR REPLACE INTO blockchain_trusted_issuers
            (address, added_by, block_number, tx_hash, timestamp, is_active, name, email, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
            [
                data.address.toLowerCase(),
                data.addedBy.toLowerCase(),
                data.blockNumber,
                data.txHash,
                Math.floor(data.timestamp.getTime() / 1000),
                data.isActive ? 1 : 0,
                data.name || null,
                data.email || null
            ]
        )
        this.save()
    }
}
