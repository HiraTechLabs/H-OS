/** A translation catalog: either a leaf string or a nested group of the same shape. */
export type Catalog = {
  readonly [key: string]: string | Catalog;
};

export type Locale = 'en' | 'ar';

export function isCatalog(value: string | Catalog): value is Catalog {
  return typeof value !== 'string';
}
