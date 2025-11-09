use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::managers::model::RemoteModelConfig;

#[derive(Debug, Serialize)]
struct TranscriptionRequest {
    model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    prompt: Option<String>,
    response_format: String,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct TranscriptionResponse {
    text: String,
}

/// Transcribe audio using a remote OpenAI-compatible API endpoint
pub async fn transcribe_remote(
    audio_data: Vec<f32>,
    sample_rate: u32,
    config: &RemoteModelConfig,
    language: Option<String>,
) -> Result<String> {
    // Convert f32 samples to WAV format
    let wav_data = samples_to_wav(audio_data, sample_rate)?;

    // Create the multipart form
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(wav_data)
                .file_name("audio.wav")
                .mime_str("audio/wav")?,
        )
        .text("model", config.model_name.clone())
        .text("response_format", "json")
        .text("temperature", "0.0");

    // Add language if specified
    let form = if let Some(lang) = language {
        if lang != "auto" {
            form.text("language", lang)
        } else {
            form
        }
    } else {
        form
    };

    // Build the HTTP client
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()?;

    // Build the request
    let mut request = client
        .post(&format!("{}/audio/transcriptions", config.api_url.trim_end_matches('/')))
        .multipart(form);

    // Add API key if provided
    if let Some(api_key) = &config.api_key {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    // Send the request
    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(anyhow::anyhow!(
            "Remote transcription failed with status {}: {}",
            status,
            error_text
        ));
    }

    // Parse the response
    let transcription: TranscriptionResponse = response.json().await?;

    Ok(transcription.text)
}

/// Convert f32 audio samples to WAV format bytes
fn samples_to_wav(samples: Vec<f32>, sample_rate: u32) -> Result<Vec<u8>> {
    use hound::{WavSpec, WavWriter};
    use std::io::Cursor;

    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = WavWriter::new(&mut cursor, spec)?;

        for sample in samples {
            // Convert f32 [-1.0, 1.0] to i16 range
            let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            writer.write_sample(sample_i16)?;
        }

        writer.finalize()?;
    }

    Ok(cursor.into_inner())
}
