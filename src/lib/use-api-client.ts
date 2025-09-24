import { useState, useEffect } from 'react';

interface ApiClient {
  apiKey: string | null;
  isValid: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  useDefaultKey: () => void;
  getHeaders: () => Record<string, string>;
}

export function useApiClient(): ApiClient {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // Load API key from localStorage on mount
    const savedKey = localStorage.getItem("fal_api_key");
    if (savedKey) {
      setApiKeyState(savedKey);
      setIsValid(true);
    } else {
      // Use default key if no custom key is set
      setApiKeyState("default");
      setIsValid(true);
    }
  }, []);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem("fal_api_key", key);
    setIsValid(true);
  };

  const clearApiKey = () => {
    setApiKeyState("default"); // Fall back to default
    localStorage.removeItem("fal_api_key");
    setIsValid(true); // Default key is always valid
  };

  const useDefaultKey = () => {
    setApiKeyState("default");
    localStorage.setItem("fal_api_key", "default");
    setIsValid(true);
  };

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey && apiKey !== 'default') {
      headers['x-fal-api-key'] = apiKey;
    }

    return headers;
  };

  return {
    apiKey,
    isValid,
    setApiKey,
    clearApiKey,
    useDefaultKey,
    getHeaders
  };
}