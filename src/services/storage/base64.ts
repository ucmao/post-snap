import { IStorageProvider } from '../../types/index.js';

export class Base64StorageProvider implements IStorageProvider {
  name = 'base64';

  async save(buffer: Buffer, mimeType: string): Promise<string> {
    const base64Str = buffer.toString('base64');
    const safeMime = mimeType || 'image/jpeg';
    return `data:${safeMime};base64,${base64Str}`;
  }
}
