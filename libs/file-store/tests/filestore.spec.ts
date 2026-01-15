/// <reference types="vitest" />
import { FileStore } from '../src/index'
import * as fs from 'fs'
import * as path from 'path'

describe('FileStore class', () => {
  console.log('[TEST] file-store filestore tests')
  const tmpDir = path.join(__dirname, '..', 'tmp-test2')
  const relPath = 'data.json'
  const store = new FileStore(tmpDir)

  beforeEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
    await fs.promises.mkdir(tmpDir, { recursive: true })
  })

  it('writes and reads via class', async () => {
  console.log('[TEST] file-store filestore tests: writes and reads via class')
    const obj = { b: 2 }
    await store.writeAtomic(relPath, obj)
    const loaded = await store.loadAll(relPath)
    expect(loaded).toEqual(obj)
  })

  it('returns empty object when missing', async () => {
    const loaded = await store.loadAll('no-such.json')
    expect(loaded).toEqual({})
  })
})
