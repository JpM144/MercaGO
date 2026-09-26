import { API_URL } from './api.js';

export async function createOrder(token, items) {
  const response = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `La API respondió con error ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data.order;
}
