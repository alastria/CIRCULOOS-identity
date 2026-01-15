interface SqlCredentialStore {
  // Enhanced SQL store for hybrid credential management
  
  // Save credential issuance record
  saveCredentialRecord(record: {
    vcHash: string
    issuer: string
    subject: string
    timestamp: number
    blockNumber: number
    transactionHash: string
    indexed: boolean
    indexedAt: number
  }): Promise<void>

  // Save revocation record
  saveRevocationRecord(record: {
    vcHash: string
    revoker: string
    timestamp: number
    blockNumber: number
    transactionHash: string
    indexed: boolean
    indexedAt: number
  }): Promise<void>

  // Get credential by hash
  getCredential(vcHash: string): Promise<any | null>

  // Get revocation by hash
  getRevocation(vcHash: string): Promise<any | null>

  // List all credentials with filters
  listCredentials(opts?: {
    issuer?: string
    subject?: string
    includeRevoked?: boolean
    limit?: number
    offset?: number
  }): Promise<any[]>

  // Get stats
  getStats(): Promise<{
    totalCredentials: number
    totalRevocations: number
    uniqueIssuers: number
    uniqueSubjects: number
  }>
}

export class SqliteCredentialStore implements SqlCredentialStore {
  private db: any

  constructor(dbPath: string = './apps/verifier/tmp/hybrid-credentials.sqlite') {
    try {
      // Use dynamic import to avoid compilation issues
      // eslint-disable-next-line no-eval
      const Database = eval("require('better-sqlite3')")
      this.db = new Database(dbPath)
      this.initTables()
    } catch (err) {
      throw new Error(`Failed to initialize SQLite database: ${err}`)
    }
  }

  private initTables(): void {
    // Credentials table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        vcHash TEXT PRIMARY KEY,
        issuer TEXT NOT NULL,
        subject TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        blockNumber INTEGER NOT NULL,
        transactionHash TEXT NOT NULL,
        indexed INTEGER DEFAULT 1,
        indexedAt INTEGER NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Revocations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS revocations (
        vcHash TEXT PRIMARY KEY,
        revoker TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        blockNumber INTEGER NOT NULL,
        transactionHash TEXT NOT NULL,
        indexed INTEGER DEFAULT 1,
        indexedAt INTEGER NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (vcHash) REFERENCES credentials (vcHash)
      )
    `)

    // Indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_credentials_issuer ON credentials(issuer);
      CREATE INDEX IF NOT EXISTS idx_credentials_subject ON credentials(subject);
      CREATE INDEX IF NOT EXISTS idx_credentials_blockNumber ON credentials(blockNumber);
      CREATE INDEX IF NOT EXISTS idx_revocations_revoker ON revocations(revoker);
      CREATE INDEX IF NOT EXISTS idx_revocations_blockNumber ON revocations(blockNumber);
    `)
  }

  async saveCredentialRecord(record: {
    vcHash: string
    issuer: string
    subject: string
    timestamp: number
    blockNumber: number
    transactionHash: string
    indexed: boolean
    indexedAt: number
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO credentials 
      (vcHash, issuer, subject, timestamp, blockNumber, transactionHash, indexed, indexedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      record.vcHash,
      record.issuer,
      record.subject,
      record.timestamp,
      record.blockNumber,
      record.transactionHash,
      record.indexed ? 1 : 0,
      record.indexedAt
    )
  }

  async saveRevocationRecord(record: {
    vcHash: string
    revoker: string
    timestamp: number
    blockNumber: number
    transactionHash: string
    indexed: boolean
    indexedAt: number
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO revocations
      (vcHash, revoker, timestamp, blockNumber, transactionHash, indexed, indexedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      record.vcHash,
      record.revoker,
      record.timestamp,
      record.blockNumber,
      record.transactionHash,
      record.indexed ? 1 : 0,
      record.indexedAt
    )
  }

  async getCredential(vcHash: string): Promise<any | null> {
    const stmt = this.db.prepare(`
      SELECT c.*, r.revoker, r.timestamp as revokedTimestamp, r.blockNumber as revokedBlock
      FROM credentials c
      LEFT JOIN revocations r ON c.vcHash = r.vcHash
      WHERE c.vcHash = ?
    `)
    
    const result = stmt.get(vcHash)
    if (!result) return null

    return {
      ...result,
      indexed: result.indexed === 1,
      revoked: !!result.revoker
    }
  }

  async getRevocation(vcHash: string): Promise<any | null> {
    const stmt = this.db.prepare('SELECT * FROM revocations WHERE vcHash = ?')
    const result = stmt.get(vcHash)
    
    if (!result) return null
    
    return {
      ...result,
      indexed: result.indexed === 1
    }
  }

  async listCredentials(opts?: {
    issuer?: string
    subject?: string
    includeRevoked?: boolean
    limit?: number
    offset?: number
  }): Promise<any[]> {
    let query = `
      SELECT c.*, r.revoker, r.timestamp as revokedTimestamp
      FROM credentials c
      LEFT JOIN revocations r ON c.vcHash = r.vcHash
      WHERE 1=1
    `
    const params: any[] = []

    if (opts?.issuer) {
      query += ' AND c.issuer = ?'
      params.push(opts.issuer)
    }

    if (opts?.subject) {
      query += ' AND c.subject = ?'
      params.push(opts.subject)
    }

    if (!opts?.includeRevoked) {
      query += ' AND r.vcHash IS NULL'
    }

    query += ' ORDER BY c.blockNumber DESC'

    if (opts?.limit) {
      query += ' LIMIT ?'
      params.push(opts.limit)
      
      if (opts?.offset) {
        query += ' OFFSET ?'
        params.push(opts.offset)
      }
    }

    const stmt = this.db.prepare(query)
    const results = stmt.all(...params)

    return results.map((row: any) => ({
      ...row,
      indexed: row.indexed === 1,
      revoked: !!row.revoker
    }))
  }

  async getStats(): Promise<{
    totalCredentials: number
    totalRevocations: number
    uniqueIssuers: number
    uniqueSubjects: number
  }> {
    const credentialsStmt = this.db.prepare('SELECT COUNT(*) as count FROM credentials')
    const revocationsStmt = this.db.prepare('SELECT COUNT(*) as count FROM revocations')
    const issuersStmt = this.db.prepare('SELECT COUNT(DISTINCT issuer) as count FROM credentials')
    const subjectsStmt = this.db.prepare('SELECT COUNT(DISTINCT subject) as count FROM credentials')

    return {
      totalCredentials: credentialsStmt.get().count,
      totalRevocations: revocationsStmt.get().count,
      uniqueIssuers: issuersStmt.get().count,
      uniqueSubjects: subjectsStmt.get().count
    }
  }

  // Additional utility methods
  async getCredentialsBySubject(subject: string, includeRevoked = false): Promise<any[]> {
    return this.listCredentials({ subject, includeRevoked })
  }

  async getCredentialsByIssuer(issuer: string, includeRevoked = false): Promise<any[]> {
    return this.listCredentials({ issuer, includeRevoked })
  }

  async isCredentialRevoked(vcHash: string): Promise<boolean> {
    const revocation = await this.getRevocation(vcHash)
    return !!revocation
  }

  // Get recent activity
  async getRecentActivity(limit = 50): Promise<{
    type: 'issued' | 'revoked'
    vcHash: string
    actor: string // issuer or revoker
    timestamp: number
    blockNumber: number
    transactionHash: string
  }[]> {
    const query = `
      SELECT 'issued' as type, vcHash, issuer as actor, timestamp, blockNumber, transactionHash
      FROM credentials
      UNION ALL
      SELECT 'revoked' as type, vcHash, revoker as actor, timestamp, blockNumber, transactionHash  
      FROM revocations
      ORDER BY blockNumber DESC, timestamp DESC
      LIMIT ?
    `
    
    const stmt = this.db.prepare(query)
    return stmt.all(limit)
  }

  close(): void {
    if (this.db) {
      this.db.close()
    }
  }
}

// Factory function for easy instantiation
export function createSqlCredentialStore(dbPath?: string): SqliteCredentialStore {
  return new SqliteCredentialStore(dbPath)
}
