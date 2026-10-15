// Ambient module declarations for dependencies that ship no types.

declare module 'class-transformer/cjs/storage' {
  import type { MetadataStorage } from 'class-transformer/types/MetadataStorage';

  export const defaultMetadataStorage: MetadataStorage;
}

declare module 'session-file-store' {
  import type session from 'express-session';

  interface FileStoreOptions {
    path?: string;
    ttl?: number;
    [key: string]: unknown;
  }

  type FileStoreConstructor = new (options?: FileStoreOptions) => session.Store;

  function createFileStore(sessionModule: typeof session): FileStoreConstructor;

  export = createFileStore;
}
