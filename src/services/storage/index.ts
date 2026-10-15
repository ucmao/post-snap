import { IStorageProvider } from '../../types/index.js';
import { LocalStorageProvider } from './local.js';
import { Base64StorageProvider } from './base64.js';

const storageRegistry: Record<string, IStorageProvider> = {
  local: new LocalStorageProvider(),
  base64: new Base64StorageProvider(),
};

export function getStorageProvider(type: 'local' | 'base64' = 'local'): IStorageProvider {
  const provider = storageRegistry[type];
  if (!provider) {
    return storageRegistry.local;
  }
  return provider;
}
