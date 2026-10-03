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

export const setProductActive = (token, id, isActive) =>
  adminRequest(token, `/api/products/${id}`, { method: 'PUT', body: { isActive } });

export function listStoreAdminProducts(token, search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return adminRequest(token, `/api/store-admin/products${query}`);
}

// Las categorías son privadas de cada tienda: se gestionan en /api/store-admin/categories.
export function fetchStoreCategories(token) {
  return adminRequest(token, '/api/store-admin/categories');
}

export const createCategory = (token, body) =>
  adminRequest(token, '/api/store-admin/categories', { method: 'POST', body });

export const updateCategory = (token, id, body) =>
  adminRequest(token, `/api/store-admin/categories/${id}`, { method: 'PUT', body });

export const deleteCategory = (token, id) =>
  adminRequest(token, `/api/store-admin/categories/${id}`, { method: 'DELETE' });

export function getStoreReport(token, period, date) {
  const params = new URLSearchParams({ period, date });
  return adminRequest(token, `/api/store-admin/reports?${params.toString()}`);
}

export function getStoreReportTimeseries(token, from, to) {
  const params = new URLSearchParams({ from, to });
  return adminRequest(token, `/api/store-admin/reports/timeseries?${params.toString()}`);
}

export function getStoreTopProducts(token, months) {
  const params = new URLSearchParams({ months: String(months) });
  return adminRequest(token, `/api/store-admin/reports/top-products?${params.toString()}`);
}

export function listStoreApplications(token, status) {
  const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  return adminRequest(token, `/api/admin/store-applications${query}`);
}

export const approveStoreApplication = (token, id) =>
  adminRequest(token, `/api/admin/store-applications/${id}/approve`, { method: 'PUT' });

export const rejectStoreApplication = (token, id, rejectedReason) =>
  adminRequest(token, `/api/admin/store-applications/${id}/reject`, {
    method: 'PUT',
    body: { rejected_reason: rejectedReason },
  });

export const sendSalesAssistantMessage = (token, messages) =>
  adminRequest(token, '/api/store-admin/sales-assistant/chat', {
    method: 'POST',
    body: { messages },
  });

export const getStoreAdminPlan = (token) => adminRequest(token, '/api/store-admin/plan');

export const listPlanStores = (token) => adminRequest(token, '/api/super-admin/stores');

export const changeStorePlanStatus = (token, id, action) =>
  adminRequest(token, `/api/super-admin/stores/${id}/${action}`, { method: 'PUT' });

export function listAuditLogs(token, { action, from, to } = {}) {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return adminRequest(token, `/api/super-admin/audit-log${query ? `?${query}` : ''}`);
}
