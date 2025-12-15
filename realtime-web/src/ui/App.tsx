import React, { useRef, useState } from "react";

const WS_URL = "ws://127.0.0.1:8717/ws";

function floatTo16BitPCM(input: Float32Array) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// very small resampler (good enough for speech)
function downsampleBuffer(buffer: Float32Array, inRate: number, outRate: number) {
  if (outRate === inRate) return buffer;
  const ratio = inRate / outRate;
  const newLen = Math.round(buffer.length / ratio);
  const out = new Float32Array(newLen);
  let offset = 0;
  for (let i = 0; i < newLen; i++) {
    const next = Math.round((i + 1) * ratio);
    let sum = 0, count = 0;
    for (; offset < next && offset < buffer.length; offset++) {
      sum += buffer[offset];
      count++;
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

export default function App() {
  const [running, setRunning] = useState(false);
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    setFinalText("");
    setPartial("");

    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "partial") setPartial(msg.text ?? "");
        if (msg.type === "final") {
          setPartial("");
          setFinalText(msg.text ?? "");
        }
      } catch {}
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("ws connect failed"));
    });

    ws.send(JSON.stringify({ language: null, task: "transcribe", beam_size: 1 }));
    wsRef.current = ws;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const proc = audioCtx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;

    proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const down = downsampleBuffer(input, audioCtx.sampleRate, 16000);
      const pcm16 = floatTo16BitPCM(down);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(pcm16.buffer);
      }
    };

    source.connect(proc);
    proc.connect(audioCtx.destination);
    setRunning(true);
  }

  async function stop() {
    setRunning(false);

    try { wsRef.current?.send(JSON.stringify({ type: "stop" })); } catch {}
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;

    try { procRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    procRef.current = null;
    audioCtxRef.current = null;

    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    streamRef.current = null;
  }

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>Handy-style Realtime Whisper (chunked)</h1>
      <p style={{ opacity: 0.75 }}>Server: {WS_URL}</p>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        {!running ? (
          <button onClick={start} style={{ padding: "10px 14px" }}>Start</button>
        ) : (
          <button onClick={stop} style={{ padding: "10px 14px" }}>Stop</button>
        )}
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.6 }}>Partial</div>
        <div style={{ fontSize: 20, whiteSpace: "pre-wrap" }}>{partial || "…"}</div>
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.6 }}>Final</div>
        <div style={{ fontSize: 20, whiteSpace: "pre-wrap" }}>{finalText || "—"}</div>
      </div>
    </div>
  );
}
