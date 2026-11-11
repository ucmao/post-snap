import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ALLOWED_IMAGE_TYPES } from '../../utils/image-type.js';
import { IStorageProvider } from '../../types/index.js';
import { config } from '../../config.js';

export class LocalStorageProvider implements IStorageProvider {
  name = 'local';

  async save(buffer: Buffer, mimeType: string, filenameHint?: string): Promise<string> {
    // Generate deterministic hash filename based on content
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const ext = ALLOWED_IMAGE_TYPES[mimeType];
    if (!ext) {
      throw new Error(`Refusing to store unsupported file type: ${mimeType}`);
    }
    const filename = `${hash}.${ext}`;

    const targetDir = config.uploadsDir;
    await fs.mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, filename);
    await fs.writeFile(filePath, buffer);

    // Return the public URL served by the API
    const publicUrl = `${config.baseUrl.replace(/\/$/, '')}/uploads/${filename}`;
    return publicUrl;
  }
}
