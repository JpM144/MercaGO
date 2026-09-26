import { API_URL } from './api.js';

async function adminRequest(token, path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `La API respondió con error ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const createProduct = (token, body) =>
  adminRequest(token, '/api/products', { method: 'POST', body });

export const updateProduct = (token, id, body) =>
  adminRequest(token, `/api/products/${id}`, { method: 'PUT', body });

export const deleteProduct = (token, id) =>
  adminRequest(token, `/api/products/${id}`, { method: 'DELETE' });

export const createCategory = (token, body) =>
  adminRequest(token, '/api/categories', { method: 'POST', body });

export const updateCategory = (token, id, body) =>
  adminRequest(token, `/api/categories/${id}`, { method: 'PUT', body });

export const deleteCategory = (token, id) =>
  adminRequest(token, `/api/categories/${id}`, { method: 'DELETE' });

export function listAllOrders(token, status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminRequest(token, `/api/admin/orders${query}`);
}

export const getOrder = (token, id) => adminRequest(token, `/api/orders/${id}`);

export const updateOrderStatus = (token, id, status) =>
  adminRequest(token, `/api/admin/orders/${id}/status`, { method: 'PUT', body: { status } });
