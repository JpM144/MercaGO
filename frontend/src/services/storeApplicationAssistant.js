import { API_URL } from './api.js';

export async function sendStoreApplicationAssistantMessage(messages) {
  const response = await fetch(`${API_URL}/api/store-application-assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `La API respondió con error ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}
