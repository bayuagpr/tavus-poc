import { memo } from "react";
import { useDevices } from "@daily-co/daily-react";
import { useLocalCamera } from "../../hooks/use-local-camera";
import { useLocalMicrophone } from "../../hooks/use-local-microphone";
import { useLocalScreenshare } from "../../hooks/use-local-screenshare";
import styles from "./device-select.module.css";

export const SelectDevice = ({
  value,
  devices,
  disabled,
  onChange,
  label,
}: {
  label: string;
  value: string | undefined;
  devices: { device: MediaDeviceInfo }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) => {
  return (
    <div className={styles.selectDeviceContainer}>
      <select
        title={label}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={styles.selectDevice}
      >
        {devices.map(({ device }) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      <span className={styles.selectArrow}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6L8 10L12 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
};

export const MicSelectBtn = memo(() => {
  const { onToggleMicrophone, isMicReady, isMicMuted } = useLocalMicrophone();
  const { microphones, currentMic, setMicrophone } = useDevices();

  return (
    <div className={styles.deviceButtonContainer}>
      <button
        type="button"
        title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
        aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
        onClick={onToggleMicrophone}
        disabled={!isMicReady}
        className={styles.deviceButton}
      >
        <span className={styles.deviceButtonIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6"/>
            {isMicMuted && <path d="m3 3 18 18"/>}
          </svg>
        </span>
      </button>
      <span className={styles.controlLabel}>{isMicMuted ? "Unmute" : "Mute"}</span>
      <SelectDevice
        label="Choose microphone"
        value={currentMic?.device?.deviceId}
        devices={microphones || []}
        disabled={!isMicReady}
        onChange={(val) => setMicrophone(val)}
      />
    </div>
  );
});

MicSelectBtn.displayName = "MicSelectBtn";

export const CameraSelectBtn = memo(() => {
  const { onToggleCamera, isCamReady, isCamMuted } = useLocalCamera();
  const { currentCam, cameras, setCamera } = useDevices();


  return (
    <div className={styles.deviceButtonContainer}>
      <button
        type="button"
        title={isCamMuted ? "Turn camera on" : "Turn camera off"}
        aria-label={isCamMuted ? "Turn camera on" : "Turn camera off"}
        onClick={onToggleCamera}
        disabled={!isCamReady || !currentCam}
        className={styles.deviceButton}
      >
        <span className={styles.deviceButtonIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="6" width="12" height="12" rx="2"/>
            <path d="m15 10 6-3v10l-6-3"/>
            {isCamMuted && <path d="m3 3 18 18"/>}
          </svg>
        </span>
      </button>
      <span className={styles.controlLabel}>{isCamMuted ? "Start video" : "Stop video"}</span>
      <SelectDevice
        label="Choose camera"
        value={currentCam?.device?.deviceId}
        devices={cameras || []}
        disabled={!isCamReady}
        onChange={(val) => setCamera(val)}
      />
    </div>
  );
});

CameraSelectBtn.displayName = "CameraSelectBtn";

export const ScreenShareButton = memo(() => {
  const { onToggleScreenshare, isScreenSharing } = useLocalScreenshare();

  return (
    <div className={styles.standaloneControl}><button
      type="button"
      title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
      aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
      onClick={onToggleScreenshare}
      className={`${styles.deviceButtonContainer} ${styles.screenShareButton}`}
    >
      <span>
        {isScreenSharing ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            role="img"
            aria-label="Screen Share"
          >
            <path
              d="M21.0008 19C21.2557 19.0003 21.5009 19.0979 21.6862 19.2728C21.8715 19.4478 21.9831 19.687 21.998 19.9414C22.013 20.1958 21.9302 20.4464 21.7666 20.6418C21.603 20.8373 21.3709 20.9629 21.1178 20.993L21.0008 21H3.00085C2.74597 20.9997 2.50081 20.9021 2.31548 20.7272C2.13014 20.5522 2.01861 20.313 2.00367 20.0586C1.98874 19.8042 2.07152 19.5536 2.23511 19.3582C2.3987 19.1627 2.63075 19.0371 2.88385 19.007L3.00085 19H21.0008ZM19.0008 4C19.5054 3.99984 19.9914 4.19041 20.3614 4.5335C20.7314 4.87659 20.958 5.34684 20.9958 5.85L21.0008 6V16C21.001 16.5046 20.8104 16.9906 20.4673 17.3605C20.1243 17.7305 19.654 17.9572 19.1508 17.995L19.0008 18H5.00085C4.49627 18.0002 4.01028 17.8096 3.6403 17.4665C3.27032 17.1234 3.04369 16.6532 3.00585 16.15L3.00085 16V6C3.00069 5.49542 3.19125 5.00943 3.53434 4.63945C3.87743 4.26947 4.34769 4.04284 4.85085 4.005L5.00085 4H19.0008Z"
              fill="#2D65FF"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            role="img"
            aria-label="Screen Share"
          >
            <path
              d="M20.9999 19C21.2547 19.0003 21.4999 19.0979 21.6852 19.2728C21.8706 19.4478 21.9821 19.687 21.997 19.9414C22.012 20.1958 21.9292 20.4464 21.7656 20.6418C21.602 20.8373 21.37 20.9629 21.1169 20.993L20.9999 21H2.99987C2.74499 20.9997 2.49984 20.9021 2.3145 20.7272C2.12916 20.5522 2.01763 20.313 2.0027 20.0586C1.98776 19.8042 2.07054 19.5536 2.23413 19.3582C2.39772 19.1627 2.62977 19.0371 2.88287 19.007L2.99987 19H20.9999ZM18.9999 4C19.5044 3.99984 19.9904 4.19041 20.3604 4.5335C20.7304 4.87659 20.957 5.34684 20.9949 5.85L20.9999 6V16C21 16.5046 20.8095 16.9906 20.4664 17.3605C20.1233 17.7305 19.653 17.9572 19.1499 17.995L18.9999 18H4.99987C4.49529 18.0002 4.0093 17.8096 3.63932 17.4665C3.26934 17.1234 3.04271 16.6532 3.00487 16.15L2.99987 16V6C2.99971 5.49542 3.19028 5.00943 3.53337 4.63945C3.87646 4.26947 4.34671 4.04284 4.84987 4.005L4.99987 4H18.9999Z"
              fill="white"
            />
          </svg>
        )}
      </span>
    </button><span className={styles.controlLabel}>{isScreenSharing ? "Stop sharing" : "Share screen"}</span></div>
  );
});

ScreenShareButton.displayName = "ScreenShareButton";
