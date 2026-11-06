import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTutorApiClient } from './tutor';
import { createTutorMockStore } from '@/mocks/scenarios';
import { createTutorMockServer } from '@/mocks/node';
import { tutorSample } from '@/fixtures/tutor';
import { useCancelTutorBooking, useCurrentTutorBooking, tutorQueryKeys } from '@/hooks/tutor';
const baseUrl = 'https://booking.test';
const store = createTutorMockStore({ clock: '2027-03-18T05:00:00Z' });
const { server } = createTutorMockServer({ store, baseUrl });
const api = createTutorApiClient({ baseUrl });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => store.reset());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
describe('booking integration boundary', () => {
 it('reads the shared booking and availability fixture', async () => {
  const booking = await api.getCurrentBooking('2027-03');
  expect(booking?.startsAt).toBe(tutorSample.startsAt);
  expect(await api.getAvailability('2027-03')).toEqual([expect.objectContaining({ slotId: booking?.slotId, eligible: false })]);
 });
 it('maps missing booking to null but preserves server failures', async () => {
  store.setScenario({ booking: 'empty' }); expect(await api.getCurrentBooking('2027-03')).toBeNull();
  store.setScenario({ booking: 'unavailable' }); await expect(api.getCurrentBooking('2027-03')).rejects.toMatchObject({ status: 500 });
 });
 it('rejects invalid month and supports empty availability', async () => {
  await expect(api.getAvailability('2027-13')).rejects.toMatchObject({ kind: 'validation' });
  store.setScenario({ availability: 'empty' }); expect(await api.getAvailability('2027-03')).toEqual([]);
 });
 it('normalizes the documented singleton availability shape and rejects malformed rows', async () => {
  server.use(http.get(`${baseUrl}/sse/v1/tutor/availability`, () => HttpResponse.json({ slotId: tutorSample.startsAt, startsAt: tutorSample.startsAt, endsAt: tutorSample.endsAt, eligible: true, status: 'AVAILABLE' })));
  expect(await api.getAvailability('2027-03')).toHaveLength(1);
  server.use(http.get(`${baseUrl}/sse/v1/tutor/availability`, () => HttpResponse.json({ bad: true })));
  await expect(api.getAvailability('2027-03')).rejects.toMatchObject({ kind: 'invalid-response' });
 });
 it('cancels idempotently and keeps monthly entitlement consumed', async () => {
  expect((await api.cancelBooking(tutorSample.bookingId)).status).toBe('CANCELLED');
  expect((await api.cancelBooking(tutorSample.bookingId)).status).toBe('CANCELLED');
  expect((await api.getCurrentBooking('2027-03'))?.status).toBe('CANCELLED');
  expect((await api.getAvailability('2027-03'))[0]).toMatchObject({ eligible: false, status: 'AVAILABLE' });
 });
 it('supports cancellation cutoff, not found, and persistence failure scenarios', async () => {
  for (const [cancel, status] of [['cutoff',400],['not-found',404],['unavailable',500]] as const) {
   store.setScenario({ cancel }); await expect(api.cancelBooking(tutorSample.bookingId)).rejects.toMatchObject({ status });
  }
 });
 it('aborts reads', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(api.getCurrentBooking('2027-03', { signal: controller.signal })).rejects.toMatchObject({ kind: 'aborted' });
 });
 it('updates the current booking cache and invalidates availability after cancellation', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  cache.setQueryData(tutorQueryKeys.availability('2027-03'), []);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => ({ current: useCurrentTutorBooking('2027-03', { client: api }), cancel: useCancelTutorBooking({ client: api }) }), { wrapper });
  await waitFor(() => expect(result.current.current.isSuccess).toBe(true));
  await act(async () => { await result.current.cancel.mutateAsync({ bookingId: tutorSample.bookingId }); });
  await waitFor(() => expect(result.current.current.data?.status).toBe('CANCELLED'));
  expect(cache.getQueryState(tutorQueryKeys.availability('2027-03'))?.isInvalidated).toBe(true);
  unmount(); cache.clear();
 });
});
