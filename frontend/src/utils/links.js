export function productHref(product, fallbackStoreSlug = null) {
  const storeSlug = product?.store?.slug ?? fallbackStoreSlug;
  return storeSlug ? `/tienda/${storeSlug}/producto/${product.slug}` : `/products/${product.slug}`;
}
