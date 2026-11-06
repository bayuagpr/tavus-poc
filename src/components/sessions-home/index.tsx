import { useSubmitTutorFeedback } from '@/hooks/tutor';
import { tutorSample } from '@/fixtures/tutor';
import { useEffect, useRef, useState } from 'react';
import { SessionFeedback, type SessionOutcome } from '../session-feedback';
import styles from './sessions-home.module.css';

type IconName = 'home' | 'layers' | 'courses' | 'calendar' | 'book' | 'chat' | 'chevron' | 'info';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'home' ? <><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></> : name === 'layers' ? <><path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/></> : name === 'calendar' ? <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></> : name === 'book' ? <><path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2zM6 8l3 1m6 0 3-1M6 12l3 1m6 0 3-1"/></> : name === 'chat' ? <><path d="M3 4h18v14H8l-5 4zM7 8h10M7 12h8"/></> : name === 'chevron' ? <path d="m9 5 7 7-7 7"/> : name === 'info' ? <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M12 11v6M12 7h.01" stroke="white"/></> : <><rect x="3" y="4" width="13" height="13" rx="2"/><rect x="9" y="10" width="12" height="10" rx="2"/></>}</svg>;
}
const course = tutorSample.courseTitle;
const initialHistory = [
 { id: '1', duration: '10 min', status: 'Completed' },
 { id: '2', duration: '-', status: 'Cancelled' },
 { id: '3', duration: '2m 14s', status: 'Interrupted' },
];
function EmptySessions({ completed }: { completed: boolean }) {
 return <div className={styles.emptyState}><div className={styles.emptyIllustration}><svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#ffb583" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="10" y="13" width="42" height="39" rx="5"/><path d="M10 26h42M21 8v12M41 8v12" strokeWidth="4"/>{completed ? <path d="m22 38 7 7 13-15"/> : <><circle cx="48" cy="46" r="14" fill="#ffdabd" stroke="#fff"/><path d="M48 40v12M42 46h12" stroke="#f68a3e"/></>}</svg></div><h2>{completed ? 'No Completed Sessions' : 'No Scheduled Sessions'}</h2><p>{completed ? "Your completed sessions will appear here after you've attended a session." : "You haven't booked an Ask Loka session for this month yet."}</p></div>;
}
export function SessionsHome() {
 const feedbackMutation = useSubmitTutorFeedback();
 const mockFeedback = import.meta.env.DEV && (new URLSearchParams(window.location.search).get('mock') === '1' || import.meta.env.VITE_ENABLE_TUTOR_MOCKS === 'true');
 const feedbackBookingId = new URLSearchParams(window.location.search).get('bookingId');
 const [feedbackToast, setFeedbackToast] = useState(false);
 const [cancelToast, setCancelToast] = useState(false);
 useEffect(() => { if (!cancelToast) return; const timer = setTimeout(() => setCancelToast(false), 5000); return () => clearTimeout(timer); }, [cancelToast]);
 useEffect(() => { if (!feedbackToast) return; const timer = setTimeout(() => setFeedbackToast(false), 5000); return () => clearTimeout(timer); }, [feedbackToast]);
 const [outcome, setOutcome] = useState<SessionOutcome | null>(() => { const value = new URLSearchParams(window.location.search).get('sessionOutcome'); return value === 'early' || value === 'completed' || value === 'interrupted' ? value : null; });
 const rawDuration = Number(new URLSearchParams(window.location.search).get('duration') ?? (outcome === 'completed' ? 600 : 120));
 const duration = Number.isFinite(rawDuration) ? Math.max(0, Math.floor(rawDuration)) : 0;
 const closeFeedback = () => { setOutcome(null); const url = new URL(window.location.href); url.searchParams.delete('sessionOutcome'); url.searchParams.delete('duration'); window.history.replaceState(null, '', url); };
 const [tab, setTab] = useState<'scheduled' | 'completed'>('scheduled');
 const [cancelOpen, setCancelOpen] = useState(false);
 const [detailsOpen, setDetailsOpen] = useState(false);
 const emptyPreview = new URLSearchParams(window.location.search).get('empty');
 const [cancelled, setCancelled] = useState(emptyPreview === 'scheduled' || emptyPreview === 'all');
 const [readyCancelled, setReadyCancelled] = useState(emptyPreview === 'scheduled' || emptyPreview === 'all');
 const [cancelTarget, setCancelTarget] = useState<'scheduled' | 'ready'>('scheduled');
 const [copied, setCopied] = useState(false);
 const [copyError, setCopyError] = useState('');
 const [now, setNow] = useState(Date.now());
 const [previewJoin, setPreviewJoin] = useState(new URLSearchParams(window.location.search).get('sessionPreview') === 'join');
 const start = Date.parse(tutorSample.startsAt);
 const end = start + 10 * 60 * 1000;
 const canJoin = previewJoin || (now >= start && now < end);
 const expired = !previewJoin && now >= end;
 const sessionPath = previewJoin ? '/sessions/sample-ready-booking?mock=1' : '/sessions/sample-booking';
 const sessionLink = `${window.location.origin}${sessionPath}`;
 useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
 const copyLink = async () => { try { await navigator.clipboard.writeText(sessionLink); setCopied(true); setCopyError(''); } catch { setCopyError('Unable to copy. Select and copy the link above.'); } };
 const addCalendar = () => {
  const body = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ask Loka//Session Preview//EN','BEGIN:VEVENT','UID:loka-sample-20270320','DTSTAMP:20261106T000000Z','DTSTART:20270320T050000Z','DTEND:20270320T051000Z',`SUMMARY:${course}`,`URL:${sessionLink}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'ask-loka-session.ics'; link.click(); URL.revokeObjectURL(url);
 };
 const dialogRef = useRef<HTMLElement>(null);
 useEffect(() => {
  if (!cancelOpen && !detailsOpen) return;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  dialogRef.current?.focus({ preventScroll: true });
  const handleKey = (event: KeyboardEvent) => {
   if (event.key === 'Escape') { setCancelOpen(false); setDetailsOpen(false); }
   if (event.key === 'Tab') {
    const items = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
    if (!items?.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
   }
  };
  document.addEventListener('keydown', handleKey);
  return () => { document.removeEventListener('keydown', handleKey); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
 }, [cancelOpen, detailsOpen]);
 const history = cancelled ? [{ id: 'cancelled', duration: '-', status: 'Cancelled' }, ...initialHistory] : initialHistory;
 const visibleHistory = emptyPreview === 'completed' || emptyPreview === 'all' ? [] : history;
 return <div className={styles.page}>
 {feedbackToast && <div className={styles.toast} role="status"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="white"/><path d="m7 12 3 3 7-7" stroke="#438e4b" strokeWidth="2"/></svg><span>Your feedback has been submitted successfully.</span><button title="Dismiss notification" aria-label="Dismiss notification" onClick={() => setFeedbackToast(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>}
 {cancelToast && <div className={styles.toast} role="status"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="white"/><path d="m7 12 3 3 7-7" stroke="#438e4b" strokeWidth="2"/></svg><span>Your booking has been cancelled successfully. You won't be able to book another session this month.</span><button title="Dismiss notification" aria-label="Dismiss notification" onClick={() => setCancelToast(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>}
 {outcome && <SessionFeedback outcome={outcome} duration={duration} onClose={closeFeedback} busy={feedbackMutation.isPending} error={feedbackMutation.error?.message} onSubmit={async input => { if (mockFeedback && feedbackBookingId) { try { await feedbackMutation.mutateAsync({ bookingId: feedbackBookingId, ...input }); } catch { return; } } closeFeedback(); setFeedbackToast(true); }}/>}
  <aside className={styles.sidebar} aria-label="Main navigation">
   <a href="/" className={styles.logo} aria-label="Loka home"><svg width="48" height="54" viewBox="0 0 48 54" aria-hidden="true"><path fill="currentColor" d="M2 14 24 1l22 13v39H2z"/><path fill="#171717" stroke="#888" d="M13 18h22v22H13z"/><path fill="#4e4e4e" d="M14 19h7v7h-7zm14 0h6v7h-6zm-7 7h7v7h-7zm-7 7h7v6h-7zm14 0h6v6h-6z"/></svg></a>
   <nav><a href="/"><Icon name="home"/>Home</a><div className={styles.navSection}>Explore</div><span><Icon name="layers"/>Programs</span><span><Icon name="courses"/>Short Courses</span><span><Icon name="calendar"/>Events</span><div className={styles.navSection}>Learning</div><a href="/" aria-current="page" className={styles.selected}><Icon name="book"/>My Learning</a><span className={styles.channel}><Icon name="chat"/>Channel</span></nav>
  </aside>
  <div className={styles.workspace}>
   <header className={styles.topbar}><nav aria-label="Breadcrumb" className={styles.breadcrumb}><span>My Learning</span><Icon name="chevron" size={16}/><span>Program</span><Icon name="chevron" size={16}/><span>List of Course</span><Icon name="chevron" size={16}/><strong>{course}</strong></nav><div className={styles.profile}><span className={styles.avatar} aria-hidden="true"/>{tutorSample.learnerName}</div></header>
   <main className={styles.content}>
    <div className={styles.heading}><div><h1>Ask Loka Sessions</h1><p>Manage your upcoming session and view your session history</p></div><button disabled title="No session slots are available this month"><span aria-hidden="true">+</span> Book a Session</button></div>
    <div className={styles.notice}><Icon name="info"/><span>All session slots for this month are fully booked. Please check again when next month's slots open.</span></div>
    <div className={styles.tabs} role="tablist" aria-label="Session history"><button id="scheduled-tab" role="tab" aria-selected={tab === 'scheduled'} aria-controls="session-panel" className={tab === 'scheduled' ? styles.activeTab : ''} onClick={() => setTab('scheduled')}>Scheduled ({Number(!cancelled) + Number(!readyCancelled)})</button><button id="completed-tab" role="tab" aria-selected={tab === 'completed'} aria-controls="session-panel" className={tab === 'completed' ? styles.activeTab : ''} onClick={() => setTab('completed')}>Completed ({visibleHistory.length})</button></div>
    <section id="session-panel" role="tabpanel" aria-labelledby={`${tab}-tab`} className={styles.panel}>
    {tab === 'scheduled' ? cancelled ? readyCancelled ? <EmptySessions completed={false}/> : null : <article className={styles.booking}><div className={styles.bookingTop}><div className={styles.course}><span className={styles.roundIcon}><Icon name="book" size={17}/></span><div><h2>{course}</h2><small>Course Name</small></div></div><div className={styles.schedule}><span className={styles.roundIcon}><Icon name="calendar" size={17}/></span><div><h2>{tutorSample.dateLabel}</h2><p>{tutorSample.timeLabel}</p></div></div></div><div className={styles.bookingBottom}><p><Icon name="info" size={12}/>You've used your booking for this month. You can book again when next month's slots open.</p><div className={styles.actions}><button className={styles.cancelButton} onClick={() => { setCancelTarget('scheduled'); setCancelOpen(true); }}>Cancel Booking</button><button onClick={() => { setPreviewJoin(false); setCopied(false); setDetailsOpen(true); }}>View Details</button></div></div></article> : visibleHistory.length === 0 ? <EmptySessions completed/> : <div className={styles.history}>{visibleHistory.map(item => <article className={styles.historyRow} key={item.id}><div className={styles.course}><span className={styles.roundIcon}><Icon name="calendar" size={17}/></span><div><h2>{course}</h2><p>Thu 11:00 AM – 12:00 PM (SGT)</p></div></div><div className={styles.duration}><strong>{item.duration}</strong><small>Duration</small></div><span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{item.status}</span></article>)}</div>}
    {tab === 'scheduled' && !readyCancelled && <article className={`${styles.booking} ${styles.readyBooking}`}><div className={styles.bookingTop}><div className={styles.course}><span className={styles.roundIcon}><Icon name="book" size={17}/></span><div><h2>{course}</h2><small>Course Name</small></div></div><div className={styles.schedule}><span className={styles.roundIcon}><Icon name="calendar" size={17}/></span><div><h2>{tutorSample.dateLabel}</h2><p>{tutorSample.timeLabel}</p></div></div></div><div className={styles.bookingBottom}><p><Icon name="info" size={12}/>You've used your booking for this month. You can book again when next month's slots open.</p><div className={styles.actions}><button className={styles.cancelButton} onClick={() => { setCancelTarget('ready'); setCancelOpen(true); }}>Cancel Booking</button><button onClick={() => { setPreviewJoin(true); setCopied(false); setCopyError(''); setDetailsOpen(true); }}>View Details</button></div></div></article>}
    </section>
   </main>
  </div>
  {(cancelOpen || detailsOpen) && <div className={styles.backdrop} onClick={() => { setCancelOpen(false); setDetailsOpen(false); }}><section ref={dialogRef} tabIndex={-1} className={`${styles.dialog} ${detailsOpen ? styles.detailsDialog : styles.cancelDialog}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}>
   {cancelOpen ? <><header className={styles.cancelHeader}><h2 id="dialog-title">Cancel Your Booking?</h2><button aria-label="Close cancellation confirmation" title="Close" onClick={() => setCancelOpen(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><p>Are you sure you want to cancel your Ask Loka booking? You won't be able to book another session this month.</p><div className={styles.dialogActions}><button onClick={() => setCancelOpen(false)}>Keep Booking</button><button className={styles.confirmCancel} onClick={() => { if (cancelTarget === 'ready') setReadyCancelled(true); else setCancelled(true); setCancelOpen(false); setDetailsOpen(false); setFeedbackToast(false); setCancelToast(true); }}>Yes, Cancel Booking</button></div></> : <>
    <header className={styles.detailsHeader}><h2 id="dialog-title">{course}</h2><button title="Close session details" aria-label="Close session details" onClick={() => setDetailsOpen(false)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg></button></header>
    <div className={styles.detailsBody}><div className={styles.dateCard}><div className={styles.calendarTile}><span>MAR</span><strong>20</strong><small>SAT</small></div><div><h3>{tutorSample.dateLabel}</h3><p><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>1:00 – 1:10 PM (SGT) · 10 min</p><button className={styles.calendarLink} onClick={addCalendar}><Icon name="calendar" size={12}/>Add to calendar</button></div></div>
    <label className={styles.linkLabel} htmlFor="session-link">Session Link</label><div className={styles.linkField}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/></svg><input id="session-link" value={sessionLink} readOnly onFocus={e => e.target.select()}/><button title="Copy session link" onClick={() => void copyLink()}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H3v13h5"/></svg>{copied ? 'Copied' : 'Copy'}</button></div>{copyError && <p role="alert" className={styles.copyError}>{copyError}</p>}
    <button className={styles.joinSession} disabled={!canJoin} onClick={() => { window.location.href = sessionPath; }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{canJoin ? <><rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/></> : <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>}</svg>{canJoin ? 'Get Ready to Join' : expired ? 'This session has ended' : 'Join opens at 1:00 PM on 20 Mar'}</button>
    </div>{!canJoin && <footer className={styles.detailsFooter}><p>Cancel at least 24 hours before your session. You won't be able to book again this month.</p><button className={styles.cancelButton} disabled={now > start - 24 * 60 * 60 * 1000} title={now > start - 24 * 60 * 60 * 1000 ? 'Cancellation cutoff has passed' : 'Cancel booking'} onClick={() => { setCancelTarget(previewJoin ? 'ready' : 'scheduled'); setDetailsOpen(false); setCancelOpen(true); }}>Cancel Booking</button></footer>}
   </>}
  </section></div>}
 </div>;
}
