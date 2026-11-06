import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createTutorApiClient } from '@/api/tutor';
import { TutorApiProvider } from './tutor-api-provider';
import { createMockSessionMedia, useTutorSession } from './use-tutor-session';
import { createTutorMockStore } from '@/mocks/scenarios';
import { createTutorMockServer } from '@/mocks/node';
const store = createTutorMockStore();
const { server } = createTutorMockServer({ store, baseUrl: 'https://flow.test' });
const api = createTutorApiClient({ baseUrl: 'https://flow.test' });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => store.reset());
afterAll(() => server.close());
function setup(failJoin = false) {
 const cache = new QueryClient(); const media = createMockSessionMedia({ failJoin }); const onEnded = vi.fn();
 const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache}><TutorApiProvider client={api}>{children}</TutorApiProvider></QueryClientProvider>;
 return { ...renderHook(() => useTutorSession({ bookingId: 'sample-ready-booking', media, onEnded }), { wrapper }), onEnded };
}
it('guards double joins and ends before notifying the homepage', async () => {
 const { result, onEnded } = setup();
 await act(async () => { await Promise.all([result.current.join(), result.current.join()]); });
 expect(store.snapshot().startAttempts).toBe(1); expect(result.current.phase).toBe('connected');
 await act(async () => { await result.current.leave(); });
 expect(store.isSessionEnded()).toBe(true); expect(onEnded).toHaveBeenCalledOnce();
});
it('ignores cancelled preparation responses', async () => {
 store.setScenario({ start: 'slow-success', slowDelayMs: 100 });
 const { result } = setup();
 let pending: Promise<void> = Promise.resolve();
 act(() => { pending = result.current.join(); });
 act(() => result.current.cancel());
 await act(async () => { await pending; });
 expect(result.current.phase).toBe('check');
});
it('keeps end failures recoverable until manual retry succeeds', async () => {
 store.setScenario({ end: 'fail-once' });
 const { result, onEnded } = setup();
 await act(async () => { await result.current.join(); });
 await act(async () => { await expect(result.current.leave()).rejects.toMatchObject({ status: 503 }); });
 expect(onEnded).not.toHaveBeenCalled(); expect(result.current.error).not.toBe('');
 await act(async () => { await result.current.leave(); });
 expect(onEnded).toHaveBeenCalledOnce();
});
it('surfaces mock media failures', async () => {
 const { result } = setup(true);
 await act(async () => { await result.current.join(); });
 expect(result.current.phase).toBe('error');
 expect(result.current.error).toBe('Mock media connection failed.');
});
