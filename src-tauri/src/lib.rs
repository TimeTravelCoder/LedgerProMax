mod db;
mod file_manager;
mod backup;
mod semantic;
mod watcher;
mod config_manager;

use std::collections::HashMap;
use std::path::Path;
use std::fs;
use std::io::Write;
use tauri::{AppHandle, State};
use db::{DatabaseManager, FileRecord, BackupHistoryRecord};
use file_manager::FileManager;
use backup::BackupManager;


pub struct WatcherState {
    pub manager: watcher::WatcherManager,
}

#[tauri::command]
fn init_workspace(workspace_dir: String, dirs: Vec<String>) -> Result<(), String> {
    FileManager::init_workspace(&workspace_dir, dirs)
}

#[tauri::command]
fn init_project(project_name: String, workspace_dir: String, standard_dirs: Vec<String>) -> Result<(), String> {
    FileManager::init_project_structure(&project_name, &workspace_dir, standard_dirs)
}

#[tauri::command]
fn create_folder(relative_path: String, workspace_dir: String) -> Result<(), String> {
    FileManager::create_folder(&relative_path, &workspace_dir)
}


#[tauri::command]
fn scan_workspace(workspace_dir: String) -> Result<i32, String> {
    let db = DatabaseManager::new(&workspace_dir);
    FileManager::scan_workspace_files(&workspace_dir, &db)
}

#[tauri::command]
fn search_files(
    workspace_dir: String,
    query: Option<String>,
    selected_tags: Option<Vec<String>>,
    file_status: Option<String>,
) -> Result<Vec<FileRecord>, String> {
    let db = DatabaseManager::new(&workspace_dir);
    db.search_files(query, selected_tags, file_status).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_file_tags(workspace_dir: String, filepath: String, tags: Vec<String>) -> Result<(), String> {
    let db = DatabaseManager::new(&workspace_dir);
    db.update_file_tags(&filepath, tags).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_file_description(workspace_dir: String, filepath: String, description: String) -> Result<(), String> {
    let db = DatabaseManager::new(&workspace_dir);
    db.update_file_description(&filepath, &description).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file(workspace_dir: String, filepath: String) -> Result<(), String> {
    let db = DatabaseManager::new(&workspace_dir);
    FileManager::delete_file(&filepath, &workspace_dir, &db)
}

#[tauri::command]
fn rename_file(workspace_dir: String, old_filepath: String, new_filepath: String, new_filename: String) -> Result<(), String> {
    let db = DatabaseManager::new(&workspace_dir);
    
    // 1. Resolve absolute paths inside workspace sandbox
    let old_abs_path = FileManager::safe_workspace_path(&old_filepath, &workspace_dir)?;
    let new_abs_path = FileManager::safe_workspace_path(&new_filepath, &workspace_dir)?;
    
    // 2. Ensure target parent directory exists
    if let Some(parent) = new_abs_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建目标父目录: {}", e))?;
        }
    }
    
    // 3. Perform physical rename with security and conflict checks
    if old_abs_path.exists() {
        if new_abs_path.exists() {
            // Support case-only renames (e.g. file.txt -> File.txt).
            // On case-insensitive filesystems (Windows NTFS, macOS APFS default),
            // fs::rename may appear to succeed but not actually change the case
            // on disk. We force a three-step rename (temp file) to ensure the
            // filesystem updates the casing of the entry correctly.
            let is_case_change = old_abs_path.to_string_lossy().to_lowercase() == new_abs_path.to_string_lossy().to_lowercase();
            if !is_case_change {
                return Err("目标文件名已存在！".to_string());
            } else {
                let temp_ext = format!("case_temp_{}", chrono::Utc::now().timestamp_millis());
                let temp_path = old_abs_path.with_extension(&temp_ext);
                fs::rename(&old_abs_path, &temp_path).map_err(|e| format!("物理文件临时命名失败: {}", e))?;
                fs::rename(&temp_path, &new_abs_path).map_err(|e| {
                    let _ = fs::rename(&temp_path, &old_abs_path); // Attempt rollback
                    format!("物理文件重命名失败: {}", e)
                })?;
            }
        } else {
            fs::rename(&old_abs_path, &new_abs_path).map_err(|e| format!("物理文件重命名失败: {}", e))?;
        }
    } else {
        return Err(format!("源文件不存在: {}", old_filepath));
    }
    
    // 4. Keep database records in sync
    db.rename_file_record(&old_filepath, &new_filepath, &new_filename).map_err(|e| e.to_string())
}

#[tauri::command]
fn organize_file(
    workspace_dir: String,
    src_path: String,
    dest_rel_path: String,
    new_filename: String,
) -> Result<String, String> {
    let db = DatabaseManager::new(&workspace_dir);
    FileManager::organize_file(&src_path, &dest_rel_path, &new_filename, &workspace_dir, &db)
}

#[tauri::command]
fn get_desktop_summary() -> serde_json::Value {
    FileManager::scan_desktop_summary()
}

#[tauri::command]
fn get_desktop_files() -> Vec<serde_json::Value> {
    FileManager::scan_desktop_files()
}

#[tauri::command]
fn clean_desktop(workspace_dir: String, inbox_name: String) -> Result<(i32, Vec<String>), String> {
    let db = DatabaseManager::new(&workspace_dir);
    FileManager::clean_desktop_to_inbox(&workspace_dir, &inbox_name, &db)
}

#[tauri::command]
fn get_tag_distribution(workspace_dir: String) -> Result<HashMap<String, i32>, String> {
    let db = DatabaseManager::new(&workspace_dir);
    db.get_tag_distribution().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_recent_files(workspace_dir: String, days: i64) -> Result<Vec<FileRecord>, String> {
    let db = DatabaseManager::new(&workspace_dir);
    db.get_recent_files(days).map_err(|e| e.to_string())
}

#[tauri::command]
fn recommend_tags(filename: String, remark: String, active_tags: Vec<String>, top_k: usize) -> Vec<String> {
    semantic::recommend_tags(&filename, &remark, active_tags, top_k)
}

#[tauri::command]
fn perform_backup(backup_type: String, workspace_dir: String, dest_dir: String) -> Result<String, String> {
    let db = DatabaseManager::new(&workspace_dir);
    BackupManager::perform_backup(&backup_type, &workspace_dir, &dest_dir, &db)
}

#[tauri::command]
fn get_backup_history(workspace_dir: String, limit: i32) -> Result<Vec<BackupHistoryRecord>, String> {
    let db = DatabaseManager::new(&workspace_dir);
    db.get_backup_history(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_watching(paths: Vec<String>, state: State<'_, WatcherState>, app_handle: AppHandle) -> Result<(), String> {
    state.manager.start_watching(paths, app_handle)
}

#[tauri::command]
fn stop_watching(state: State<'_, WatcherState>) -> Result<(), String> {
    state.manager.stop_watching()
}

#[tauri::command]
fn suggest_rule_target(filename: String, auto_rules: Vec<serde_json::Value>, standard_dirs: Vec<String>) -> Option<(String, String)> {
    let lower_name = filename.to_lowercase();
    let ext = Path::new(&filename).extension().map(|e| format!(".{}", e.to_string_lossy().to_lowercase())).unwrap_or_default();

    for rule_val in auto_rules {
        if rule_val.get("enabled").and_then(|v| v.as_bool()) == Some(false) {
            continue;
        }
        let rule_name = rule_val["name"].as_str().unwrap_or_default().to_string();
        let prefix = rule_val["target_prefix"].as_str().unwrap_or_default();
        let extensions: Vec<String> = rule_val["extensions"].as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|v| v.as_str().unwrap_or_default().to_lowercase())
            .collect();
        let keywords: Vec<String> = rule_val["keywords"].as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|v| v.as_str().unwrap_or_default().to_lowercase())
            .collect();

        if extensions.contains(&ext) || keywords.iter().any(|kw| lower_name.contains(kw)) {
            for directory in &standard_dirs {
                if directory.starts_with(prefix) {
                    return Some((rule_name, directory.clone()));
                }
            }
        }
    }
    None
}

#[tauri::command]
fn load_config() -> config_manager::AppConfig {
    config_manager::ConfigManager::load_config()
}

#[tauri::command]
fn save_config(config: config_manager::AppConfig) -> Result<(), String> {
    config_manager::ConfigManager::save_config(&config)
}

#[derive(serde::Serialize)]
struct PathValidation {
    exists: bool,
    is_dir: bool,
    writable: bool,
    message: String,
}

#[tauri::command]
fn validate_path(path: String, should_exist: bool, require_writable: bool) -> PathValidation {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return PathValidation {
            exists: false,
            is_dir: false,
            writable: false,
            message: "路径为空".to_string(),
        };
    }

    let path_ref = Path::new(trimmed);
    let exists = path_ref.exists();
    let is_dir = path_ref.is_dir();

    if should_exist && !exists {
        return PathValidation {
            exists,
            is_dir,
            writable: false,
            message: "路径不存在，请检查拼写或先创建目录".to_string(),
        };
    }

    if exists && !is_dir {
        return PathValidation {
            exists,
            is_dir,
            writable: false,
            message: "该路径不是文件夹".to_string(),
        };
    }

    let writable = if require_writable && exists && is_dir {
        let probe = path_ref.join(".ledger_write_probe.tmp");
        match fs::File::create(&probe).and_then(|mut file| file.write_all(b"ok")) {
            Ok(_) => {
                let _ = fs::remove_file(probe);
                true
            }
            Err(_) => false,
        }
    } else {
        !require_writable || !exists
    };

    let message = if require_writable && exists && is_dir && !writable {
        "目录存在，但当前没有写入权限".to_string()
    } else if exists && is_dir {
        "路径可用".to_string()
    } else {
        "路径尚未创建，保存后初始化流程会尝试创建".to_string()
    };

    PathValidation {
        exists,
        is_dir,
        writable,
        message,
    }
}

#[tauri::command]
fn read_file_content(workspace_dir: String, filepath: String) -> Result<String, String> {
    let abs_path = FileManager::safe_workspace_path(&filepath, &workspace_dir)?;
    if !abs_path.exists() {
        return Err("文件不存在。".to_string());
    }
    if !abs_path.is_file() {
        return Err("所选路径不是一个文件。".to_string());
    }

    use std::io::Read;
    let file = fs::File::open(&abs_path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    let mut handle = file.take(102400); // 限制最大读取 100KB
    handle.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    // 优先尝试 UTF-8 解码
    if let Ok(utf8_str) = String::from_utf8(buffer.clone()) {
        Ok(utf8_str)
    } else {
        // 如果失败，回退到常见的 GBK 解码（主要针对从 Windows 复制的中文文件，
        // 在 macOS/Linux 上几乎不会触发，因为这两个系统原生使用 UTF-8）
        let (decoded, _, _) = encoding_rs::GBK.decode(&buffer);
        Ok(decoded.into_owned())
    }
}

#[tauri::command]
fn archive_to_zip(workspace_dir: String, filenames: Vec<String>, zip_name: String) -> Result<String, String> {
    let db = DatabaseManager::new(&workspace_dir);
    FileManager::archive_to_zip(&workspace_dir, filenames, &zip_name, &db)
}

#[tauri::command]
fn find_duplicates(mode: String, workspace_dir: String) -> Result<HashMap<String, Vec<FileRecord>>, String> {
    let db = DatabaseManager::new(&workspace_dir);
    FileManager::find_duplicates(&mode, &workspace_dir, &db)
}

#[tauri::command]
fn open_in_system(workspace_dir: String, filepath: String) -> Result<(), String> {
    let abs_path = FileManager::safe_workspace_path(&filepath, &workspace_dir)?;
    if !abs_path.exists() {
        return Err("文件不存在。".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(&abs_path)
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(opener)
            .arg(&abs_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

lazy_static::lazy_static! {
    static ref DOCX_TEXT_RE: regex::Regex = regex::Regex::new(r"<w:t[^>]*>([^<]*)</w:t>").unwrap();
}

#[tauri::command]
fn read_docx_text(workspace_dir: String, filepath: String) -> Result<String, String> {
    let abs_path = FileManager::safe_workspace_path(&filepath, &workspace_dir)?;
    if !abs_path.exists() {
        return Err("文件不存在。".to_string());
    }

    let file = fs::File::open(&abs_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|_| "无法解析 .docx 文件，该文件可能已损坏。".to_string())?;

    let doc_xml = archive.by_name("word/document.xml").map_err(|_| "不是有效的 .docx 文件，缺少 word/document.xml。".to_string())?;
    use std::io::Read;
    let xml_text = {
        let mut reader = std::io::BufReader::new(doc_xml);
        let mut buf = String::new();
        reader.read_to_string(&mut buf).map_err(|e| e.to_string())?;
        buf
    };

    // Extract text from <w:t> elements using cached regex
    let mut paragraphs = Vec::new();

    // Split by paragraph markers to preserve paragraph breaks
    for part in xml_text.split("</w:p>") {
        let mut para_text = String::new();
        for cap in DOCX_TEXT_RE.captures_iter(part) {
            if let Some(text) = cap.get(1) {
                para_text.push_str(text.as_str());
            }
        }
        if !para_text.trim().is_empty() {
            paragraphs.push(para_text.trim().to_string());
        }
    }

    if paragraphs.is_empty() {
        Ok("(文档无文本内容)".to_string())
    } else {
        Ok(paragraphs.join("\n\n"))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState {
            manager: watcher::WatcherManager::new(),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_workspace,
            init_project,
            create_folder,
            scan_workspace,
            search_files,
            update_file_tags,
            update_file_description,
            delete_file,
            rename_file,
            organize_file,
            get_desktop_summary,
            get_desktop_files,
            clean_desktop,
            get_tag_distribution,
            get_recent_files,
            recommend_tags,
            perform_backup,
            get_backup_history,
            start_watching,
            stop_watching,
            suggest_rule_target,
            load_config,
            save_config,
            validate_path,
            read_file_content,
            archive_to_zip,
            find_duplicates,
            open_in_system,
            read_docx_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
