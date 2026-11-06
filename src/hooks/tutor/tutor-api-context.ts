import { createContext, useContext } from 'react';
import type { TutorApiClient } from '@/api/tutor';

/**
 * Null means no provider is mounted. Hooks accept an explicit `client` option
 * as an alternative to the provider, which keeps tests and isolated consumers
 * free of a required global wrapper.
 */
export const TutorApiContext = createContext<TutorApiClient | null>(null);

export function useOptionalTutorApiClient(): TutorApiClient | null {
  return useContext(TutorApiContext);
}

export function useTutorApiClient(): TutorApiClient {
  const client = useOptionalTutorApiClient();
  if (!client) {
    throw new Error(
      'No Tutor API client is available. Wrap the tree in <TutorApiProvider> or pass a client to the hook.'
    );
  }
  return client;
}
