import { useMemo } from 'react';
import { useTutorSession, createMockSessionMedia } from '@/hooks/tutor/use-tutor-session';
import { navigateSession } from '@/session-navigation';
import { tutorSample } from '@/fixtures/tutor';
import { useEffect, useState } from 'react';
import { HairCheck } from '../cvi/components/hair-check';
import { Conversation } from '../cvi/components/conversation';
import styles from './session-page.module.css';

function ScheduleIcon({ expired = false, small = false }: { expired?: boolean; small?: boolean }) {
 return <svg width={small ? 24 : 56} height={small ? 24 : 56} viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{expired ? <><circle cx="28" cy="28" r="23"/><path d="m20 20 16 16m0-16L20 36"/></> : <><path d="M30 44H8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3h30a3 3 0 0 1 3 3v12M5 18h36M14 3v10M32 3v10"/><path d="M13 26h1m9 0h1m-11 9h1"/><circle cx="40" cy="38" r="12"/><path d="M40 31v8l5 3"/></>}</svg>;
}
export function SessionPage({ bookingId }: { bookingId: string }) {
 const mock = import.meta.env.DEV && (new URLSearchParams(window.location.search).get('mock') === '1' || import.meta.env.VITE_ENABLE_TUTOR_MOCKS === 'true');
 const media = useMemo(() => createMockSessionMedia(), []);
 const flow = useTutorSession({ bookingId, media, onEnded: duration => navigateSession(`/?mock=1&sessionOutcome=early&bookingId=${encodeURIComponent(bookingId)}&duration=${duration}`) });
 const preview = new URLSearchParams(window.location.search).get('state') || (bookingId === 'sample-ready-booking' ? 'ready' : null);
 const [now, setNow] = useState(Date.now());
 const [stage, setStage] = useState<'check' | 'call' | 'ended'>('check');
 const startsAt = Date.parse(tutorSample.startsAt);
 const endsAt = Date.parse(tutorSample.endsAt);
 const available = preview === 'ready' || (preview !== 'scheduled' && preview !== 'expired' && preview !== 'completed' && now >= startsAt && now < endsAt);
 const expired = stage === 'ended' || preview === 'expired' || preview === 'completed' || (preview !== 'ready' && preview !== 'scheduled' && now >= endsAt);
 useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
 if (!['sample-booking', 'sample-ready-booking'].includes(bookingId)) return <section className={styles.page}><div className={styles.message}><h1>Session not found</h1><p>Check your session link or return to your sessions.</p><a href="/">Back to sessions</a></div></section>;
 if (available && !expired) {
  if (mock && (flow.phase === 'connected' || flow.phase === 'leaving')) return <Conversation demo conversationUrl="" onLeave={() => {}} onEndSession={flow.leave}/>;
  if (mock && (flow.phase === 'preparing' || flow.phase === 'joining' || flow.phase === 'error')) return <section className={styles.page}><div className={styles.message}><h1>{flow.phase === 'error' ? 'Unable to start session' : flow.phase === 'joining' ? 'Joining session…' : 'Preparing session…'}</h1>{flow.error && <p role="alert">{flow.error}</p>}{flow.phase === 'error' && <button onClick={() => void flow.join()}>Try again</button>}<button onClick={() => { flow.cancel(); navigateSession('/?mock=1'); }}>Cancel</button></div></section>;
  if (stage === 'call') return <Conversation demo conversationUrl="" onLeave={() => setStage('ended')}/>;
  return <HairCheck onJoin={() => { if (mock) void flow.join(); else setStage('call'); }} onCancel={() => { window.location.href = '/'; }}/>;
 }
 return <section className={styles.page} aria-labelledby="session-state-title"><div className={styles.message}>
  <div className={`${styles.illustration} ${expired ? styles.expired : ''}`}><ScheduleIcon expired={expired}/><span className={styles.sparkOne}>✦</span><span className={styles.sparkTwo}>✦</span><span className={styles.sparkThree}>✦</span><i/><b/></div>
  <h1 id="session-state-title">{expired ? 'This session is no longer available' : "Your session hasn't started yet"}</h1>
  <p className={styles.description}>{expired ? 'The scheduled time for this session has ended. You can book another session when available.' : 'This session is scheduled for:'}</p>
  <div className={styles.schedule}><span className={styles.scheduleIcon}><ScheduleIcon small/></span><div><h2>{tutorSample.dateLabel}</h2><p><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 5v7l4 3" stroke="white" fill="none" strokeWidth="2"/></svg>1:00 – 1:10 PM (SGT) · 10 min</p></div></div>
  {!expired && <p className={styles.returnNote}>Please return at your scheduled time to start the session.</p>}
 </div></section>;
}
