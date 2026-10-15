import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import mime from 'mime-types';
import { IStorageProvider } from '../../types/index.js';
import { config } from '../../config.js';

export class LocalStorageProvider implements IStorageProvider {
  name = 'local';

  async save(buffer: Buffer, mimeType: string, filenameHint?: string): Promise<string> {
    // Generate deterministic hash filename based on content
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const ext = mime.extension(mimeType) || 'jpg';
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
