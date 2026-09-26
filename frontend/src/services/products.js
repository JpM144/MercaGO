import { API_URL } from './api.js';

async function request(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`La API respondió con error ${response.status} al consultar ${path}`);
  }
  return response.json();
}

export function fetchCategories() {
  return request('/api/categories');
}

export function fetchProducts({ category, search, sort, page, limit } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (sort) params.set('sort', sort);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  const query = params.toString();
  return request(`/api/products${query ? `?${query}` : ''}`);
}

export function fetchProductBySlug(slug) {
  return request(`/api/products/${slug}`);
}

export async function postReview({ token, productId, rating, comment }) {
  const response = await fetch(`${API_URL}/api/products/${productId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rating, comment }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `La API respondió con error ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data.review;
}
