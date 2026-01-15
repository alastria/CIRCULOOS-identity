export interface KmsAdapter {
  sign(data: Uint8Array | string): Promise<string>
  verify(data: Uint8Array | string, signature: string): Promise<boolean>
}
