export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function getHealth() {
  const response = await fetch(`${API_URL}/api/health`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${response.statusText}`);
  }
  return response.json();
}

export default { API_URL, getHealth };
