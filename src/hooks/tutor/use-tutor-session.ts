import { useEffect, useRef, useState } from 'react';
import { useStartTutorSession, useEndTutorSession } from './use-tutor-mutations';
import type { TutorSessionDetails } from '@/api/tutor';
export interface SessionMediaAdapter { join(session: TutorSessionDetails, signal: AbortSignal): Promise<void>; leave(): Promise<void> }
export function createMockSessionMedia(options: { failJoin?: boolean } = {}): SessionMediaAdapter {
 return { async join(_session, signal) { if (signal.aborted) throw new Error('Join cancelled.'); if (options.failJoin) throw new Error('Mock media connection failed.'); }, async leave() {} };
}
export function useTutorSession({ bookingId, media, onEnded }: { bookingId: string; media: SessionMediaAdapter; onEnded: (duration: number) => void }) {
 const start = useStartTutorSession(); const end = useEndTutorSession();
 const [phase, setPhase] = useState<'check'|'preparing'|'joining'|'connected'|'leaving'|'error'>('check');
 const [error, setError] = useState('');
 const locked = useRef(false); const pending = useRef<AbortController | null>(null); const generation = useRef(0); const joinedAt = useRef(0); const alive = useRef(true);
 useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort(); void media.leave(); }; }, [media]);
 const join = async () => {
  if (locked.current || joinedAt.current) return;
  locked.current = true; const id = ++generation.current; const abort = new AbortController(); pending.current = abort;
  setError(''); setPhase('preparing');
  try {
   const session = await start.mutateAsync({ bookingId, signal: abort.signal });
   if (!alive.current || id !== generation.current) return;
   setPhase('joining'); await media.join(session, abort.signal);
   if (!alive.current || id !== generation.current) return;
   joinedAt.current = Date.now(); setPhase('connected');
  } catch (cause) { if (alive.current && id === generation.current) { setError(cause instanceof Error ? cause.message : 'Unable to start session.'); setPhase('error'); } }
  finally { if (id === generation.current) locked.current = false; }
 };
 const leave = async () => {
  if (locked.current) return;
  locked.current = true; setError(''); setPhase('leaving');
  try { await media.leave(); await end.mutateAsync({ bookingId, outcome: 'COMPLETED', description: 'Learner left the session early.' }); if (alive.current) onEnded(Math.max(0, Math.floor((Date.now() - joinedAt.current) / 1000))); }
  catch (cause) { if (alive.current) { setError(cause instanceof Error ? cause.message : 'Unable to end session.'); setPhase('connected'); } throw cause; }
  finally { locked.current = false; }
 };
 const cancel = () => { generation.current++; pending.current?.abort(); locked.current = false; setPhase('check'); setError(''); };
 return { phase, error, join, leave, cancel };
}
