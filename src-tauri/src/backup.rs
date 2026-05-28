use std::path::Path;
use std::fs;
use crate::db::DatabaseManager;
use crate::file_manager::FileManager;

pub struct BackupManager;

impl BackupManager {
    pub fn perform_backup(
        backup_type: &str,
        workspace_dir: &str,
        dest_dir: &str,
        db: &DatabaseManager,
    ) -> Result<String, String> {
        // Ensure workspace directories and DB are synchronized before backing up
        let _ = FileManager::scan_workspace_files(workspace_dir, db);

        let ws_root = Path::new(workspace_dir);
        if !ws_root.exists() {
            return Err("工作空间未创建，无法备份。".to_string());
        }

        if dest_dir.trim().is_empty() {
            return Err(format!(
                "未配置{}备份路径！",
                if backup_type == "disk" { "外部硬盘" } else { "云盘" }
            ));
        }

        let dest_path = Path::new(dest_dir);

        // Verify drive and prevent loop backups
        let dest_abs = dest_path.canonicalize().unwrap_or_else(|_| dest_path.to_path_buf());
        let ws_root_abs = ws_root.canonicalize().unwrap_or_else(|_| ws_root.to_path_buf());

        if dest_abs == ws_root_abs || dest_abs.starts_with(&ws_root_abs) {
            return Err("安全拦截：备份目标目录不能设定在工作空间内部，否则会导致循环套娃备份！".to_string());
        }

        // Check if drive partition is online (on Windows, check anchor root existence)
        if let Some(anchor) = dest_abs.ancestors().last() {
            if !anchor.exists() {
                return Err(format!(
                    "备份存储介质不可用，请确认对应的驱动器或盘符 '{:?}' 已正确连接并挂载！",
                    anchor
                ));
            }
        }

        fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;

        let mut copied_files_count = 0;
        let mut copied_bytes_count = 0;
        let mut backed_up_rel_paths = Vec::new();

        let records = db.search_files(None, None, None).map_err(|e| e.to_string())?;

        for record in records {
            let rel_path = &record.filepath;
            let src_file = ws_root.join(rel_path);

            if !src_file.exists() {
                continue;
            }

            let dst_file = dest_path.join(rel_path);

            let mut need_copy = false;
            if !dst_file.exists() {
                need_copy = true;
            } else {
                let src_meta = src_file.metadata().map_err(|e| e.to_string())?;
                let dst_meta = dst_file.metadata().map_err(|e| e.to_string())?;
                let src_mtime = src_meta.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();
                let dst_mtime = dst_meta.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64();

                if src_meta.len() != dst_meta.len() || (src_mtime - dst_mtime).abs() > 0.1 {
                    need_copy = true;
                }
            }

            if need_copy {
                if let Some(parent) = dst_file.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                
                fs::copy(&src_file, &dst_file).map_err(|e| e.to_string())?;

                // Keep original file modification times
                if let Ok(src_meta) = src_file.metadata() {
                    if let Ok(mtime) = src_meta.modified() {
                        let _ = filetime::set_file_mtime(&dst_file, filetime::FileTime::from_system_time(mtime));
                    }
                }

                // Verify integrity
                let src_hash = FileManager::calculate_file_hash(&src_file)?;
                let dst_hash = FileManager::calculate_file_hash(&dst_file)?;
                if src_hash != dst_hash {
                    let err_msg = format!("文件 {} 备份完整性校验失败，校验和不一致！", rel_path);
                    let _ = db.add_backup_history(backup_type, copied_files_count, copied_bytes_count, &format!("error: {}", err_msg));
                    return Err(err_msg);
                }

                copied_files_count += 1;
                copied_bytes_count += src_file.metadata().map(|m| m.len()).unwrap_or(0) as i64;
            }

            backed_up_rel_paths.push(rel_path.clone());
        }

        // Update database statuses
        db.mark_as_backed_up(backed_up_rel_paths, backup_type).map_err(|e| e.to_string())?;
        db.add_backup_history(backup_type, copied_files_count, copied_bytes_count, "success").map_err(|e| e.to_string())?;

        let size_mb = copied_bytes_count as f64 / (1024.0 * 1024.0);
        Ok(format!(
            "备份成功！同步了 {} 个文件 ({:.2} MB)。",
            copied_files_count, size_mb
        ))
    }
}
