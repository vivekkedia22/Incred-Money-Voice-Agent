import { useState, useRef, useCallback } from "react";
import Orb from "./components/Orb";
import "./App.css";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startCall = useCallback(async () => {
    try {
      const tokenResp = await fetch("https://incred-money-voice-agent-production.up.railway.app/session", {
        method: "POST",
      });
      const session = await tokenResp.json();

      pcRef.current = new RTCPeerConnection();

      if (!audioRef.current) {
        audioRef.current = document.createElement("audio");
        audioRef.current.autoplay = true;
      }

      pcRef.current.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];

          // Monitor audio activity to detect AI speaking
          // const audioContext = new AudioContext();
          // const source = audioContext.createMediaStreamSource(event.streams[0]);
          // const analyser = audioContext.createAnalyser();
          // source.connect(analyser);

          // const dataArray = new Uint8Array(analyser.frequencyBinCount);

          // const checkAudioActivity = () => {
          //   if (!isConnected) return;
          //   analyser.getByteFrequencyData(dataArray);
          //   const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          //   setIsAISpeaking(average > 10);
          //   requestAnimationFrame(checkAudioActivity);
          // };
          // checkAudioActivity();
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream
        .getTracks()
        .forEach((track) => pcRef.current?.addTrack(track, stream));

      const dc = pcRef.current.createDataChannel("oai-events");
      dc.onmessage = (e) => {
        console.log("AI Event:", e.data);
        const data=JSON.parse(e.data);
        console.log(typeof e.data);
        if (data.type === "output_audio_buffer.started") {
          console.log("the ai is set to true ahahhaha");
          setIsAISpeaking(true);
        } else if (data.type === "output_audio_buffer.stopped") {
          setIsAISpeaking(false);
        }
      };

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime/calls";
      const sdpResp = await fetch(`${baseUrl}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${session.value}`,
          "Content-Type": "application/sdp",
        },
      });

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResp.text(),
      };

      await pcRef.current.setRemoteDescription(answer);
      setIsConnected(true);
    } catch (error) {
      console.error("Error starting call:", error);
    }
  }, [isConnected]);

  const endCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setIsConnected(false);
    setIsAISpeaking(false);
  }, []);

  return (
    <div className="app">
      <div
        style={{
          width: "100%",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <Orb
          backgroundColor="#000000"
          hoverIntensity={0.5}
          rotateOnHover={true}
          hue={0}
          forceHoverState={isAISpeaking}
        />
      </div>
      <div className="controls">
        <button
          onClick={startCall}
          disabled={isConnected}
          className="start-btn"
        >
          Start Call
        </button>
        <button onClick={endCall} disabled={!isConnected} className="end-btn">
          End Call
        </button>
      </div>
    </div>
  );
}

export default App;
