import { IStorageProvider } from '../../types/index.js';
import { ALLOWED_IMAGE_TYPES } from '../../utils/image-type.js';

export class Base64StorageProvider implements IStorageProvider {
  name = 'base64';

  async save(buffer: Buffer, mimeType: string): Promise<string> {
    if (!ALLOWED_IMAGE_TYPES[mimeType]) {
      throw new Error(`Refusing to embed unsupported file type: ${mimeType}`);
    }
    const base64Str = buffer.toString('base64');
    const safeMime = mimeType;
    return `data:${safeMime};base64,${base64Str}`;
  }
}
