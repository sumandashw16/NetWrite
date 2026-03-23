import { useState } from "react";
import AgoraRTC, { 
  AgoraRTCProvider, 
  useJoin, 
  useLocalMicrophoneTrack, 
  usePublish, 
  useRemoteUsers,
  RemoteAudioTrack // 🚨 The new import
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

  // 3. 🚨 GET THE USERS, NOT JUST THE TRACKS
  const remoteUsers = useRemoteUsers();

  return (
    <div style={{ marginTop: "20px", borderTop: "2px solid #333", paddingTop: "15px" }}>
      <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "0.8rem", color: "#888", marginBottom: "10px" }}>
        {/* Shows you exactly how many people are connected! */}
        TEAM RADIO ({remoteUsers.length} connected) 
      </p>

      <button 
        className={`btn-action ${micOn ? 'btn-clear' : 'btn-leave'}`}
        onClick={() => setMicOn(!micOn)}
        style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}
      >
        {micOn ? "🎙️ MIC ACTIVE" : "🔇 MIC MUTED"}
      </button>

      {/* 🚨 THE DOM ANCHOR: This forces React to keep the audio alive */}
      {remoteUsers.map((user) => (
        <div key={user.uid} style={{ display: "none" }}>
          {user.audioTrack && (
            <RemoteAudioTrack track={user.audioTrack} play={true} />
          )}
        </div>
      ))}
    </div>
  );
}