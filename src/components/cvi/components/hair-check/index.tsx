import { useEffect, useState } from 'react';
import { DailyVideo, useDaily, useDevices } from '@daily-co/daily-react';
import { useStartHaircheck } from '../../hooks/use-start-haircheck';
import { useLocalCamera } from '../../hooks/use-local-camera';
import { useLocalMicrophone } from '../../hooks/use-local-microphone';
import styles from './hair-check.module.css';
function DeviceIcon({ kind, off = false }: { kind: 'camera' | 'mic' | 'speaker' | 'play'; off?: boolean }) {
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
 {kind === 'camera' && <><rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/></>}
 {kind === 'mic' && <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6"/></>}
 {kind === 'speaker' && <><path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></>}
 {kind === 'play' && <path d="m9 5 10 7-10 7z"/>}
 {off && <path d="m3 3 18 18" strokeWidth="2"/>}
 </svg>;
}
export function HairCheck({ isJoinBtnLoading = false, onJoin, onCancel }: { isJoinBtnLoading?: boolean; onJoin: () => void; onCancel?: () => void }) {
 const daily = useDaily(); const cam = useLocalCamera(); const mic = useLocalMicrophone(); const d = useDevices(); const p = useStartHaircheck(); const [error, setError] = useState('');
 useEffect(() => { p.requestPermissions(); }, [p.requestPermissions]);
 const change = (action: Promise<unknown>) => { void action.catch(() => setError('Could not change device. Please try again.')); };
 const test = async () => { const ctx = new AudioContext(); try { const routable = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> }; const id = d.currentSpeaker?.device.deviceId; if(id && routable.setSinkId) await routable.setSinkId(id); await ctx.resume(); const o = ctx.createOscillator(); const g = ctx.createGain(); g.gain.setValueAtTime(.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .6); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .65); o.onended = () => { void ctx.close(); }; } catch { setError('Unable to play test sound.'); await ctx.close(); } };
 return <section className={styles.page} aria-label="Camera and microphone check"><div className={styles.card}>
 <header className={styles.header}><h1>Are you ready to join?</h1><button title="Join conversation" className={styles.join} disabled={!p.isPermissionsGranted || isJoinBtnLoading} onClick={onJoin}>{isJoinBtnLoading ? 'Joining...' : 'Join'}</button></header>
 <div className={styles.preview}>{p.isPermissionsGranted && !cam.isCamMuted ? <DailyVideo sessionId={cam.localSessionId} type="video" mirror className={styles.video}/> : <p>{p.isPermissionsDenied ? 'Allow camera and microphone access' : cam.isCamMuted ? 'Camera is off' : 'Getting your camera ready...'}</p>}<span className={styles.badge}><DeviceIcon kind="camera"/>Preview</span></div>
 <div className={styles.toolbar}><button title={cam.isCamMuted ? "Turn camera on" : "Turn camera off"} disabled={!cam.isCamReady} onClick={cam.onToggleCamera} aria-pressed={!cam.isCamMuted}><DeviceIcon kind="camera" off={cam.isCamMuted}/>{cam.isCamMuted ? 'Turn on' : 'Turn off'}</button><button title={mic.isMicMuted ? "Unmute microphone" : "Mute microphone"} disabled={!mic.isMicReady} onClick={mic.onToggleMicrophone} aria-pressed={!mic.isMicMuted}><DeviceIcon kind="mic" off={mic.isMicMuted}/>{mic.isMicMuted ? 'Unmute' : 'Mute'}</button><button title="Cancel device check" className={styles.cancel} onClick={() => { if(daily) change(daily.leave().then(() => onCancel?.())); else onCancel?.(); }}>Cancel</button></div>
 <div className={styles.settings}>
 <label><span className={styles.deviceLabel}><DeviceIcon kind="camera"/>Camera</span><select disabled={!cam.isCamReady} value={d.currentCam?.device.deviceId || ''} onChange={e => change(d.setCamera(e.target.value))}>{!d.cameras.length && <option value="">No camera available</option>}{d.cameras.map(({device}, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${i+1}`}</option>)}</select></label>
 <label><span className={styles.deviceLabel}><DeviceIcon kind="mic"/>Microphone</span><select disabled={!mic.isMicReady} value={d.currentMic?.device.deviceId || ''} onChange={e => change(d.setMicrophone(e.target.value))}>{!d.microphones.length && <option value="">No microphone available</option>}{d.microphones.map(({device}, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${i+1}`}</option>)}</select></label>
 <div><div className={styles.speakerHeading}><label htmlFor="speaker" className={styles.deviceLabel}><DeviceIcon kind="speaker"/>Speakers</label><button title="Play a test sound through the selected speaker" onClick={() => void test()}>Play test sound <span className={styles.playIcon}><DeviceIcon kind="play"/></span></button></div><select id="speaker" value={d.currentSpeaker?.device.deviceId || ''} onChange={e => change(d.setSpeaker(e.target.value))}>{!d.speakers.length && <option value="">System default</option>}{d.speakers.map(({device}, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Speaker ${i+1}`}</option>)}</select></div>
 {(error || p.isPermissionsDenied) && <p role="alert" className={styles.error}>{error || 'Allow camera and microphone access in your browser settings, then reload.'}</p>}
 </div></div></section>;
}
