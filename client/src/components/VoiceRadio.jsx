import { useState, useEffect } from "react";
import AgoraRTC, { 
  AgoraRTCProvider, 
  useJoin, 
  useLocalMicrophoneTrack, 
  usePublish, 
  useRemoteUsers,
  useRemoteAudioTracks // 🚨 BRINGING THIS BACK: We need this to explicitly download the audio
} from "agora-rtc-react";

// Initialize the Agora Engine
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export default function VoiceRadio({ roomId }) {
  return (
    <AgoraRTCProvider client={client}>
      <RadioController roomId={roomId} />
    </AgoraRTCProvider>
  );
}

function RadioController({ roomId }) {
  const appId = import.meta.env.VITE_AGORA_APP_ID;
  const [micOn, setMicOn] = useState(true);

  // 1. Join the Voice Channel
  useJoin({ appid: appId, channel: roomId, token: null });

  // 2. Broadcast your local mic
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(micOn);
  usePublish([localMicrophoneTrack]);

  // 3. Get the connected users
  const remoteUsers = useRemoteUsers();

  // 4. 🚨 THE MISSING LINK: Explicitly subscribe and download their audio tracks!
  const { audioTracks } = useRemoteAudioTracks(remoteUsers);

  // 5. Try to auto-play the audio the second it arrives
  useEffect(() => {
    audioTracks.forEach((track) => track.play());
  }, [audioTracks]);

  // 6. Manual failsafe to completely bypass Apple/Google Autoplay blocks
  const forcePlayAudio = () => {
    audioTracks.forEach((track) => track.play());
    console.log("Forced audio playback!");
  };

  return (
    <div style={{ marginTop: "20px", borderTop: "2px solid #333", paddingTop: "15px" }}>
      <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "0.8rem", color: "#888", marginBottom: "10px" }}>
        TEAM RADIO ({remoteUsers.length} connected)
      </p>

      <button 
        className={`btn-action ${micOn ? 'btn-clear' : 'btn-leave'}`}
        onClick={() => setMicOn(!micOn)}
        style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "10px" }}
      >
        {micOn ? "🎙️ MIC ACTIVE" : "🔇 MIC MUTED"}
      </button>

      {/* 🚨 THE FAILSAFE: This button only appears when someone else joins. 
          Clicking it mathematically guarantees the browser will allow the sound. */}
      {audioTracks.length > 0 && (
        <button 
          className="btn-action"
          onClick={forcePlayAudio}
          style={{ width: "100%", backgroundColor: "#4CAF50", color: "white", fontWeight: "bold", border: "none" }}
        >
          🔊 UNMUTE INCOMING RADIO
        </button>
      )}
    </div>
  );
}