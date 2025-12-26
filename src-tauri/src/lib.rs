use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use lofty::prelude::*;
use lofty::probe::Probe;
use walkdir::WalkDir;
use tauri::{Emitter, Manager};

mod commands;

pub use commands::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub path: String,
    pub cover: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub songs: Vec<Song>,
    pub errors: Vec<String>,
}

/// Desteklenen audio formatları
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"];

/// Bir dosyanın audio dosyası olup olmadığını kontrol et
pub fn is_audio_file(path: &PathBuf) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Audio dosyasından metadata oku
pub fn read_audio_metadata(path: &PathBuf) -> Result<Song, String> {
    let tagged_file = Probe::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?
        .read()
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let properties = tagged_file.properties();
    let duration = properties.duration().as_secs_f64();

    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

    let (title, artist, album) = if let Some(tag) = tag {
        (
            tag.title().map(|s| s.to_string()).unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string()
            }),
            tag.artist().map(|s| s.to_string()).unwrap_or_else(|| "Unknown Artist".to_string()),
            tag.album().map(|s| s.to_string()).unwrap_or_else(|| "Unknown Album".to_string()),
        )
    } else {
        (
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            "Unknown Artist".to_string(),
            "Unknown Album".to_string(),
        )
    };

    // Benzersiz ID oluştur (dosya yolunun hash'i)
    let id = format!("{:x}", md5_hash(path.to_string_lossy().as_bytes()));

    Ok(Song {
        id,
        title,
        artist,
        album,
        duration,
        path: path.to_string_lossy().to_string(),
        cover: None, // Cover daha sonra extract edilebilir
    })
}

/// Basit MD5 hash fonksiyonu
fn md5_hash(data: &[u8]) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    hasher.finish()
}

/// Bir klasörü tarayıp tüm audio dosyalarını bul
pub fn scan_directory(path: &PathBuf) -> ScanResult {
    let mut songs = Vec::new();
    let mut errors = Vec::new();

    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path().to_path_buf();
        if path.is_file() && is_audio_file(&path) {
            match read_audio_metadata(&path) {
                Ok(song) => songs.push(song),
                Err(e) => errors.push(format!("{}: {}", path.display(), e)),
            }
        }
    }

    ScanResult { songs, errors }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // İkinci instance açıldığında burası çalışır
            // Dosya yollarını filtrele ve mevcut pencereye gönder
            let audio_files: Vec<String> = args.iter()
                .skip(1)
                .filter(|arg| {
                    let path = std::path::Path::new(arg);
                    path.exists() && path.is_file() && path.extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                        .unwrap_or(false)
                })
                .cloned()
                .collect();
            
            if !audio_files.is_empty() {
                // Mevcut pencereye dosyaları gönder
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.emit("open-files", audio_files);
                }
            }
        }))
        .setup(|app| {
            // İlk açılışta CLI args'ı al
            let args: Vec<String> = std::env::args().collect();
            let audio_files: Vec<String> = args.iter()
                .skip(1)
                .filter(|arg| {
                    let path = std::path::Path::new(arg);
                    path.exists() && path.is_file() && path.extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                        .unwrap_or(false)
                })
                .cloned()
                .collect();
            
            // Dosyalar varsa, pencere hazır olunca gönder
            if !audio_files.is_empty() {
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Frontend'in yüklenmesi için kısa bir bekleme
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.emit("open-files", audio_files);
                    }
                });
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_music_folder,
            commands::scan_music_files,
            commands::get_audio_metadata,
            commands::get_cover_art,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
