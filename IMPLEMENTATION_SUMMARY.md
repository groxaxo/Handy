# Remote OpenAI API Implementation Summary

This document provides a technical summary of the implementation for remote OpenAI-compatible API endpoint support in Handy.

## Overview

This implementation adds the ability to use remote OpenAI-compatible transcription APIs alongside local Whisper/Parakeet models, providing users with flexibility to choose between local processing and cloud-based transcription.

## Architecture Changes

### Backend (Rust)

#### 1. Model Configuration (`src-tauri/src/managers/model.rs`)

**New Types:**

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RemoteModelConfig {
    pub api_url: String,
    pub api_key: Option<String>,
    pub model_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EngineType {
    Whisper,
    Parakeet,
    RemoteWhisper,  // New variant
}
```

**ModelInfo Updates:**

- Added `remote_config: Option<RemoteModelConfig>` field
- All existing models updated to include `remote_config: None`

**New Methods:**

- `add_remote_model()`: Adds a remote model configuration and persists to settings
- `remove_remote_model()`: Removes a remote model configuration
- `load_remote_models_from_settings()`: Loads remote models on app startup

#### 2. Remote Transcription (`src-tauri/src/managers/remote_transcription.rs`)

**New Module:** Handles communication with OpenAI-compatible APIs

**Key Function:**

```rust
pub async fn transcribe_remote(
    audio_data: Vec<f32>,
    sample_rate: u32,
    config: &RemoteModelConfig,
    language: Option<String>,
) -> Result<String>
```

**Features:**

- Converts f32 samples to WAV format
- Sends multipart/form-data request to API endpoint
- Handles authentication via Bearer token
- Returns transcribed text

#### 3. Transcription Manager (`src-tauri/src/managers/transcription.rs`)

**LoadedEngine Updates:**

```rust
enum LoadedEngine {
    Whisper(WhisperEngine),
    Parakeet(ParakeetEngine),
    RemoteWhisper,  // New variant (stateless)
}
```

**Key Changes:**

- `load_model()`: Updated to handle `RemoteWhisper` type
- `unload_model()`: Updated to skip cleanup for remote models
- `transcribe()`: Added async runtime for remote transcription
- Remote models don't require traditional "loading" - they're always available

#### 4. Settings (`src-tauri/src/settings.rs`)

**New Types:**

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RemoteModelInfo {
    pub name: String,
    pub description: String,
    pub config: RemoteModelConfig,
}
```

**AppSettings Updates:**

- Added `remote_models: HashMap<String, RemoteModelInfo>` field

#### 5. Commands (`src-tauri/src/commands/models.rs`)

**New Commands:**

- `add_remote_model`: Adds a new remote model configuration
- `remove_remote_model`: Removes an existing remote model

**Updated Commands:**

- `set_active_model`: Modified to handle remote models (no download check)

### Frontend (TypeScript/React)

#### 1. Type Definitions (`src/lib/types.ts`)

**New Schemas:**

```typescript
export const RemoteModelConfigSchema = z.object({
  api_url: z.string(),
  api_key: z.string().optional(),
  model_name: z.string(),
});

export const EngineTypeSchema = z.enum([
  "Whisper",
  "Parakeet",
  "RemoteWhisper",
]);

export const RemoteModelInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
  config: RemoteModelConfigSchema,
});
```

**Updated Schemas:**

- `ModelInfoSchema`: Added `engine_type` and `remote_config` fields
- `SettingsSchema`: Added `remote_models` field

#### 2. UI Component (`src/components/settings/RemoteModels.tsx`)

**Features:**

- Form for adding new remote models
- List view of configured remote models
- Remove functionality
- Input validation
- Error handling

**Form Fields:**

- Model ID (unique identifier)
- Display Name
- Description
- API URL
- API Key (password field)
- Model Name

#### 3. Integration (`src/components/settings/AdvancedSettings.tsx`)

- Added `<RemoteModels />` component to Advanced Settings tab

## Data Flow

### Adding a Remote Model

1. User fills out form in UI
2. Frontend calls `add_remote_model` Tauri command
3. Backend creates `ModelInfo` with `RemoteWhisper` engine type
4. Configuration saved to in-memory model list
5. Configuration persisted to settings store
6. Model appears in model selector

### Using a Remote Model

1. User selects remote model from model selector
2. `load_model()` called with remote model ID
3. Manager validates remote config exists
4. Sets engine to `LoadedEngine::RemoteWhisper`
5. When user records audio:
   - Audio captured as usual
   - VAD filters silence
   - Audio sent to `transcribe()` method
   - Remote transcription function called via async runtime
   - Audio converted to WAV format
   - Multipart request sent to API endpoint
   - Response parsed and returned
   - Text pasted to active application

## Security Considerations

1. **API Key Storage**: Keys stored in Tauri settings (encrypted store)
2. **UI Masking**: API key input uses password field
3. **HTTPS**: Documentation encourages HTTPS endpoints
4. **No Logging**: API keys never logged or exposed

## Error Handling

- Network errors: Caught and returned to user
- Invalid API responses: Proper error messages
- Missing configuration: Validated before transcription
- Form validation: Required fields enforced

## Testing Recommendations

1. **Local Testing**:
   - Set up LocalAI or similar OpenAI-compatible server
   - Test with http://localhost endpoint

2. **OpenAI Testing**:
   - Use OpenAI API with valid key
   - Test with various audio inputs

3. **Error Cases**:
   - Invalid API URL
   - Invalid API key
   - Network timeout
   - Malformed responses

## Future Enhancements

Potential improvements for future iterations:

1. **Custom Headers**: Allow users to add custom HTTP headers
2. **Retry Logic**: Automatic retry on transient failures
3. **Response Streaming**: Support for streaming transcription
4. **Multiple Providers**: Quick-add buttons for popular providers
5. **Model Testing**: Test API connection before saving
6. **Usage Tracking**: Track API usage/costs per model
7. **Offline Detection**: Automatically switch to local model if remote fails
8. **Batch Processing**: Support for processing multiple audio files

## Dependencies

**New Rust Dependencies:**

- Uses existing `reqwest` for HTTP requests
- Uses existing `hound` for WAV conversion
- Uses existing `tokio` for async runtime

**No New Frontend Dependencies Required**

## Files Modified

### Backend

- `src-tauri/src/managers/model.rs` - Model configuration
- `src-tauri/src/managers/transcription.rs` - Transcription logic
- `src-tauri/src/managers/remote_transcription.rs` - New file
- `src-tauri/src/managers/mod.rs` - Module exports
- `src-tauri/src/settings.rs` - Settings schema
- `src-tauri/src/commands/models.rs` - Tauri commands
- `src-tauri/src/lib.rs` - Command registration

### Frontend

- `src/lib/types.ts` - Type definitions
- `src/components/settings/RemoteModels.tsx` - New file
- `src/components/settings/AdvancedSettings.tsx` - Component integration

### Documentation

- `docs/REMOTE_MODELS.md` - New file
- `README.md` - Updated overview

## Compatibility

- **Rust**: Compatible with existing Rust 1.91+ toolchain
- **TypeScript**: Compatible with existing TypeScript setup
- **APIs**: Works with any OpenAI Whisper-compatible endpoint
- **Platforms**: Cross-platform (Windows, macOS, Linux)

## Performance Considerations

- **Network Latency**: Remote transcription depends on internet speed
- **No Local Resources**: Remote models don't use GPU/CPU for inference
- **Memory**: Minimal memory footprint (no model loading)
- **Concurrent**: Single transcription at a time (matches existing behavior)

## Backward Compatibility

- Existing local models continue to work unchanged
- Settings migration handles missing `remote_models` field
- No breaking changes to existing functionality
- Remote models are optional feature
