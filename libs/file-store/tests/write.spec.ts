/// <reference types="vitest" />
import { writeAtomic, loadAll } from '../src/index'
import * as fs from 'fs'
import * as path from 'path'

describe('file-store writeAtomic/loadAll', () => {
  console.log('[TEST] file-store write tests')
  const tmpDir = path.join(__dirname, '..', 'tmp-test')
  const filePath = path.join(tmpDir, 'data.json')

  beforeEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
    await fs.promises.mkdir(tmpDir, { recursive: true })
  })

  it('writes and reads atomically', async () => {
  console.log('[TEST] file-store write tests: writes and reads atomically')
    const obj = { a: 1 }
    await writeAtomic(filePath, obj)
    const loaded = await loadAll(filePath)
    expect(loaded).toEqual(obj)
  })
})
