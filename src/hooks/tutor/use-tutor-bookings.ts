import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TutorApiError } from '@/api/tutor';
import type { TutorApiClient, TutorRequestOptions } from '@/api/tutor';
import { useOptionalTutorApiClient } from './tutor-api-context';
import { tutorQueryKeys } from './query-keys';
function requireClient(client: TutorApiClient | null | undefined) {
 if (!client) throw new TutorApiError({ kind: 'validation', code: 'CLIENT_NOT_CONFIGURED', message: 'Configure a Tutor API client.' });
 return client;
}
interface Options { client?: TutorApiClient; enabled?: boolean }
export function useCurrentTutorBooking(month: string, options: Options = {}) {
 const context = useOptionalTutorApiClient();
 return useQuery({ queryKey: tutorQueryKeys.currentBooking(month), queryFn: ({ signal }) => requireClient(options.client ?? context).getCurrentBooking(month, { signal }), enabled: options.enabled ?? true, retry: false });
}
export function useTutorAvailability(month: string, options: Options = {}) {
 const context = useOptionalTutorApiClient();
 return useQuery({ queryKey: tutorQueryKeys.availability(month), queryFn: ({ signal }) => requireClient(options.client ?? context).getAvailability(month, { signal }), enabled: options.enabled ?? true, retry: false });
}
export function useCancelTutorBooking(options: Pick<Options, 'client'> = {}) {
 const context = useOptionalTutorApiClient();
 const cache = useQueryClient();
 return useMutation({ mutationKey: ['tutor', 'cancel-booking'], mutationFn: ({ bookingId, signal }: { bookingId: string } & TutorRequestOptions) => requireClient(options.client ?? context).cancelBooking(bookingId, { signal }), retry: false,
 onSuccess: async booking => {
  cache.setQueryData(tutorQueryKeys.currentBooking(booking.month), booking);
  await cache.invalidateQueries({ queryKey: tutorQueryKeys.availabilityRoot() });
 }, });
}
