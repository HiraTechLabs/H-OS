import { z } from 'zod';

/**
 * Typed cross-app entity reference (BIZ-011, ARCH-014). Never a URL, never a cross-schema join.
 */
export const EntityRefSchema = z.strictObject({
  app: z.string().min(1).max(32),
  type: z.string().min(1).max(64),
  id: z.string().min(1).max(128),
});
export type EntityRef = z.infer<typeof EntityRefSchema>;

export const AppCode = {
  HR: 'hr',
  ASSET: 'asset',
  ARCHIVE: 'archive',
  FINANCE: 'finance',
} as const;

export type AppCode = (typeof AppCode)[keyof typeof AppCode];

/** Reference to a document owned by H-Archive. H-HR stores the ID and its own metadata only. */
export interface ArchiveDocumentRef extends EntityRef {
  readonly app: typeof AppCode.ARCHIVE;
  readonly type: 'document';
}

export function archiveDocumentRef(id: string): ArchiveDocumentRef {
  return { app: AppCode.ARCHIVE, type: 'document', id };
}

/** Reference to an asset owned by H-Asset. */
export interface AssetRef extends EntityRef {
  readonly app: typeof AppCode.ASSET;
  readonly type: 'asset';
}

export function assetRef(id: string): AssetRef {
  return { app: AppCode.ASSET, type: 'asset', id };
}
