import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

export class SqliteAdapter {
    private db: Database.Database

    constructor(dbPath: string) {
        const dir = path.dirname(dbPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        this.db = new Database(dbPath)
    }

    get<T>(sql: string, params: any[] = []): T | undefined {
        return this.db.prepare(sql).get(...params) as T | undefined
    }

    all<T>(sql: string, params: any[] = []): T[] {
        return this.db.prepare(sql).all(...params) as T[]
    }

    run(sql: string, params: any[] = []): Database.RunResult {
        return this.db.prepare(sql).run(...params)
    }

    exec(sql: string): void {
        this.db.exec(sql)
    }

    close(): void {
        this.db.close()
    }
}
