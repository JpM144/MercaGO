import { API_URL } from './api.js';

async function authRequest(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `La API respondió con error ${response.status}.`);
  }
  return data;
}

export const loginUser = (credentials) => authRequest('/api/auth/login', credentials);

export const registerUser = (payload) => authRequest('/api/auth/register', payload);

export async function fetchMe(token) {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `La API respondió con error ${response.status}.`);
  }
  return data.user;
}
