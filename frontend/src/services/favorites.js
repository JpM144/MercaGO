import { API_URL } from './api.js';

async function authedRequest(path, { token, method, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `La API respondió con error ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function listFavorites(token) {
  return authedRequest('/api/favorites', { token });
}

export async function addFavorite(token, productId) {
  const data = await authedRequest(`/api/favorites/${productId}`, { token, method: 'POST' });
  return data.favorite;
}

export async function removeFavorite(token, productId) {
  await authedRequest(`/api/favorites/${productId}`, { token, method: 'DELETE' });
  return { productId };
}
