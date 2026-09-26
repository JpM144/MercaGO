import { API_URL } from './api.js';

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `La API respondió con error ${response.status}.`);
  }
  return data;
}

export function fetchPublicStores() {
  return request('/api/stores');
}

export function fetchPublicStore(slug) {
  return request(`/api/stores/${slug}`);
}

export function fetchStoreFeaturedProducts(slug) {
  return request(`/api/stores/${slug}/products?featured=true`);
}

export function fetchStoreCategories(slug) {
  return request(`/api/stores/${slug}/categories`);
}

export function fetchStoreProducts({ slug, category, search, sort, page, limit, onSale } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (sort) params.set('sort', sort);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (onSale) params.set('onSale', onSale);

  const query = params.toString();
  return request(`/api/stores/${slug}/products${query ? `?${query}` : ''}`);
}

export function applyForStore(payload) {
  return request('/api/stores/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
