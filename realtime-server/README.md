# Handy Realtime STT Server

This is a realtime Speech-to-Text (STT) server that uses Whisper large-v3-turbo with CTranslate2 `int8_float32` quantization for fast, chunked transcription.

## Features

- WebSocket-based realtime streaming
- Chunked transcription with partial results
- Uses faster-whisper (CTranslate2) for efficient inference
- Whisper large-v3-turbo model (pruned large-v3 with smaller decoder)
- Voice Activity Detection (VAD) filtering
- Supports both CPU and CUDA

## Requirements

- Python 3.8+
- CUDA toolkit (optional, for GPU acceleration)

## Installation

1. Create a virtual environment:

```bash
cd realtime-server
python -m venv .venv
```

2. Activate the virtual environment:

```bash
# macOS/Linux:
source .venv/bin/activate

# Windows:
.venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

## Running the Server

Start the server with:

```bash
uvicorn main:app --host 127.0.0.1 --port 8717
```

The server will:
- Download the Whisper large-v3-turbo model on first run (if not already cached)
- Listen for WebSocket connections on `ws://127.0.0.1:8717/ws`

## Configuration

Edit `main.py` to configure:

- `MODEL_ID`: Change between `"large-v3-turbo"` or use pre-quantized `"cstr/whisper-large-v3-turbo-int8_float32"`
- `DEVICE`: Set to `"cuda"` or `"cpu"`
- `COMPUTE_TYPE`: Quantization type (default: `"int8_float32"`)
- `PARTIAL_EVERY_MS`: How often to emit partial results (default: 500ms)
- `WINDOW_SECONDS`: Sliding window size for partial decoding (default: 6.0s)

## WebSocket Protocol

### Client to Server

1. **Config message (optional, sent first):**
```json
{
  "language": "en",
  "task": "transcribe",
  "beam_size": 1
}
```

2. **Audio data:** Binary messages containing int16 PCM audio at 16kHz, mono

3. **Stop message:**
```json
{
  "type": "stop"
}
```

### Server to Client

1. **Partial transcription:**
```json
{
  "type": "partial",
  "text": "Hello world..."
}
```

2. **Final transcription:**
```json
{
  "type": "final",
  "text": "Hello world, this is the complete transcription."
}
```

## Model Information

- **Model:** Whisper large-v3-turbo
- **Source:** OpenAI Whisper (pruned version of large-v3)
- **Quantization:** int8_float32 via CTranslate2
- **Speed:** Significantly faster than large-v3 due to smaller decoder
- **Quality:** Similar to large-v3 for most use cases

## Troubleshooting

### CUDA Out of Memory

If you encounter CUDA OOM errors:
1. Reduce `WINDOW_SECONDS`
2. Use CPU instead: Set `DEVICE = "cpu"`
3. Use a smaller model: Change `MODEL_ID` to `"medium"` or `"small"`

### Model Download Issues

The model will be automatically downloaded on first run. If download fails:
1. Check your internet connection
2. Manually download from [Hugging Face](https://huggingface.co/openai/whisper-large-v3-turbo)
3. Or use the pre-quantized version: `cstr/whisper-large-v3-turbo-int8_float32`

## Development

To modify the server:
1. Edit `main.py`
2. Restart the server
3. Test with the realtime-web frontend or Handy client

## Integration

This server is designed to work with:
- **realtime-web**: Standalone web UI for testing
- **Handy**: Desktop app integration for push-to-talk transcription
