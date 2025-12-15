# Handy Voice Chat - Cloudflare Pages Deployment

## Quick Deploy to Cloudflare Pages

### Option 1: Direct Upload (Recommended)

1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/pages)
2. Click "Create a project" 
3. Select "Upload assets"
4. Upload the contents of `/home/op/handy/realtime-web/dist/` folder
5. Your site will be deployed immediately

### Option 2: Git Repository

1. Push the `/home/op/handy/realtime-web` folder to a GitHub/GitLab repository
2. In Cloudflare Pages, connect your repository
3. Set build command: `npm run build`
4. Set output directory: `dist`

## Important Configuration

### WebSocket URL Update
After deployment, you'll need to update the WebSocket URL in the deployed site:

1. Go to your deployed Cloudflare Pages site
2. Open browser dev tools (F12)
3. Run in console:
   ```javascript
   // Update this to your ngrok URL
   localStorage.setItem('wsUrl', 'wss://YOUR_NGROK_URL/ws');
   location.reload();
   ```

### Alternative: Add URL Parameter
You can also add the WebSocket URL as a URL parameter:
```
https://your-site.pages.dev/?ws=wss://948874391e98.ngrok-free.app/ws
```

## Features

✅ **Retro 2000s Messenger Interface** - Three themes: Classic Gray, Retro Green, Dark Mode
✅ **Automatic Voice Detection** - Real-time volume monitoring
✅ **Live Transcription** - Partial results with cursor animation
✅ **Continuous Recording** - Auto-chunking to server
✅ **Mobile Responsive** - Works on phones and tablets
✅ **Browser Compatibility** - Supports Chrome, Firefox, Safari, Edge

## Microphone Permissions

The app will request microphone access when you click "Start Recording". Make sure to:
- Allow microphone permissions when prompted
- Use HTTPS (Cloudflare provides this automatically)
- Try on a different browser if you have issues

## Current Services Running

- **WebSocket Server**: `0.0.0.0:8000` (realtime transcription)
- **Ngrok Tunnel**: `948874391e98.ngrok-free.app` (external access)

## Testing

Once deployed, test the microphone by:
1. Visiting your Cloudflare Pages URL
2. Click "Start Recording"
3. Allow microphone permissions
4. Speak clearly and watch the live transcription

The interface looks like a 2000s messenger chat with green terminal text!