import json
import asyncio
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

app = FastAPI()

# ---- Model config ----
# Option A (simple): let faster-whisper auto-fetch its CT2 model by name
MODEL_ID = "large-v3"

# Option B (already-quantized int8_float32 CT2 repo)
# MODEL_ID = "cstr/whisper-large-v3-turbo-int8_float32"

DEVICE = "cuda"  # or "cpu"
COMPUTE_TYPE = "int8_float32"  # requested

model = WhisperModel(MODEL_ID, device=DEVICE, compute_type=COMPUTE_TYPE)

# ---- Streaming params ----
SAMPLE_RATE = 16000
FRAME_MS = 20
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000  # 320
PARTIAL_EVERY_MS = 500  # how often we emit partials
WINDOW_SECONDS = 6.0  # sliding window size for partial decoding
MIN_FINAL_SECONDS = 1.0  # finalize at least this much speech


def _int16_bytes_to_float32_pcm(b: bytes) -> np.ndarray:
    pcm_i16 = np.frombuffer(b, dtype=np.int16)
    return pcm_i16.astype(np.float32) / 32768.0


def _stable_prefix(prev: str, new: str) -> str:
    # cheap "stabilizer": keep the common prefix so UI doesn't jitter too much
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
            buffer_pcm = np.concatenate(
                [buffer_pcm, _int16_bytes_to_float32_pcm(first["bytes"])]
            )

        while True:
            msg = await ws.receive()
            if "bytes" in msg and msg["bytes"]:
                buffer_pcm = np.concatenate(
                    [buffer_pcm, _int16_bytes_to_float32_pcm(msg["bytes"])]
                )
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
                window = (
                    buffer_pcm[-max_samples:]
                    if buffer_pcm.shape[0] > max_samples
                    else buffer_pcm
                )

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

                await ws.send_text(
                    json.dumps({"type": "partial", "text": emitted_text})
                )

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
