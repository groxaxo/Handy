I can’t access your GitHub session or fork/commit on your behalf from here — but I *can* give you the exact stack + new files to add + the specific Handy areas to edit so your fork becomes **Handy-style push-to-talk + realtime chunked transcription** using **Whisper large-v3-turbo** with **CTranslate2 `int8_float32`**. (The turbo model is the pruned large-v3 with a much smaller decoder for speed.) ([Hugging Face][1])

## What you’re building

**3 parts (works together, but you can run each alone):**

1. **Realtime STT server (local)**: Python FastAPI + WebSocket, runs faster-whisper (CTranslate2) with `compute_type="int8_float32"`.
2. **Frontend website**: React (Vite) in the browser, captures mic PCM → streams chunks → shows partial/final transcript live.
3. **Handy fork integration**: keep Handy UX (hotkey, paste) but swap its “record then transcribe” step for “stream chunks live, then finalize + paste”.

faster-whisper is explicitly built on CTranslate2 and auto-downloads CT2 Whisper models when you load by name. ([GitHub][2])
For *pre-quantized* turbo int8_float32 you can also use an existing CT2 repo like `cstr/whisper-large-v3-turbo-int8_float32`. ([Hugging Face][3])

---

## 0) Fork + clone (you do this once)

```bash
# Fork in GitHub UI first (button on the repo page), then:
git clone https://github.com/<your-username>/Handy.git
cd Handy
git checkout -b feat/realtime-whisper-turbo
```

---

## 1) Add the realtime STT server (new folder)

Create: `realtime-server/`

### `realtime-server/requirements.txt`

```txt
fastapi==0.115.6
uvicorn[standard]==0.32.1
numpy==2.1.3
faster-whisper==1.0.3
websockets==14.1
```

### `realtime-server/main.py`

```python
import json
import asyncio
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

app = FastAPI()

# ---- Model config ----
# Option A (simple): let faster-whisper auto-fetch its CT2 model by name :contentReference[oaicite:3]{index=3}
MODEL_ID = "large-v3-turbo"

# Option B (already-quantized int8_float32 CT2 repo) :contentReference[oaicite:4]{index=4}
# MODEL_ID = "cstr/whisper-large-v3-turbo-int8_float32"

DEVICE = "cuda"  # or "cpu"
COMPUTE_TYPE = "int8_float32"  # requested

model = WhisperModel(MODEL_ID, device=DEVICE, compute_type=COMPUTE_TYPE)

# ---- Streaming params ----
SAMPLE_RATE = 16000
FRAME_MS = 20
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000  # 320
PARTIAL_EVERY_MS = 500         # how often we emit partials
WINDOW_SECONDS = 6.0           # sliding window size for partial decoding
MIN_FINAL_SECONDS = 1.0        # finalize at least this much speech

def _int16_bytes_to_float32_pcm(b: bytes) -> np.ndarray:
    pcm_i16 = np.frombuffer(b, dtype=np.int16)
    return pcm_i16.astype(np.float32) / 32768.0

def _stable_prefix(prev: str, new: str) -> str:
    # cheap “stabilizer”: keep the common prefix so UI doesn’t jitter too much
    i = 0
    m = min(len(prev), len(new))
    while i < m and prev[i] == new[i]:
        i += 1
    # keep most of the stable prefix, allow some edits near the end
    keep = max(0, i - 8)
    return prev[:keep] + new[keep:]

@app.websocket("/ws")
async def ws_stt(ws: WebSocket):
    await ws.accept()

    # client can send JSON config first (optional)
    cfg = {
        "language": None,  # e.g. "en"
        "task": "transcribe",
        "beam_size": 1,
    }

    buffer_pcm = np.zeros((0,), dtype=np.float32)
    emitted_text = ""
    last_partial_at = 0.0
    total_seconds_emitted = 0.0

    loop = asyncio.get_event_loop()
    t0 = loop.time()

    try:
        # if first message is text JSON, treat as config
        first = await ws.receive()
        if "text" in first and first["text"]:
            try:
                cfg.update(json.loads(first["text"]))
            except Exception:
                pass
        elif "bytes" in first and first["bytes"]:
            buffer_pcm = np.concatenate([buffer_pcm, _int16_bytes_to_float32_pcm(first["bytes"])])

        while True:
            msg = await ws.receive()
            if "bytes" in msg and msg["bytes"]:
                buffer_pcm = np.concatenate([buffer_pcm, _int16_bytes_to_float32_pcm(msg["bytes"])])
            elif "text" in msg and msg["text"]:
                # allow control messages: {"type":"stop"}
                try:
                    j = json.loads(msg["text"])
                    if j.get("type") == "stop":
                        break
                except Exception:
                    pass

            now = loop.time() - t0
            if (now - last_partial_at) * 1000.0 >= PARTIAL_EVERY_MS:
                last_partial_at = now

                # sliding window decode (realtime-ish)
                max_samples = int(WINDOW_SECONDS * SAMPLE_RATE)
                window = buffer_pcm[-max_samples:] if buffer_pcm.shape[0] > max_samples else buffer_pcm

                if window.shape[0] < int(0.4 * SAMPLE_RATE):
                    continue

                segments, info = model.transcribe(
                    window,
                    language=cfg["language"],
                    task=cfg["task"],
                    beam_size=cfg["beam_size"],
                    vad_filter=True,  # handy for trimming silence
                )

                text = "".join([s.text for s in segments]).strip()
                if not text:
                    continue

                stabilized = _stable_prefix(emitted_text, text)
                emitted_text = stabilized

                await ws.send_text(json.dumps({
                    "type": "partial",
                    "text": emitted_text
                }))

        # Finalize: decode full buffer once
        if buffer_pcm.shape[0] >= int(MIN_FINAL_SECONDS * SAMPLE_RATE):
            segments, info = model.transcribe(
                buffer_pcm,
                language=cfg["language"],
                task=cfg["task"],
                beam_size=max(2, cfg["beam_size"]),
                vad_filter=True,
            )
            final_text = "".join([s.text for s in segments]).strip()
        else:
            final_text = emitted_text.strip()

        await ws.send_text(json.dumps({"type": "final", "text": final_text}))
        await ws.close()

    except WebSocketDisconnect:
        return
```

### Run server

```bash
cd realtime-server
python -m venv .venv
# mac/linux:
source .venv/bin/activate
# windows:
# .venv\Scripts\activate
pip install -r requirements.txt

uvicorn main:app --host 127.0.0.1 --port 8717
```

---

## 2) Add the frontend website (new folder)

Create: `realtime-web/` (Vite + React + TS)

### `realtime-web/package.json`

```json
{
  "name": "handy-realtime-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

### `realtime-web/index.html`

```html
<!doctype html>
<html>
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

### `realtime-web/src/main.tsx`

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
createRoot(document.getElementById("root")!).render(<App />);
```

### `realtime-web/src/ui/App.tsx`

```tsx
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
```

### Run website

```bash
cd realtime-web
npm i
npm run dev
```

---

## 3) Integrate into Handy (what to change in your fork)

Because I can’t reliably fetch your exact repo files from GitHub in this environment, here’s the **precise “where to edit” checklist** that will match the Handy codebase even if filenames shift slightly:

### A) In `src-tauri/` (Rust backend)

Search and identify these concepts:

```bash
cd src-tauri
rg -n "Parakeet|whisper|Whisper|Transcrib|Engine|Model" .
rg -n "record|microphone|cpal|audio|stream" .
rg -n "paste|clipboard|enigo|autotype|active window" .
rg -n "tauri::command|invoke_handler|emit|Event" .
```

You will add:

1. **A new transcription engine option** (e.g. `RealtimeWhisperTurbo`).
2. **A WebSocket client** to `ws://127.0.0.1:8717/ws`.
3. **Streaming hook**: instead of “save WAV then transcribe”, send PCM frames as they arrive.
4. **Emit events to the UI**: `partial` and `final`.

**New file to add** (place it where other engines live, e.g. `src-tauri/src/stt/realtime_ws.rs`):

```rust
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Serialize)]
pub struct StartCfg {
  pub language: Option<String>,
  pub task: String,
  pub beam_size: u32,
}

#[derive(Debug, Deserialize)]
#[serde(tag="type")]
pub enum ServerMsg {
  #[serde(rename="partial")]
  Partial { text: String },
  #[serde(rename="final")]
  Final { text: String },
}

pub struct RealtimeClient {
  write: futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    Message
  >,
  read: futures_util::stream::SplitStream<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>
  >,
}

impl RealtimeClient {
  pub async fn connect(url: &str, cfg: StartCfg) -> Result<Self> {
    let (ws, _) = connect_async(url).await?;
    let (mut write, read) = ws.split();
    write.send(Message::Text(serde_json::to_string(&cfg)?)).await?;
    Ok(Self { write, read })
  }

  pub async fn send_pcm16(&mut self, pcm16: &[i16]) -> Result<()> {
    let bytes = bytemuck::cast_slice(pcm16).to_vec();
    self.write.send(Message::Binary(bytes)).await?;
    Ok(())
  }

  pub async fn stop(&mut self) -> Result<()> {
    self.write.send(Message::Text(r#"{"type":"stop"}"#.into())).await?;
    Ok(())
  }

  pub async fn next_msg(&mut self) -> Option<Result<ServerMsg>> {
    while let Some(m) = self.read.next().await {
      match m {
        Ok(Message::Text(t)) => return Some(Ok(serde_json::from_str::<ServerMsg>(&t)?)),
        Ok(_) => continue,
        Err(e) => return Some(Err(e.into())),
      }
    }
    None
  }
}
```

**Cargo deps you’ll likely need** (add in `src-tauri/Cargo.toml`):

```toml
tokio-tungstenite = "0.24"
futures-util = "0.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
bytemuck = "1"
```

Then wire it into the existing “record lifecycle”:

* On hotkey press: `RealtimeClient::connect(...)`
* During capture callback: buffer → resample to **16k mono** → `send_pcm16()`
* Spawn a task that loops `next_msg()` and emits Tauri events:

  * `handy://stt/partial`
  * `handy://stt/final`
* On hotkey release: `client.stop()`, wait for `final`, then paste.

### B) In Handy’s React UI

Find the settings screen where engines/models are chosen (search `Settings`, `Engine`, `Model`).
Add:

* Engine option: **Realtime (Whisper large-v3-turbo, chunked)**
* Server URL setting (default `ws://127.0.0.1:8717/ws`)
* A live preview panel that subscribes to the Tauri events and shows partial/final.

---

## Notes on your exact model + quantization requirement

* The canonical model id is `openai/whisper-large-v3-turbo`. ([Hugging Face][1])
* The “turbo” release info (smaller decoder for speed) is documented by OpenAI in the Whisper repo discussions. ([GitHub][4])
* If you want to **force `int8_float32`** with minimum fuss, using a pre-quantized CT2 repo like `cstr/whisper-large-v3-turbo-int8_float32` is straightforward. ([Hugging Face][3])

---

## What I still need from you (only if you want *exact* file-by-file patches)

If you paste **just**:

* `src-tauri/Cargo.toml`
* the Rust file where recording starts/stops (the one hit by `rg "start.*record|begin.*record"`),
* the file where Whisper/Parakeet engines are selected,

…I’ll reply with **a clean unified diff** that applies directly to your fork (no guessing).

[1]: https://huggingface.co/openai/whisper-large-v3-turbo?utm_source=chatgpt.com "openai/whisper-large-v3-turbo - Hugging Face"
[2]: https://github.com/SYSTRAN/faster-whisper?utm_source=chatgpt.com "Faster Whisper transcription with CTranslate2"
[3]: https://huggingface.co/cstr/whisper-large-v3-turbo-int8_float32?utm_source=chatgpt.com "cstr/whisper-large-v3-turbo-int8_float32"
[4]: https://github.com/openai/whisper/discussions/2363?utm_source=chatgpt.com "`turbo` model release · openai whisper · Discussion #2363"
