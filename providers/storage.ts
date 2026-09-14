import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaStorageProvider } from './contracts';
export class LocalMediaStorageProvider implements MediaStorageProvider {
  constructor(
    private root = path.resolve(
      process.env.LOCAL_DATA_DIR || '.local',
      'media',
    ),
  ) {}
  private resolve(key: string) {
    if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(key))
      throw new Error('Invalid storage key');
    return path.join(this.root, key);
  }
  async put(data: Uint8Array, filename: string) {
    const ext = path.extname(filename).slice(1).toLowerCase();
    const key = `${randomUUID()}.${/^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin'}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(this.resolve(key), data);
    return key;
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async delete(key: string) {
    await unlink(this.resolve(key));
  }
}
