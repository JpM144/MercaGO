import OpenAI from 'openai';

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? 'meta/llama-3.3-70b-instruct';
export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY ?? '';

export function createNvidiaClient() {
  if (!NVIDIA_API_KEY) {
    throw new Error(
      'NVIDIA_API_KEY no configurada: agregala en .env para usar el asistente de ventas.',
    );
  }
  return new OpenAI({
    apiKey: NVIDIA_API_KEY,
    baseURL: NVIDIA_BASE_URL,
  });
}

let clientFactory = createNvidiaClient;

export function setClientFactoryForTests(factory) {
  clientFactory = factory || createNvidiaClient;
}

export function getAgentClient() {
  return clientFactory();
}