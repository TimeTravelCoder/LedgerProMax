use std::path::{Path, PathBuf};
use std::fs;
use std::collections::{HashMap, HashSet};
use rusqlite::Result;
use crate::db::{DatabaseManager, FileRecord};
use sha2::{Sha256, Digest};
use walkdir::WalkDir;

const BANNED_KEYWORDS: &[&str] = &["最终版", "最终版2", "最新最终版", "新建文档", "新建文本文档", "新建文件夹", "最终修改版", "最最新版"];

pub struct FileManager;
/// Normalize a path by resolving  and  components lexically,
/// without touching the filesystem. This prevents path traversal attacks
/// where  segments would escape the workspace boundary.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                // pop the last normal/root component; stay at root if nothing to pop
                if components.last().map_or(false, |c| {
                    matches!(c, std::path::Component::Normal(_) | std::path::Component::RootDir)
                }) {
                    components.pop();
                }
            }
            std::path::Component::CurDir => {
                // skip
            }
            other => components.push(other),
        }
    }
    components.into_iter().collect()
}



impl FileManager {
    pub fn move_replace<P: AsRef<Path>, Q: AsRef<Path>>(
        src_path: P,
        dest_path: Q,
        replace: bool,
        workspace_dir: &str,
        db: &DatabaseManager,
    ) -> Result<PathBuf, String> {
        let src = src_path.as_ref();
        let mut dest = dest_path.as_ref().to_path_buf();
        
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        if dest.exists() {
            if replace {
                Self::delete_workspace_record(dest.as_path(), workspace_dir, db);
                if dest.is_dir() {
                    fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
                } else {
                    fs::remove_file(&dest).map_err(|e| e.to_string())?;
                }
            } else {
                let stem = dest.file_stem().unwrap_or_default().to_string_lossy().into_owned();
                let ext = dest.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
                let parent = dest.parent().unwrap();
                let mut counter = 1;
                loop {
                    let candidate_name = format!("{}_{}{}", stem, counter, ext);
                    let candidate_dest = parent.join(candidate_name);
                    if !candidate_dest.exists() {
                        dest = candidate_dest;
                        break;
                    }
                    counter += 1;
                }
            }
        }

        // Try atomic rename first; fall back to copy+delete for cross-device/cross-volume moves
        // (e.g. Desktop on C: → Workspace on E:) where fs::rename returns "cross-device link" error.
        if let Err(rename_err) = fs::rename(src, &dest) {
            use std::io::ErrorKind;
            let cross_device = rename_err.raw_os_error().map_or(false, |code| {
                // Windows: ERROR_NOT_SAME_DEVICE = 17
                // Linux/POSIX: EXDEV = 18
                code == 17 || code == 18
            }) || rename_err.kind() == ErrorKind::Other;

            if cross_device || rename_err.kind() == ErrorKind::PermissionDenied {
                fs::copy(src, &dest).map_err(|e| format!("跨卷复制失败: {}", e))?;
                fs::remove_file(src).map_err(|e| format!("源文件删除失败: {}", e))?;
            } else {
                return Err(format!("文件移动失败: {}", rename_err));
            }
        }
        Ok(dest)
    }

    fn delete_workspace_record(abs_path: &Path, workspace_dir: &str, db: &DatabaseManager) {
        if let Ok(ws_root) = Path::new(workspace_dir).canonicalize() {
            if let Ok(canonical_abs) = abs_path.canonicalize() {
                if let Ok(rel) = canonical_abs.strip_prefix(&ws_root) {
                    let rel_str = rel.to_string_lossy().replace("\\", "/");
                    let _ = db.delete_file_record(&rel_str);
                }
            }
        }
    }

    pub fn safe_workspace_path(rel_path: &str, workspace_dir: &str) -> Result<PathBuf, String> {
        let ws_root = Path::new(workspace_dir).canonicalize().map_err(|e| e.to_string())?;
        let p = Path::new(rel_path);
        let resolved = if p.is_absolute() {
            p.to_path_buf()
        } else {
            ws_root.join(rel_path)
        };

        let canonical_resolved = match resolved.canonicalize() {
            Ok(canonical) => canonical,
            Err(_) => {
                // Path doesn't exist yet. Normalize lexically to resolve .. / .
                // then verify the normalized result stays within the workspace root.
                let normalized = normalize_path(&resolved);
                if normalized == ws_root || normalized.starts_with(&ws_root) {
                    return Ok(resolved);
                }
                return Err(format!("安全边界拦截：路径 '{}' 尝试越界访问工作空间外部！", rel_path));
            }
        };

        if canonical_resolved == ws_root || canonical_resolved.starts_with(&ws_root) {
            Ok(canonical_resolved)
        } else {
            Err(format!("安全边界拦截：路径 '{}' 尝试越界访问工作空间外部！", rel_path))
        }
    }

    pub fn delete_file(rel_path: &str, workspace_dir: &str, db: &DatabaseManager) -> Result<(), String> {
        let trimmed = rel_path.trim();
        if trimmed.is_empty() || trimmed == "." || trimmed == "/" || trimmed == "\\" {
            return Err("安全边界拦截：严禁传入空路径或工作空间根目录进行删除！".to_string());
        }

        let abs_path = Self::safe_workspace_path(rel_path, workspace_dir)?;
        let ws_root = Path::new(workspace_dir).canonicalize().map_err(|e| e.to_string())?;

        if abs_path == ws_root {
            return Err("安全边界拦截：严禁删除工作区根目录本身！".to_string());
        }

        let mut is_dir = false;
        if abs_path.exists() {
            is_dir = abs_path.is_dir();
            if is_dir {
                fs::remove_dir_all(&abs_path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&abs_path).map_err(|e| e.to_string())?;
            }
        }

        if is_dir {
            db.delete_folder_records(rel_path).map_err(|e| e.to_string())?;
        } else {
            db.delete_file_record(rel_path).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn get_desktop_path() -> String {
        // Query User Shell Folders Desktop path in registry
        #[cfg(target_os = "windows")]
        {
            use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
            use winreg::RegKey;

            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            if let Ok(key) = hkcu.open_subkey_with_flags(
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                KEY_READ,
            ) {
                if let Ok(desktop_raw) = key.get_value::<String, _>("Desktop") {
                    // Expand environment variables like %USERPROFILE%
                    let mut expanded = String::new();
                    let mut chars = desktop_raw.chars().peekable();
                    while let Some(c) = chars.next() {
                        if c == '%' {
                            let mut env_var = String::new();
                            while let Some(&next_c) = chars.peek() {
                                if next_c == '%' {
                                    chars.next(); // Consume '%'
                                    break;
                                }
                                env_var.push(chars.next().unwrap());
                            }
                            if let Ok(val) = std::env::var(&env_var) {
                                expanded.push_str(&val);
                            } else {
                                expanded.push('%');
                                expanded.push_str(&env_var);
                                expanded.push('%');
                            }
                        } else {
                            expanded.push(c);
                        }
                    }
                    if Path::new(&expanded).exists() {
                        return expanded;
                    }
                }
            }
        }

        dirs::desktop_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .map(|p| p.join("Desktop").to_string_lossy().into_owned())
                    .unwrap_or_default()
            })
    }

    pub fn init_workspace(workspace_dir: &str, dirs: Vec<String>) -> Result<(), String> {
        let ws_root = Path::new(workspace_dir);
        fs::create_dir_all(ws_root).map_err(|e| e.to_string())?;
        
        let ws_root_abs = ws_root.canonicalize().map_err(|e| e.to_string())?;

        for d in dirs {
            let target_path = ws_root.join(&d);
            // Verify path traversal
            if let Ok(canonical_target) = target_path.canonicalize() {
                if !canonical_target.starts_with(&ws_root_abs) {
                    continue;
                }
            }
            fs::create_dir_all(&target_path).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn init_project_structure(project_name: &str, workspace_dir: &str, project_root_dir: &str) -> Result<(), String> {
        let ws_root = Path::new(workspace_dir);
        let proj_dir = ws_root.join(project_root_dir).join(project_name);

        let ws_root_abs = ws_root.canonicalize().map_err(|e| e.to_string())?;
        fs::create_dir_all(&proj_dir).map_err(|e| e.to_string())?;
        let proj_dir_abs = proj_dir.canonicalize().map_err(|e| e.to_string())?;
        
        if !proj_dir_abs.starts_with(&ws_root_abs) {
            return Err("安全边界拦截：项目命名超出安全范围！".to_string());
        }

        let project_subdirs = vec!["docs", "src", "data", "assets", "models", "output", "test"];
        for subd in project_subdirs {
            fs::create_dir_all(proj_dir.join(subd)).map_err(|e| e.to_string())?;
        }

        let readme_path = proj_dir.join("README.md");
        if !readme_path.exists() {
            let today = chrono::Local::now().format("%Y-%m-%d").to_string();
            let content = format!("# {}\n\n项目创建于: {}\n", project_name, today);
            fs::write(readme_path, content).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn is_banned_name(filename: &str) -> bool {
        let path = Path::new(filename);
        let stem = path.file_stem().unwrap_or_default().to_string_lossy();
        for keyword in BANNED_KEYWORDS {
            if stem.contains(keyword) {
                return true;
            }
        }
        false
    }

    #[allow(dead_code)]
    pub fn create_file(relative_path: &str, content: &str, workspace_dir: &str) -> Result<(), String> {
        let file_path = Self::safe_workspace_path(relative_path, workspace_dir)?;
        let ext = file_path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
        if ext == "docx" || ext == "xlsx" || ext == "pptx" {
            return Err("Office 复合二进制格式 (docx/xlsx/pptx) 暂不支持直接新建。请在资源管理器中正常创建后，拖入收集箱进行智能归档！".to_string());
        }

        if file_path.exists() {
            return Err(format!("文件已存在: {}", relative_path));
        }

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        fs::write(file_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn create_folder(relative_path: &str, workspace_dir: &str) -> Result<(), String> {
        let normalized_rel_path = relative_path.replace('\\', "/");
        let cleaned_rel_path = normalized_rel_path
            .split('/')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();

        if cleaned_rel_path.is_empty() {
            return Err("文件夹路径不能为空。".to_string());
        }

        let illegal_chars = ['<', '>', ':', '"', '|', '?', '*'];
        for part in &cleaned_rel_path {
            if *part == "." || *part == ".." || part.contains("..") {
                return Err("文件夹路径不能包含 . 或 .. 路径穿越片段。".to_string());
            }
            if part.chars().any(|ch| illegal_chars.contains(&ch)) {
                return Err(format!("文件夹名称 '{}' 包含 Windows 非法字符。", part));
            }
        }

        let folder_path = Self::safe_workspace_path(relative_path, workspace_dir)?;
        
        // Robust depth check: count non-empty components in relative path
        let depth = cleaned_rel_path.len();

        if depth > 4 {
            return Err(format!("目录层级深度为 {} 层，超过规范上限 4 层，无法创建！", depth));
        }

        if folder_path.exists() {
            return Err(format!("文件夹已存在: {}", relative_path));
        }

        fs::create_dir_all(folder_path).map_err(|e| e.to_string())?;
        Ok(())
    }


    pub fn scan_desktop_files() -> Vec<serde_json::Value> {
        let desktop = PathBuf::from(Self::get_desktop_path());
        if !desktop.exists() {
            return Vec::new();
        }

        let mut file_list = Vec::new();
        if let Ok(entries) = fs::read_dir(desktop) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        let path = entry.path();
                        let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                        
                        if ext != "lnk" && ext != "ini" && ext != "url" && !name.starts_with("~$") {
                            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            let mtime = entry.metadata()
                                .and_then(|m| m.modified())
                                .map(|t| {
                                    let dt: chrono::DateTime<chrono::Local> = t.into();
                                    dt.format("%Y-%m-%d %H:%M:%S").to_string()
                                })
                                .unwrap_or_default();

                            file_list.push(serde_json::json!({
                                "path": path.to_string_lossy().into_owned(),
                                "name": name,
                                "size": size,
                                "modified": mtime
                            }));
                        }
                    }
                }
            }
        }
        file_list
    }

    pub fn scan_desktop_summary() -> serde_json::Value {
        let desktop = PathBuf::from(Self::get_desktop_path());
        let mut normal_files = 0;
        let mut folders = 0;
        let mut shortcuts = 0;
        let mut temporary_files = 0;

        if desktop.exists() {
            if let Ok(entries) = fs::read_dir(desktop) {
                for entry in entries.flatten() {
                    if let Ok(ft) = entry.file_type() {
                        if ft.is_dir() {
                            folders += 1;
                        } else {
                            let name = entry.file_name().to_string_lossy().into_owned();
                            let ext = entry.path().extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                            if name.starts_with("~$") {
                                temporary_files += 1;
                            } else if ext == "lnk" || ext == "ini" || ext == "url" {
                                shortcuts += 1;
                            } else {
                                normal_files += 1;
                            }
                        }
                    }
                }
            }
        }

        serde_json::json!({
            "normal_files": normal_files,
            "folders": folders,
            "shortcuts": shortcuts,
            "temporary_files": temporary_files
        })
    }

    pub fn clean_desktop_to_inbox(workspace_dir: &str, inbox_name: &str, db: &DatabaseManager) -> Result<(i32, Vec<String>), String> {
        let desktop_files = Self::scan_desktop_files();
        let inbox_dir = Path::new(workspace_dir).join(inbox_name);
        fs::create_dir_all(&inbox_dir).map_err(|e| e.to_string())?;

        let mut moved_count = 0;
        let mut errors = Vec::new();

        for file_val in desktop_files {
            let src_path_str = file_val["path"].as_str().unwrap();
            let src = Path::new(src_path_str);
            let filename = src.file_name().unwrap();
            let dest = inbox_dir.join(filename);

            match Self::move_replace(src, &dest, false, workspace_dir, db) {
                Ok(_) => moved_count += 1,
                Err(e) => errors.push(format!("无法移动 {}: {}", src.to_string_lossy(), e)),
            }
        }

        Ok((moved_count, errors))
    }

    pub fn scan_workspace_files(workspace_dir: &str, db: &DatabaseManager) -> Result<i32, String> {
        let ws_root = Path::new(workspace_dir);
        if !ws_root.exists() {
            return Ok(0);
        }

        let ws_root_canonical = ws_root.canonicalize().map_err(|e| e.to_string())?;
        let mut disk_files = HashSet::new();
        let mut scanned_count = 0;

        for entry in WalkDir::new(&ws_root_canonical)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !name.starts_with('.') && !name.starts_with('$')
            })
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                let name = entry.file_name().to_string_lossy();
                if name.starts_with('.') || name == ".docman.db" || name == ".config.json" || name.starts_with("~$") {
                    continue;
                }

                let file_abs = entry.path();
                if let Ok(rel) = file_abs.strip_prefix(&ws_root_canonical) {
                    let rel_str = rel.to_string_lossy().replace("\\", "/");
                    disk_files.insert(rel_str.clone());

                    if let Ok(metadata) = entry.metadata() {
                        let size = metadata.len() as i64;
                        let mtime = metadata.modified()
                            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64())
                            .unwrap_or(0.0);
                        
                        let filename_owned = name.into_owned();
                        let _ = db.sync_file_metadata(&rel_str, &filename_owned, size, mtime);
                        scanned_count += 1;
                    }
                }
            }
        }

        // Clean db records for missing files
        if let Ok(records) = db.search_files(None, None, None) {
            let to_delete: Vec<String> = records.into_iter()
                .map(|r| r.filepath)
                .filter(|filepath| !disk_files.contains(filepath))
                .collect();
            if !to_delete.is_empty() {
                let _ = db.delete_file_records(to_delete);
            }
        }

        Ok(scanned_count)
    }

    pub fn organize_file(
        src_path: &str,
        dest_rel_path: &str,
        new_filename: &str,
        workspace_dir: &str,
        db: &DatabaseManager,
    ) -> Result<String, String> {
        let ws_root = Path::new(workspace_dir).canonicalize().map_err(|e| e.to_string())?;
        let src = Path::new(src_path);
        let mut dest = Self::safe_workspace_path(dest_rel_path, workspace_dir)?;

        if let (Ok(src_canon), Ok(dest_canon)) = (src.canonicalize(), dest.canonicalize()) {
            if src.exists() && dest.exists() && src_canon == dest_canon {
                if let Ok(rel) = dest.strip_prefix(&ws_root) {
                    return Ok(rel.to_string_lossy().replace("\\", "/"));
                }
            }
        }

        if Self::is_banned_name(new_filename) {
            return Err(format!("文件名 '{}' 包含禁用词！", new_filename));
        }

        let depth = dest.strip_prefix(&ws_root).map(|p| p.components().count()).unwrap_or(0);
        if depth > 4 {
            return Err(format!("保存路径的层级深度 ({}层) 超过规范最大限制 (4层)！", depth));
        }

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut final_filename = new_filename.to_string();
        if dest.exists() {
            let stem = dest.file_stem().unwrap_or_default().to_string_lossy().into_owned();
            let ext = dest.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
            let parent = dest.parent().unwrap();
            let mut counter = 1;
            loop {
                let candidate_name = format!("{}_{}{}", stem, counter, ext);
                let candidate_dest = parent.join(&candidate_name);
                if !candidate_dest.exists() {
                    dest = candidate_dest;
                    final_filename = candidate_name;
                    break;
                }
                counter += 1;
            }
        }

        let mut src_is_inside = false;
        let mut src_rel_path = None;
        let mut src_stat = None;
        if let Ok(src_canonical) = src.canonicalize() {
            if src_canonical.starts_with(&ws_root) {
                src_is_inside = true;
                src_rel_path = src_canonical.strip_prefix(&ws_root).ok().map(|p| p.to_string_lossy().replace("\\", "/"));
                if let Ok(metadata) = src_canonical.metadata() {
                    let mtime = metadata.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs_f64()).unwrap_or(0.0);
                    src_stat = Some((metadata.len() as i64, mtime));
                }
            }
        }

        // Cross-volume safe move: try rename, fall back to copy+delete
        if let Err(rename_err) = fs::rename(src, &dest) {
            let cross_device = rename_err.raw_os_error().map_or(false, |c| c == 17 || c == 18)
                || rename_err.kind() == std::io::ErrorKind::Other;
            if cross_device {
                fs::copy(src, &dest).map_err(|e| format!("跨卷复制失败: {}", e))?;
                fs::remove_file(src).map_err(|e| format!("源文件删除失败: {}", e))?;
            } else {
                return Err(format!("文件移动失败: {}", rename_err));
            }
        }

        let new_rel_path = dest.strip_prefix(&ws_root).map_err(|_| "路径解析失败".to_string())?.to_string_lossy().replace("\\", "/");

        if src_is_inside && src_rel_path.is_some() {
            let src_rel = src_rel_path.unwrap();
            if db.get_file_info(&src_rel).unwrap().is_none() && src_stat.is_some() {
                let (size, mtime) = src_stat.unwrap();
                let src_fname = src.file_name().and_then(|n| n.to_str()).unwrap_or("unknown");
                let _ = db.sync_file_metadata(&src_rel, src_fname, size, mtime);
            }
            db.rename_file_record(&src_rel, &new_rel_path, &final_filename).map_err(|e| e.to_string())?;
        } else {
            let metadata = dest.metadata().map_err(|e| e.to_string())?;
            let size = metadata.len() as i64;
            let mtime = metadata.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs_f64()).unwrap_or(0.0);
            db.sync_file_metadata(&new_rel_path, &final_filename, size, mtime).map_err(|e| e.to_string())?;
        }

        Ok(new_rel_path)
    }

    pub fn calculate_file_hash<P: AsRef<Path>>(file_path: P) -> Result<String, String> {
        let mut file = fs::File::open(file_path).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();
        std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
        Ok(format!("{:x}", hasher.finalize()))
    }

    pub fn archive_to_zip(
        workspace_dir: &str,
        filenames: Vec<String>,
        zip_name: &str,
        db: &DatabaseManager,
    ) -> Result<String, String> {
        let ws_root = Path::new(workspace_dir).canonicalize().map_err(|e| e.to_string())?;
        
        // Target category: Typically 10归档区 (or standard dirs last index)
        let archive_dir = ws_root.join("10归档区");
        let _ = fs::create_dir_all(&archive_dir);

        // Sanitize ZIP name
        let clean_zip_name = Path::new(zip_name).file_name()
            .map(|f| f.to_string_lossy().into_owned())
            .unwrap_or_else(|| "archive.zip".to_string());
            
        let dest_zip_path = archive_dir.join(&clean_zip_name);
        let temp_zip_path = dest_zip_path.with_extension("zip.tmp");

        let source_paths: Vec<(PathBuf, String)> = filenames.into_iter()
            .filter_map(|rel| {
                if let Ok(abs) = Self::safe_workspace_path(&rel, workspace_dir) {
                    if abs.exists() && abs.is_file() && abs.canonicalize().ok() != dest_zip_path.canonicalize().ok() {
                        return Some((abs, rel));
                    }
                }
                None
            })
            .collect();

        if source_paths.is_empty() {
            return Err("归档列表中没有可打包的有效文件。".to_string());
        }

        // Compress to temp file, verify, rename atomically — cleanup on failure
        let result = (|| -> Result<(), String> {
            let file = fs::File::create(&temp_zip_path).map_err(|e| e.to_string())?;
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::FileOptions::<()>::default()
                .compression_method(zip::CompressionMethod::Deflated);

            for (src_abs, rel_path) in &source_paths {
                let rel_arc = rel_path.replace("\\", "/");
                let safe_arc = rel_arc.split('/').filter(|c| *c != ".." && *c != ".").collect::<Vec<_>>().join("/");
                if safe_arc.is_empty() { continue; }
                zip.start_file(safe_arc.as_str(), options).map_err(|e| e.to_string())?;
                let mut f = fs::File::open(src_abs).map_err(|e| e.to_string())?;
                std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
            }
            zip.finish().map_err(|e| e.to_string())?;

            // Integrity verification
            let file = fs::File::open(&temp_zip_path).map_err(|e| e.to_string())?;
            let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
            for i in 0..archive.len() {
                let _file = archive.by_index(i).map_err(|e| e.to_string())?;
            }

            // Atomic replace
            fs::rename(&temp_zip_path, &dest_zip_path).map_err(|e| e.to_string())?;
            Ok(())
        })();

        if let Err(e) = result {
            let _ = fs::remove_file(&temp_zip_path);
            return Err(e);
        }

        // Delete source files physically and from DB
        let mut count = 0;
        for (src_abs, rel_path) in &source_paths {
            if let Ok(_) = fs::remove_file(src_abs) {
                let _ = db.delete_file_record(rel_path);
                count += 1;
            }
        }

        // Sync new ZIP metadata in database
        let rel_zip = format!("10归档区/{}", clean_zip_name);
        if let Ok(metadata) = dest_zip_path.metadata() {
            let size = metadata.len() as i64;
            let mtime = metadata.modified()
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64())
                .unwrap_or(0.0);
            let _ = db.sync_file_metadata(&rel_zip, &clean_zip_name, size, mtime);
            let _ = db.update_file_tags(&rel_zip, vec!["#物理备份".to_string(), "#归档区".to_string()]);
            let _ = db.update_file_description(&rel_zip, &format!("安全保险箱打包归档文件。包含 {} 个历史整理文档。", count));
        }

        Ok(clean_zip_name)
    }

    pub fn find_duplicates(
        mode: &str,
        workspace_dir: &str,
        db: &DatabaseManager,
    ) -> Result<HashMap<String, Vec<FileRecord>>, String> {
        let ws_root = Path::new(workspace_dir).canonicalize().map_err(|e| e.to_string())?;
        let records = db.search_files(None, None, None).map_err(|e| e.to_string())?;
        let mut groups: HashMap<String, Vec<FileRecord>> = HashMap::new();

        match mode {
            "filename" => {
                for r in records {
                    let key = r.filename.to_lowercase();
                    groups.entry(key).or_default().push(r);
                }
            }
            "size" => {
                for r in records {
                    if r.file_size > 0 {
                        let key = r.file_size.to_string();
                        groups.entry(key).or_default().push(r);
                    }
                }
            }
            "hash" => {
                // Group by size first to optimize hashing calls
                let mut size_groups: HashMap<i64, Vec<FileRecord>> = HashMap::new();
                for r in records {
                    if r.file_size > 0 {
                        size_groups.entry(r.file_size).or_default().push(r);
                    }
                }

                // Only hash files that share size with at least one other file
                for (_, mut list) in size_groups {
                    if list.len() > 1 {
                        for r in &mut list {
                            let abs_path = ws_root.join(&r.filepath);
                            if let Ok(hash_str) = Self::calculate_file_hash(&abs_path) {
                                groups.entry(hash_str).or_default().push(r.clone());
                            }
                        }
                    }
                }
            }
            _ => return Err(format!("未知的查重模式: {}", mode)),
        }

        // Filter groups containing duplicates
        let duplicate_groups = groups.into_iter()
            .filter(|(_, list)| list.len() > 1)
            .collect();

        Ok(duplicate_groups)
    }
}
