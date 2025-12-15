# Handy Realtime Web Frontend

A React/TypeScript web application for testing the realtime STT server with live transcription.

## Features

- Browser-based microphone capture
- Real-time audio streaming via WebSocket
- Live partial transcription display
- Final transcription results
- Simple, clean UI

## Requirements

- Node.js 16+ or Bun
- Modern web browser with WebRTC support
- Running realtime-server (see `../realtime-server/README.md`)

## Installation

1. Install dependencies:

```bash
cd realtime-web
npm install
# or with Bun:
bun install
```

## Running

1. Make sure the realtime-server is running on `ws://127.0.0.1:8717/ws`

2. Start the development server:

```bash
npm run dev
# or with Bun:
bun run dev
```

3. Open your browser to the URL shown (typically `http://localhost:5173`)

## Usage

1. Click "Start" to begin recording
2. Grant microphone permissions when prompted
3. Speak into your microphone
4. Watch the "Partial" section for real-time transcription
5. Click "Stop" to finish and see the final transcription

## How It Works

1. **Audio Capture:** Uses Web Audio API to capture microphone input
2. **Resampling:** Downsamples audio from browser sample rate to 16kHz mono
3. **Format Conversion:** Converts Float32 to Int16 PCM format
4. **Streaming:** Sends audio chunks to server via WebSocket
5. **Display:** Shows partial results as they arrive, and final result when done

## Configuration

To change the server URL, edit `src/ui/App.tsx`:

```typescript
const WS_URL = "ws://127.0.0.1:8717/ws";
```

## Building for Production

```bash
npm run build
# or with Bun:
bun run build
```

The built files will be in the `dist/` directory.

## Troubleshooting

### Microphone Not Working

- Check browser permissions
- Ensure you're using HTTPS or localhost
- Try a different browser (Chrome/Edge recommended)

### No Transcription Appearing

- Verify realtime-server is running
- Check browser console for WebSocket errors
- Ensure server is accessible at `ws://127.0.0.1:8717/ws`

### Poor Audio Quality

- Check microphone input levels
- Reduce background noise
- Speak clearly and at a normal pace

## Development

The app uses:
- **React 18** for UI
- **TypeScript** for type safety
- **Vite** for fast development builds
- **Web Audio API** for audio processing

To modify the UI, edit `src/ui/App.tsx`.
