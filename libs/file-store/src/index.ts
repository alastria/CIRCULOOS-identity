import * as fs from 'fs'
import * as path from 'path'

export class FileStore {
  baseDir: string
  constructor(opts?: string | { baseDir?: string }) {
    if (typeof opts === 'string') this.baseDir = opts
    else this.baseDir = (opts && opts.baseDir) || process.env.FILESTORE_TMP_DIR || './data/tmp'
  }

  async writeAtomic(relPath: string, obj: any): Promise<void> {
    const filePath = path.join(this.baseDir, relPath)
    console.log(`[FileStore] Writing to ${filePath}`)
    const dir = path.dirname(filePath)
    await fs.promises.mkdir(dir, { recursive: true })
    const tmp = `${filePath}.${Date.now()}.tmp`
    await fs.promises.writeFile(tmp, JSON.stringify(obj, null, 2), { encoding: 'utf8' })
    await fs.promises.rename(tmp, filePath)
    console.log(`[FileStore] Wrote to ${filePath}`)
  }

  async loadAll(relPath: string): Promise<any> {
    const filePath = path.join(this.baseDir, relPath)
    console.log(`[FileStore] Loading from ${filePath}`)
    try {
      const data = await fs.promises.readFile(filePath, { encoding: 'utf8' })
      return JSON.parse(data)
    } catch (err: any) {
      console.log(`[FileStore] Error loading ${filePath}: ${err.code}`)
      if (err.code === 'ENOENT') return {}
      throw err
    }
  }
}

// legacy exports
export async function writeAtomic(filePath: string, obj: any): Promise<void> {
  const store = new FileStore()
  return store.writeAtomic(filePath, obj)
}

export async function loadAll(filePath: string): Promise<any> {
  const store = new FileStore()
  return store.loadAll(filePath)
}
