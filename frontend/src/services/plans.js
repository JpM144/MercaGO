import { API_URL } from './api.js';

async function publicRequest(path) {
  const response = await fetch(`${API_URL}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `La API respondió con error ${response.status}.`);
  }
  return data;
}

async function adminRequest(token, path, { method = 'GET', body, formData } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `La API respondió con error ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function fetchPlanTiers() {
  return publicRequest('/api/plan-tiers');
}

export const getMyStorePlan = (token) => adminRequest(token, '/api/store-admin/plan');

export const listMyPlanChangeRequests = (token) =>
  adminRequest(token, '/api/store-admin/plan-change-requests');

/**
 * Crea la solicitud de cambio de plan enviando el comprobante de la transferencia.
 * El comprobante es obligatorio: imagen (JPG/PNG/WebP) o PDF de hasta 5 MB.
 */
export function createPlanChangeRequest(token, requestedTierId, receiptFile) {
  const formData = new FormData();
  formData.append('tierId', String(requestedTierId));
  formData.append('receipt', receiptFile);

  return adminRequest(token, '/api/store-admin/plan-change-requests', {
    method: 'POST',
    formData,
  });
}

/**
 * El comprobante ya no se sirve por una URL pública: se pide con el token de
 * autenticación y se devuelve como Blob para no exponer un link adivinable.
 */
async function requestReceiptBlob(token, path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error ?? `La API respondió con error ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return response.blob();
}

/** Comprobante de una solicitud propia (store_admin). */
export const fetchMyPlanReceipt = (token, id) =>
  requestReceiptBlob(token, `/api/store-admin/plan-change-requests/${id}/receipt`);

/** Comprobante de cualquier solicitud (super_admin). */
export const fetchAnyPlanReceipt = (token, id) =>
  requestReceiptBlob(token, `/api/super-admin/plan-change-requests/${id}/receipt`);

export function listAllPlanChangeRequests(token, status) {
  const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  return adminRequest(token, `/api/super-admin/plan-change-requests${query}`);
}

export const approvePlanChangeRequest = (token, id) =>
  adminRequest(token, `/api/super-admin/plan-change-requests/${id}/approve`, { method: 'PUT' });

export const rejectPlanChangeRequest = (token, id, rejectedReason) =>
  adminRequest(token, `/api/super-admin/plan-change-requests/${id}/reject`, {
    method: 'PUT',
    body: { rejected_reason: rejectedReason },
  });
