import { useEffect, useRef, useState } from 'react';
import styles from './session-feedback.module.css';
export type SessionOutcome = 'early' | 'completed' | 'interrupted';
export function SessionFeedback({ outcome, duration, onClose, onSubmit, busy = false, error }: { outcome: SessionOutcome; duration: number; onClose: () => void; onSubmit: (input: { rating: number; feedback: string }) => void; busy?: boolean; error?: string }) {
 const ref = useRef<HTMLDialogElement>(null);
 const [rating, setRating] = useState(0);
 const [feedback, setFeedback] = useState('');

 useEffect(() => { const el = ref.current; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); el?.showModal(); el?.focus({ preventScroll: true }); return () => { el?.close(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }; }, []);
 const interrupted = outcome === 'interrupted';
 const durationText = duration < 60 ? `${duration} seconds` : `${Math.floor(duration / 60)} min${duration % 60 ? ` ${duration % 60}s` : ''}`;
 return <dialog ref={ref} tabIndex={-1} className={styles.dialog} aria-labelledby="feedback-title" onCancel={event => { event.preventDefault(); onClose(); }}>
 <header><h2 id="feedback-title">{interrupted ? 'Your Session Was Interrupted' : 'Your Ask Loka Sessions Has Ended'}</h2><button title="Close feedback" aria-label="Close feedback" onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg></button></header>
 <><div className={styles.summary}><span className={interrupted ? styles.errorIcon : styles.successIcon}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/>{interrupted ? <path d="M12 7v6m0 3h.01"/> : <path d="m7 12 3 3 7-7"/>}</svg></span><p>{interrupted ? 'Your Ask Loka session ended unexpectedly. Please contact support if you need assistance.' : outcome === 'early' ? 'Your Ask Loka session has ended earlier than scheduled.' : 'Your 10-minute Ask Loka session has ended.'}</p></div>
 <dl className={styles.details}><div><dt>{interrupted ? 'Incident Reference' : 'Session duration'}</dt><dd>{interrupted ? 'Not available in preview' : durationText}</dd></div><div><dt>Status</dt><dd className={styles[outcome]}>{interrupted ? 'Interrupted' : outcome === 'early' ? 'Ended Early' : 'Completed'}</dd></div></dl>
 <form onSubmit={event => { event.preventDefault(); if (rating && !busy) onSubmit({ rating, feedback }); }}><fieldset><legend>Rating <span>*</span></legend><p className={styles.hint}>How would you rate your overall experience with Ask Loka?</p><div className={styles.ratings}>{['Very poor','Poor','Average','Good','Excellent'].map((label,i) => <label key={label}><input type="radio" name="rating" value={i+1} checked={rating === i+1} onChange={() => setRating(i+1)} required aria-label={`${i+1} — ${label}`}/><svg width="26" height="26" viewBox="0 0 24 24" fill={rating >= i+1 ? '#f5822d' : 'none'} stroke={rating >= i+1 ? '#e37827' : '#999'} strokeWidth="1.2" aria-hidden="true"><path d="m12 2 3 6.3 7 .9-5.1 4.9 1.3 7L12 17.8 5.8 21l1.3-6.9L2 9.2l7-.9z"/></svg><span>{i+1}</span><small>{label}</small></label>)}</div></fieldset>
 <label className={styles.feedbackLabel} htmlFor="session-feedback">Feedback <span>(optional)</span></label><textarea id="session-feedback" maxLength={2000} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Share anything that helped or could be improved..."/><p role="alert">{error}</p><footer><button type="submit" disabled={!rating || busy}>{busy ? 'Submitting…' : 'Submit Feedback'}</button></footer></form></>
 </dialog>;
}

