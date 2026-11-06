import { useCallback } from 'react';
import { useDaily } from '@daily-co/daily-react';

export const useCVICall = () => {
  const daily = useDaily();
  const joinCall = useCallback(async ({ url }: { url: string }) => {
    if (!daily) throw new Error('Video client is not ready. Please try again.');
    const state = daily.meetingState();
    if (state === 'joining-meeting' || state === 'joined-meeting') return;
    await daily.join({ url });
  }, [daily]);
  const leaveCall = useCallback(async () => {
    await daily?.leave();
  }, [daily]);
  return { joinCall, leaveCall };
};
