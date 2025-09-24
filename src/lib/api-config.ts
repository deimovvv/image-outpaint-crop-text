import { fal } from '@fal-ai/client';

// Default API key fallback
const DEFAULT_API_KEY = process.env.FAL_KEY || "28800317-d96a-4c08-be0f-5448ab164142:726c080f1437a1d2d6fc826065f77999";

export function configureFalClient(userApiKey?: string | null): typeof fal {
  const apiKey = userApiKey === 'default' || !userApiKey ? DEFAULT_API_KEY : userApiKey;

  console.log('🔧 Configuring FAL client with:', {
    keyType: userApiKey === 'default' ? 'default' : userApiKey ? 'custom' : 'default',
    keyPreview: apiKey ? apiKey.substring(0, 20) + '...' : 'none'
  });

  return fal.config({
    credentials: apiKey
  });
}

export function getApiKeyFromHeaders(request: Request): string | null {
  const userApiKey = request.headers.get('x-fal-api-key');
  return userApiKey;
}

export function getDefaultApiKey(): string {
  return DEFAULT_API_KEY;
}