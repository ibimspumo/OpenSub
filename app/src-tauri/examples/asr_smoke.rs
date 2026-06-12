//! Smoke test for the Parakeet engine outside of Tauri.
//!
//! Usage: cargo run --release --example asr_smoke -- <wav-path>
//! Expects the model in ~/Library/Application Support/de.agent-z.opensub/models/parakeet-tdt-0.6b-v3

use parakeet_rs::{ParakeetTDT, TimestampMode, Transcriber};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let wav_path = std::env::args().nth(1).expect("usage: asr_smoke <wav>");
    let model_dir = dirs_path();

    println!("Loading model from {model_dir}...");
    let load_start = std::time::Instant::now();
    let mut engine = ParakeetTDT::from_pretrained(&model_dir, None)?;
    println!("Model loaded in {:.1}s", load_start.elapsed().as_secs_f32());

    let mut reader = hound::WavReader::open(&wav_path)?;
    let spec = reader.spec();
    let samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.unwrap_or(0) as f32 / 32768.0)
        .collect();
    let audio_secs = samples.len() as f32 / spec.sample_rate as f32;
    println!("Audio: {:.1}s @ {} Hz", audio_secs, spec.sample_rate);

    let t_start = std::time::Instant::now();
    let result = engine.transcribe_samples(samples, spec.sample_rate, 1, Some(TimestampMode::Words))?;
    let elapsed = t_start.elapsed().as_secs_f32();

    println!("\nTranscription ({elapsed:.2}s, {:.1}x realtime):", audio_secs / elapsed);
    println!("TEXT: {}", result.text);
    println!("\nWord timestamps:");
    for token in &result.tokens {
        println!("  [{:6.2}s - {:6.2}s] {}", token.start, token.end, token.text.trim());
    }
    Ok(())
}

fn dirs_path() -> String {
    let home = std::env::var("HOME").unwrap();
    format!("{home}/Library/Application Support/de.agent-z.opensub/models/parakeet-tdt-0.6b-v3")
}
