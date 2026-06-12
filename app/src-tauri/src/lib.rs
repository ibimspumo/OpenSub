mod analysis;
mod asr;
mod error;
mod ffmpeg;
mod fonts;
mod projects;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ffmpeg::FfmpegState::default())
        .manage(asr::AsrState::default())
        .manage(projects::ProjectDb::default())
        .manage(analysis::AnalysisState::default())
        .invoke_handler(tauri::generate_handler![
            // FFmpeg
            ffmpeg::video_metadata,
            ffmpeg::extract_audio,
            ffmpeg::waveform_peaks,
            ffmpeg::export_video,
            ffmpeg::cancel_export,
            ffmpeg::save_subtitle_frames,
            ffmpeg::cleanup_subtitle_frames,
            ffmpeg::delete_temp_file,
            ffmpeg::read_text_file,
            ffmpeg::write_text_file,
            // ASR (Parakeet)
            asr::transcribe,
            asr::realign_segment,
            asr::cancel_transcription,
            asr::model_status,
            asr::download_models,
            asr::cancel_model_download,
            // Projects
            projects::project_save,
            projects::project_load,
            projects::project_list,
            projects::project_delete,
            projects::project_rename,
            projects::project_thumbnail,
            // AI Analysis
            analysis::analyze_subtitles,
            analysis::gemini_word_timings,
            analysis::cancel_analysis,
            // Fonts
            fonts::list_system_fonts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
