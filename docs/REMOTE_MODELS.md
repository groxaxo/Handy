# Remote Models Configuration

Handy now supports remote OpenAI-compatible API endpoints for speech-to-text transcription. This allows you to use any OpenAI-compatible API service instead of or alongside local Whisper/Parakeet models.

## Features

- Add multiple remote API endpoints
- Support for OpenAI-compatible APIs (OpenAI, Azure OpenAI, LocalAI, etc.)
- Secure API key storage
- Seamless integration with existing model selection
- Persistent configuration across app restarts

## How to Add a Remote Model

1. Open Handy Settings
2. Navigate to the "Advanced" tab
3. Scroll to the "Remote Models" section
4. Click "Add Remote Model"
5. Fill in the form:
   - **Model ID**: A unique identifier (e.g., `my-openai-api`)
   - **Display Name**: User-friendly name (e.g., `OpenAI Whisper`)
   - **Description**: Brief description of the model
   - **API URL**: Base URL of the API endpoint (e.g., `https://api.openai.com/v1`)
   - **API Key**: Your API key (optional for some self-hosted solutions)
   - **Model Name**: The model identifier (e.g., `whisper-1` for OpenAI)
6. Click "Add" to save

## Supported API Endpoints

### OpenAI
- **API URL**: `https://api.openai.com/v1`
- **Model Name**: `whisper-1`
- **API Key**: Required (get from https://platform.openai.com/api-keys)

### Azure OpenAI
- **API URL**: `https://<your-resource>.openai.azure.com/openai/deployments/<deployment-name>`
- **Model Name**: Your deployment name
- **API Key**: Required (get from Azure portal)

### LocalAI (Self-hosted)
- **API URL**: `http://localhost:8080/v1` (or your LocalAI server URL)
- **Model Name**: Name of your loaded Whisper model
- **API Key**: Optional (depends on your configuration)

### Other Compatible APIs
Any service that implements the OpenAI Whisper API specification should work.

## Using a Remote Model

1. After adding a remote model, it will appear in the model selector on the main screen
2. Select the remote model like any other model
3. The remote model is always "available" (no download required)
4. When recording, audio will be sent to the configured API endpoint for transcription

## Configuration Details

### API Request Format
Remote models use the standard OpenAI Whisper API format:
- **Endpoint**: `POST {API_URL}/audio/transcriptions`
- **Method**: Multipart form data
- **Fields**:
  - `file`: Audio file (WAV format, 16kHz, mono)
  - `model`: Model name from configuration
  - `language`: Selected language (if not "auto")
  - `response_format`: `json`
  - `temperature`: `0.0`

### Security Notes
- API keys are stored in the Tauri secure store
- Keys are never logged or exposed in the UI after entry
- Use HTTPS endpoints when possible to protect API keys in transit
- Consider using environment-specific API keys for testing

## Troubleshooting

### "Remote transcription failed" Error
- Verify the API URL is correct and accessible
- Check that your API key is valid
- Ensure the model name matches an available model on the endpoint
- Check your network connection and firewall settings

### Slow Transcription
- Remote transcription speed depends on:
  - Network latency
  - API server response time
  - Audio file size
- Consider using local models for better performance if needed

### API Key Issues
- Make sure there are no extra spaces in the API key
- Verify the key has the correct permissions
- Check if the key is expired or has reached usage limits

## Removing a Remote Model

1. Go to Settings > Advanced > Remote Models
2. Find the model you want to remove
3. Click the "Remove" button next to it
4. The model will be removed from your configuration and model selector

## Examples

### Example: OpenAI Whisper
```
Model ID: openai-whisper
Display Name: OpenAI Whisper
Description: Official OpenAI Whisper API
API URL: https://api.openai.com/v1
API Key: sk-proj-...
Model Name: whisper-1
```

### Example: Self-hosted LocalAI
```
Model ID: local-whisper
Display Name: Local Whisper
Description: Self-hosted Whisper via LocalAI
API URL: http://localhost:8080/v1
API Key: (leave empty if not configured)
Model Name: whisper-base
```

## Benefits of Remote Models

- **No local storage**: No need to download large model files
- **Latest models**: Always use the most recent model versions
- **Flexibility**: Switch between different services easily
- **Reduced memory**: No GPU/CPU load on your machine
- **Multi-language**: Access to models fine-tuned for specific languages

## Considerations

- **Internet required**: Remote models need an active internet connection
- **API costs**: Some services charge per API call
- **Privacy**: Audio data is sent to external servers
- **Latency**: Network delays can affect transcription speed
- **Availability**: Dependent on the API service uptime
