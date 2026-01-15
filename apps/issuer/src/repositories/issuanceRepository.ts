import { IStorageAdapter } from '@circuloos/common'

export class IssuanceRepository {
    constructor(private storage: IStorageAdapter) { }

    async listIssuances(status?: string, limit: number = 100, offset: number = 0, holderAddress?: string): Promise<{ issuances: any[], total: number }> {
        return this.storage.listIssuances({
            status,
            limit,
            offset,
            holderAddress
        })
    }
}
