import type { ReactNode } from 'react';
import type { TutorApiClient } from '@/api/tutor';
import { TutorApiContext } from './tutor-api-context';

export interface TutorApiProviderProps {
  client: TutorApiClient;
  children: ReactNode;
}

/**
 * Supplies one configured tutor API client to the hooks below. Mount it under
 * QueryClientProvider when wiring the session flow; screens are not part of
 * this integration layer.
 */
export function TutorApiProvider({
  client,
  children,
}: TutorApiProviderProps) {
  return (
    <TutorApiContext.Provider value={client}>
      {children}
    </TutorApiContext.Provider>
  );
}
