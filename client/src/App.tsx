import { useState, useRef, useCallback } from "react";
import Orb from "./components/Orb";
import "./App.css";
function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const VECTOR_STORE_ID = import.meta.env.VITE_VECTOR_STORE_ID;
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  const vector_search = async (query: string) => {
    console.log("called the vector_search function");
    const response = await fetch(
      `https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
        }),
      }
    );
    const data = await response.json();
    return data.data[0].content[0].text;
  };

  const sendFunctionOutput = (
    dc: RTCDataChannel,
    callId: string,
    output: string
  ) => {
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: output,
        },
      })
    );
    dc.send(JSON.stringify({ type: "response.create" }));
  };

  const startCall = useCallback(async () => {
    try {
      const tokenResp = await fetch(
        "https://incred-money-voice-agent-production.up.railway.app/session",
        {
          method: "POST",
        }
      );
      const session = await tokenResp.json();

      pcRef.current = new RTCPeerConnection();

      if (!audioRef.current) {
        audioRef.current = document.createElement("audio");
        audioRef.current.autoplay = true;
      }

      pcRef.current.ontrack = (event: RTCTrackEvent) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream
        .getTracks()
        .forEach((track) => pcRef.current?.addTrack(track, stream));

      const dc = pcRef.current.createDataChannel("oai-events");
      dc.onmessage = async (e) => {
        console.log("AI Event:", e.data);
        const data = JSON.parse(e.data);
        console.log(typeof e.data);
        switch (data.type) {
          case "output_audio_buffer.started":
            console.log("the ai is set to true ahahhaha");
            setIsAISpeaking(true);
            break;
          case "output_audio_buffer.stopped":
            setIsAISpeaking(false);
            break;
          case "response.function_call_arguments.done":
            console.log(`========================================
              THE FUNCTION CALL ARGUEMENTS HAS BEEN CALLED ${data}
              =================================================`);
            if (data.name === "vector_search") {
              console.log("Call the vector_search");
              const response = await vector_search(data.arguments);
              console.log(
                "This is the response i get for the vector_search",
                response
              );
              sendFunctionOutput(dc, data.call_id, response);
            }
            break;
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
