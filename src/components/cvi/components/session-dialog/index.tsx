import { useEffect, useRef } from 'react';
import styles from './session-dialog.module.css';
export type SessionDialogKind = 'leave' | 'connection' | 'microphone';
export function SessionDialog({ kind, busy, error, onClose, onConfirm }: { kind: SessionDialogKind; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => { const el = ref.current; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); el?.showModal(); el?.focus({ preventScroll: true }); return () => { el?.close(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }; }, []);
 const leave = kind === 'leave';
 return <dialog ref={ref} tabIndex={-1} className={styles.dialog} aria-labelledby="session-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
 <header><h2 id="session-dialog-title">{leave ? 'Leave this session?' : kind === 'connection' ? 'Connection Lost' : 'Microphone Access Required'}</h2>{!leave && <button title="Close dialog" aria-label="Close dialog" disabled={busy} onClick={onClose}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg></button>}</header>
 <p>{leave ? 'Leaving will disconnect you from Loka and stop sharing your camera and microphone.' : kind === 'connection' ? "We couldn't connect to your Ask Loka session. Please check your internet connection and try again." : 'Please allow microphone access in your browser settings, then try again.'}</p>
 {leave ? <div className={styles.consequences}><h3>When you leave</h3><div><Symbol kind="mic"/>Your microphone will be turned off</div><div><Symbol kind="camera"/>Your camera will stop sharing</div><div><Symbol kind="clock"/>You will leave this session</div></div> : <div className={styles.errorCode}>{kind === 'connection' ? 'Connection error' : 'Permission error'}</div>}
 {error && <p className={styles.error} role="alert">{error}</p>}
 <footer>{leave && <button disabled={busy} onClick={onClose}>Stay in Session</button>}<button className={leave ? styles.danger : styles.primary} disabled={busy} onClick={onConfirm}>{busy ? (leave ? 'Leaving…' : 'Retrying…') : leave ? 'Leave Session' : 'Retry Connection'}</button></footer>
 </dialog>;
}
function Symbol({ kind }: { kind: 'mic' | 'camera' | 'clock' }) { return <span className={styles.symbol}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">{kind === 'clock' ? <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></> : kind === 'mic' ? <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0M12 19v3M3 3l18 18"/></> : <><rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3M3 3l18 18"/></>}</svg></span>; }
