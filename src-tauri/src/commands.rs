use std::path::PathBuf;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::picture::PictureType;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

use crate::{Song, ScanResult, scan_directory, read_audio_metadata};

/// Klasör tara ve tüm müzik dosyalarını döndür
#[tauri::command]
pub async fn scan_music_folder(path: String) -> Result<ScanResult, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("Folder not found".to_string());
    }
    if !path.is_dir() {
        return Err("Path is not a folder".to_string());
    }

    Ok(scan_directory(&path))
}

/// Birden fazla dosyayı tara
#[tauri::command]
pub async fn scan_music_files(paths: Vec<String>) -> Result<ScanResult, String> {
    let mut songs = Vec::new();
    let mut errors = Vec::new();

    for path_str in paths {
        let path = PathBuf::from(&path_str);
        if path.is_file() && crate::is_audio_file(&path) {
            match read_audio_metadata(&path) {
                Ok(song) => songs.push(song),
                Err(e) => errors.push(format!("{}: {}", path.display(), e)),
            }
        }
    }

    Ok(ScanResult { songs, errors })
}

/// Tek bir dosyanın metadata'sını al
#[tauri::command]
pub async fn get_audio_metadata(path: String) -> Result<Song, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("File not found".to_string());
    }
    read_audio_metadata(&path)
}

/// Bir audio dosyasından kapak resmini çıkar (base64 olarak)
#[tauri::command]
pub async fn get_cover_art(path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let tagged_file = Probe::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?
        .read()
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

    if let Some(tag) = tag {
        // Önce front cover'ı ara
        if let Some(picture) = tag.pictures().iter().find(|p| p.pic_type() == PictureType::CoverFront) {
            let mime = picture.mime_type().map(|m| m.as_str()).unwrap_or("image/jpeg");
            let base64_data = BASE64.encode(picture.data());
            return Ok(Some(format!("data:{};base64,{}", mime, base64_data)));
        }
        // Herhangi bir resim varsa onu kullan
        if let Some(picture) = tag.pictures().first() {
            let mime = picture.mime_type().map(|m| m.as_str()).unwrap_or("image/jpeg");
            let base64_data = BASE64.encode(picture.data());
            return Ok(Some(format!("data:{};base64,{}", mime, base64_data)));
        }
    }

    Ok(None)
}
