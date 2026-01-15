// better-sqlite3 is an optional native dependency; it may not have ambient types
// Use require with ts-ignore so the dev server can start even if types/build are missing
// @ts-ignore
const Database: any = require('better-sqlite3')
import path from 'path'
import fs from 'fs'
import { config } from '../config'

type IssuerRecord = {
  address: string
  ensName?: string | null
  addedAtBlock: number
  addedBy: string
  addedTxHash: string
  removedAtBlock?: number | null
  removedBy?: string | null
  removedTxHash?: string | null
}

export class SqlIssuerStore {
  private db: any

  constructor(dbPath?: string) {
    const base = config.trustedRegistry.sql.dbDir || './apps/verifier/tmp'
    const file = dbPath ?? path.join(base, 'trusted-issuers.sqlite')
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
    } catch (err) {
      // best effort - file system edge case silently ignored
    }
    // open the DB file (sync) - better-sqlite3 exports a callable default
    // use as function to avoid "new" signature issues in ambient types
    // keep db as any to avoid strict typing of the native binding
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // @ts-ignore
    this.db = Database(file)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS issuers (
        address TEXT PRIMARY KEY,
        ensName TEXT,
        addedAtBlock INTEGER,
        addedBy TEXT,
        addedTxHash TEXT,
        removedAtBlock INTEGER,
        removedBy TEXT,
        removedTxHash TEXT
      );
    `)
  }

  saveIssuer(rec: IssuerRecord) {
    const stmt = this.db.prepare(`
      INSERT INTO issuers(address, ensName, addedAtBlock, addedBy, addedTxHash, removedAtBlock, removedBy, removedTxHash)
      VALUES (@address, @ensName, @addedAtBlock, @addedBy, @addedTxHash, @removedAtBlock, @removedBy, @removedTxHash)
      ON CONFLICT(address) DO UPDATE SET
        ensName=excluded.ensName,
        addedAtBlock=excluded.addedAtBlock,
        addedBy=excluded.addedBy,
        addedTxHash=excluded.addedTxHash,
        removedAtBlock=excluded.removedAtBlock,
        removedBy=excluded.removedBy,
        removedTxHash=excluded.removedTxHash
    `)
    stmt.run(rec)
  }

  removeIssuer(address: string, removedAtBlock: number, removedBy: string, removedTxHash: string) {
    const stmt = this.db.prepare(`
      INSERT INTO issuers(address, removedAtBlock, removedBy, removedTxHash)
      VALUES (@address, @removedAtBlock, @removedBy, @removedTxHash)
      ON CONFLICT(address) DO UPDATE SET
        removedAtBlock=excluded.removedAtBlock,
        removedBy=excluded.removedBy,
        removedTxHash=excluded.removedTxHash
    `)
    stmt.run({ address, removedAtBlock, removedBy, removedTxHash })
  }

  list(includeRemoved = false): IssuerRecord[] {
    if (includeRemoved) {
      return this.db.prepare('SELECT * FROM issuers ORDER BY address').all() as IssuerRecord[]
    }
    return this.db.prepare('SELECT * FROM issuers WHERE removedAtBlock IS NULL ORDER BY address').all() as IssuerRecord[]
  }

  get(address: string): IssuerRecord | null {
    const row = this.db.prepare('SELECT * FROM issuers WHERE address = ?').get(address)
    return row || null
  }
}
