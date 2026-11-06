import React, { useEffect, useCallback, useRef, useState } from "react";
import {
	DailyAudio,
	DailyVideo,
	useDevices,
	useDaily,
 useNetwork, useActiveSpeakerId, useAudioTrack,
	useLocalSessionId,
	useMeetingState,
	useScreenVideoTrack,
	useVideoTrack
} from "@daily-co/daily-react";
import { MicSelectBtn, CameraSelectBtn, ScreenShareButton } from '../device-select'
import { useLocalScreenshare } from "../../hooks/use-local-screenshare";
import { useReplicaIDs } from "../../hooks/use-replica-ids";
import { useCVICall } from "../../hooks/use-cvi-call";


import styles from "./conversation.module.css";


import { ClosedCaptionsProvider, ClosedCaptions, ClosedCaptionsButton } from '../closed-captions';

function CallIcon({ kind }: { kind: 'mic' | 'muted' | 'wave' | 'grid' | 'expand' }) {
 return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'wave' ? <path d="M4 10v4m4-7v10m4-14v18m4-14v10m4-7v4"/> : kind === 'grid' ? <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></> : kind === 'expand' ? <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/> : <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3"/>{kind === 'muted' && <path d="m3 3 18 18"/>}</>}</svg>;
}
function ConnectionIndicator({ demo }: { demo: boolean }) {
 const { threshold, topology } = useNetwork();
 const joined = useMeetingState() === 'joined-meeting';
 const [seconds, setSeconds] = useState(0);
 useEffect(() => { if (!joined) return; const started = Date.now(); const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000); return () => clearInterval(timer); }, [joined]);
 const state = demo ? 'Demo session' : joined ? 'Live session' : 'Connecting';
 const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
 return <div className={styles.connection} title={demo ? "Demo preview" : `Network: ${topology === 'none' ? 'connecting' : threshold}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 9a15 15 0 0 1 18 0M6 13a10 10 0 0 1 12 0M9 17a5 5 0 0 1 6 0"/><circle cx="12" cy="21" r="1"/></svg>{state}<span className={styles.timer}>{time}</span></div>;
}
interface ConversationProps {
	onLeave: () => void;
	conversationUrl: string;
	demo?: boolean;
}

const VideoPreview = React.memo(({ id }: { id: string }) => {
	const videoState = useVideoTrack(id);

	return (
		<div
			className={styles.previewVideoContainer}
		>
            {videoState.isOff && <div className={styles.cameraOff}><span className={styles.cameraAvatar}>Y</span><span>Camera is off</span></div>}
			<DailyVideo
				automirror
				sessionId={id}
				type="video"
				className={`${styles.previewVideo} ${videoState.isOff ? styles.previewVideoHidden : ''}`}
			/>
			
		</div>
	);
});

const PreviewVideos = React.memo(() => {
	const localId = useLocalSessionId();
	const { isScreenSharing } = useLocalScreenshare();
	const replicaIds = useReplicaIDs();
	const replicaId = replicaIds[0];

	return (
		<>
			{isScreenSharing && replicaId && (
				<VideoPreview id={replicaId} />
			)}
			<VideoPreview id={localId} />
		</>
	);
});

const MainVideo = React.memo(() => {
	const replicaIds = useReplicaIDs();
	const localId = useLocalSessionId();
	const videoState = useVideoTrack(replicaIds[0]);
	const screenVideoState = useScreenVideoTrack(localId);
	const isScreenSharing = !screenVideoState.isOff;
	// This is one-to-one call, so we can use the first replica id
	const replicaId = replicaIds[0];

	if (!replicaId) {
		return (
			<div className={styles.waitingContainer}>
				<p>Connecting...</p>
			</div>
		);
	}

	// Switching between replica video and screen sharing video
	return (
		<div
			className={`${styles.mainVideoContainer} ${isScreenSharing ? styles.mainVideoContainerScreenSharing : ''}`}
		>
			<DailyVideo
				automirror
				sessionId={isScreenSharing ? localId : replicaId}
				type={isScreenSharing ? "screenVideo" : "video"}
				className={`${styles.mainVideo}
				${isScreenSharing ? styles.mainVideoScreenSharing : ''}
				${!isScreenSharing && videoState.isOff ? styles.mainVideoHidden : ''}`}
			/>
		</div>
	);
});

export const Conversation = React.memo(({ onLeave, conversationUrl, demo = false }: ConversationProps) => {
	const { joinCall, leaveCall } = useCVICall();
	const daily = useDaily();
	const replicaIds = useReplicaIDs();
 const rootRef = useRef<HTMLDivElement>(null);
 const [grid, setGrid] = useState(false);
 const [fullscreen, setFullscreen] = useState(false);
 const localId = useLocalSessionId();
 const activeSpeaker = useActiveSpeakerId();
 const localAudio = useAudioTrack(localId);
 const { isScreenSharing } = useLocalScreenshare();
 const replicaSpeaking = !demo && replicaIds.includes(activeSpeaker || '');
 const userSpeaking = !demo && activeSpeaker === localId;
 useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === rootRef.current); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);
 const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await rootRef.current?.requestFullscreen(); } catch { setJoinError('Fullscreen is unavailable in this browser.'); } };
 const [previewEnabled, setPreviewEnabled] = useState(false);
	const meetingState = useMeetingState();
	const joinStarted = useRef(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	const { hasMicError } = useDevices()

	useEffect(() => {
        if (meetingState === 'error') {
            setJoinError('Unable to join this room. Check that the conversation is still active and use its latest conversation URL.');
        }
    }, [meetingState]);

    useEffect(() => {
        if (demo || joinStarted.current) return;
        joinStarted.current = true;
        void joinCall({ url: conversationUrl }).catch((error: unknown) => {
            console.error('Unable to join conversation', error);
            setJoinError('Unable to join this room. Check that the conversation is still active and use its latest conversation URL.');
        });
    }, [joinCall, conversationUrl, demo]);

	const handleLeave = useCallback(() => {
		void leaveCall().then(onLeave).catch((error: unknown) => {
            console.error("Unable to leave conversation", error);
            setJoinError("Unable to disconnect. Refresh the page before trying again.");
        });
	}, [leaveCall, onLeave]);

	return (
		<ClosedCaptionsProvider defaultEnabled={demo}><div ref={rootRef} className={`${styles.container} ${grid && !isScreenSharing ? styles.gridMode : ''} ${isScreenSharing ? styles.presentationMode : ''}`}>
			<header className={styles.sessionHeader}><div className={styles.sessionBrand}><span className={styles.brandMark}><CallIcon kind="wave"/></span><strong>Ask Loka</strong><span className={styles.courseName}>Data Wrangling with SQL</span></div><ConnectionIndicator demo={demo}/></header>
 {joinError && <p role="alert">{joinError}</p>}
			<div className={styles.videoContainer}>
				{
					hasMicError && (
						<div className={styles.errorContainer}>
							<p>
								Camera or microphone access denied. Please check your settings and try again.
							</p>
						</div>
					)}

				<div className={styles.stageHeading}><span className={styles.speakingStatus}><CallIcon kind="wave"/>{replicaSpeaking ? 'Loka is speaking' : userSpeaking ? 'You are speaking' : demo ? 'Demo preview' : 'Listening'}</span><div className={styles.viewActions}><button title={isScreenSharing ? 'Presentation layout is used while sharing your screen' : grid ? 'Switch to speaker view' : 'Switch to grid view'} disabled={isScreenSharing} aria-pressed={grid && !isScreenSharing} onClick={() => setGrid(v => !v)}><CallIcon kind="grid"/>{isScreenSharing ? 'Presentation view' : grid ? 'Speaker view' : 'Grid view'}</button><button title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => void toggleFullscreen()}><CallIcon kind="expand"/></button></div></div>
 {/* Main video */}
				<div className={styles.mainVideoContainer}>
					{demo ? <div className={styles.demoStage}><span className={styles.demoBadge}>DEMO MODE</span><div className={styles.demoAvatar} aria-hidden="true"><svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="43" r="22" fill="currentColor"/><path d="M18 114v-8a42 42 0 0 1 84 0v8" fill="currentColor"/></svg></div><h2>Replica preview</h2><p>A live replica video appears here during a conversation.</p><small>No session connected. No AI responses.</small></div> : <MainVideo />}
                    <span className={styles.replicaLabel}><i/>{isScreenSharing ? "Your screen" : "Loka"}{!isScreenSharing && <CallIcon kind="wave"/>}</span>
				</div>

				
 <ClosedCaptions demo={demo}/>
 {/* Self view */}
				<div className={styles.selfViewContainer}>
					{!demo || previewEnabled ? <PreviewVideos /> : <div className={styles.demoSelf}><span>Your camera preview</span><button title="Enable camera and microphone preview" onClick={() => { void daily?.startCamera({ startVideoOff: false, startAudioOff: false }).then(() => setPreviewEnabled(true)).catch(() => setJoinError('Unable to enable camera preview. Check browser permissions.')); }}>Enable camera &amp; mic</button></div>}
                    <span className={styles.youLabel} title={localAudio.isOff ? "Your microphone is muted" : "Your microphone is on"}><CallIcon kind={localAudio.isOff ? "muted" : "mic"}/>You {localAudio.isOff ? "· Muted" : ""}</span>
                    <section className={styles.infoCard}><h3>Participants <span>{demo ? 2 : replicaIds.length + 1}</span></h3><div className={styles.person}><span className={styles.personAvatar}>L</span><div>Loka<small>{demo ? 'Demo replica' : replicaSpeaking ? 'Speaking' : replicaIds.length ? 'Listening' : 'Waiting to connect'}</small></div><span className={styles.participantState} title={demo ? "Demo participant status" : replicaSpeaking ? "Loka is speaking" : "Loka is not speaking"}><CallIcon kind={replicaSpeaking ? 'wave' : 'mic'}/></span></div><div className={styles.person}><span className={styles.personAvatar}>Y</span><div>You<small>{userSpeaking ? "Speaking" : "Learner"}</small></div><span className={styles.participantState} title={localAudio.isOff ? "Microphone muted" : "Microphone on"}><CallIcon kind={localAudio.isOff ? "muted" : userSpeaking ? "wave" : "mic"}/></span></div></section>
                    <section className={styles.infoCard}><h3>In this session</h3><p>Data Wrangling with SQL</p><small>Ask a question or share your screen to work through a topic together.</small><small className={styles.sessionNote}>{demo ? 'Preview mode · No live session' : 'Live learning session'}</small></section>
                </div>
            </div>

            <div className={styles.footer}>
				<div className={styles.footerControls}>
					<MicSelectBtn />
 
 
					<CameraSelectBtn />
					<div className={styles.centerControls}><ScreenShareButton /><ClosedCaptionsButton/></div>
					<button type="button" className={styles.leaveButton} onClick={handleLeave} title="Leave session" aria-label="Leave session">
						<span>Leave Session</span><span className={styles.leaveButtonIcon}>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								role="img"
								aria-label="Leave Call"
							>
								<path
									d="M18 6L6 18M6 6L18 18"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</span>
					</button>
				</div>
			</div>

			
 
 {!demo && <DailyAudio />}
		</div></ClosedCaptionsProvider>
	);
});


