import { useState, useEffect } from "react";
import AgoraRTC, { 
  AgoraRTCProvider, 
  useJoin, 
  useLocalMicrophoneTrack, 
  usePublish, 
  useRemoteAudioTracks 
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

  // 1. Join the Voice Channel (Automatically uses your Canvas roomId!)
  useJoin({ appid: appId, channel: roomId, token: null });

  // 2. Turn on the local microphone
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(micOn);

  // 3. Broadcast your voice to the room
  usePublish([localMicrophoneTrack]);

  // 4. Receive everyone else's voice
  const { audioTracks } = useRemoteAudioTracks();

  // 5. Play the incoming audio
  useEffect(() => {
    audioTracks.forEach((track) => track.play());
  }, [audioTracks]);

  return (
    <div style={{ marginTop: "20px", borderTop: "2px solid #333", paddingTop: "15px" }}>
      <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "0.8rem", color: "#888", marginBottom: "10px" }}>
        TEAM RADIO
      </p>
      <button 
        className={`btn-action ${micOn ? 'btn-clear' : 'btn-leave'}`}
        onClick={() => setMicOn(!micOn)}
        style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}
      >
        {micOn ? "🎙️ MIC ACTIVE" : "🔇 MIC MUTED"}
      </button>
    </div>
  );
}