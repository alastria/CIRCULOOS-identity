File-store
=========

Simple file-backed persistence adapter intended for development and small-scale deployments.

API contract:
- writeAtomic(relPath: string, obj: any): Promise<void> — writes JSON atomically via tmp file and rename.
- loadAll(relPath: string): Promise<any[]> — loads all JSON objects from a folder.

Notes:
- Not intended for production; replace with DB or object-store adapter implementing `packages/common/src/adapters/persistence.ts`.
- Base dir can be configured via FILESTORE_BASE_DIR or passed to the FileStore constructor.

Tests:
- Vitest tests under `tests/` verify atomic writes and read behaviors.
# @circuloos/file-store

File-backed persistence adapter used in development. Exposes a FileStore class with:

- writeAtomic(relPath, obj)
- loadAll(relPath)

Configuration:
- Use `FILESTORE_TMP_DIR` in the repo root `.env.local` to change base dir.

Notes for scaling:
- Implement a DB adapter (Postgres) implementing the same interface.
- Implement an S3 adapter for blobs if needed.
