use rusqlite::{params, Connection, Result};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::Local;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileRecord {
    pub id: Option<i64>,
    pub filepath: String,
    pub filename: String,
    pub file_size: i64,
    pub modified_time: f64,
    pub tags: String,
    pub description: String,
    pub backup_disk_status: i32,
    pub backup_cloud_status: i32,
    pub last_backup_time: Option<String>,
    pub relevance_score: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupHistoryRecord {
    pub id: Option<i64>,
    pub timestamp: String,
    pub backup_type: String,
    pub files_copied: i32,
    pub bytes_copied: i64,
    pub status: String,
}

pub fn get_pinyin_char(c: char) -> char {
    if !('\u{4e00}'..='\u{9fa5}').contains(&c) {
        return c.to_ascii_lowercase();
    }

    let mut s = String::new();
    s.push(c);
    let (encoded, _, has_errors) = encoding_rs::GBK.encode(&s);
    if has_errors || encoded.len() != 2 {
        return c.to_ascii_lowercase();
    }

    let b0 = encoded[0] as u32;
    let b1 = encoded[1] as u32;
    let code = b0 * 256 + b1;

    if (45217..=45252).contains(&code) { return 'a'; }
    if (45253..=45760).contains(&code) { return 'b'; }
    if (45761..=46317).contains(&code) { return 'c'; }
    if (46318..=46825).contains(&code) { return 'd'; }
    if (46826..=47009).contains(&code) { return 'e'; }
    if (47010..=47296).contains(&code) { return 'f'; }
    if (47297..=47613).contains(&code) { return 'g'; }
    if (47614..=48118).contains(&code) { return 'h'; }
    if (48119..=49061).contains(&code) { return 'j'; }
    if (49062..=49323).contains(&code) { return 'k'; }
    if (49324..=49895).contains(&code) { return 'l'; }
    if (49896..=50370).contains(&code) { return 'm'; }
    if (50371..=50613).contains(&code) { return 'n'; }
    if (50614..=50621).contains(&code) { return 'o'; }
    if (50622..=50905).contains(&code) { return 'p'; }
    if (50906..=51386).contains(&code) { return 'q'; }
    if (51387..=51445).contains(&code) { return 'r'; }
    if (51446..=52217).contains(&code) { return 's'; }
    if (52218..=52697).contains(&code) { return 't'; }
    if (52698..=52979).contains(&code) { return 'w'; }
    if (52980..=53688).contains(&code) { return 'x'; }
    if (53689..=54480).contains(&code) { return 'y'; }
    if (54481..=55289).contains(&code) { return 'z'; }

    c.to_ascii_lowercase()
}

pub fn get_pinyin_initials(text: &str) -> String {
    text.chars().map(get_pinyin_char).collect()
}

pub struct DatabaseManager {
    db_path: PathBuf,
}

impl DatabaseManager {
    pub fn new<P: AsRef<Path>>(workspace_dir: P) -> Self {
        let db_dir = workspace_dir.as_ref();
        std::fs::create_dir_all(db_dir).unwrap_or_default();
        let db_path = db_dir.join(".docman.db");
        let manager = DatabaseManager { db_path };
        manager.init_db().unwrap_or_default();
        manager
    }

    fn get_conn(&self) -> Result<Connection> {
        let conn = Connection::open(&self.db_path)?;
        Ok(conn)
    }

    fn init_db(&self) -> Result<()> {
        let conn = self.get_conn()?;
        
        // Files table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filepath TEXT UNIQUE,
                filename TEXT,
                file_size INTEGER,
                modified_time REAL,
                tags TEXT,
                description TEXT,
                backup_disk_status INTEGER DEFAULT 0,
                backup_cloud_status INTEGER DEFAULT 0,
                last_backup_time TEXT
            )",
            [],
        )?;

        // Backup history table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS backup_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                backup_type TEXT,
                files_copied INTEGER,
                bytes_copied INTEGER,
                status TEXT
            )",
            [],
        )?;

        Ok(())
    }

    pub fn sync_file_metadata(&self, rel_path: &str, filename: &str, size: i64, mtime: f64) -> Result<()> {
        let conn = self.get_conn()?;
        
        let mut stmt = conn.prepare("SELECT id, file_size, modified_time FROM files WHERE filepath = ?")?;
        let mut rows = stmt.query(params![rel_path])?;
        
        if let Some(row) = rows.next()? {
            let db_id: i64 = row.get(0)?;
            let db_size: i64 = row.get(1)?;
            let db_mtime: f64 = row.get(2)?;
            
            if db_size != size || (db_mtime - mtime).abs() > 0.01 {
                conn.execute(
                    "UPDATE files 
                     SET file_size = ?, modified_time = ?, backup_disk_status = 0, backup_cloud_status = 0 
                     WHERE id = ?",
                    params![size, mtime, db_id],
                )?;
            }
        } else {
            conn.execute(
                "INSERT INTO files (filepath, filename, file_size, modified_time, tags, description) 
                 VALUES (?, ?, ?, ?, '', '')",
                params![rel_path, filename, size, mtime],
            )?;
        }
        
        Ok(())
    }

    pub fn update_file_tags(&self, rel_path: &str, tags: Vec<String>) -> Result<()> {
        let conn = self.get_conn()?;
        let tags_str = tags.join(",");
        conn.execute(
            "UPDATE files SET tags = ? WHERE filepath = ?",
            params![tags_str, rel_path],
        )?;
        Ok(())
    }

    pub fn update_file_description(&self, rel_path: &str, description: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE files SET description = ? WHERE filepath = ?",
            params![description, rel_path],
        )?;
        Ok(())
    }

    pub fn delete_file_record(&self, rel_path: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute("DELETE FROM files WHERE filepath = ?", params![rel_path])?;
        Ok(())
    }

    pub fn delete_file_records(&self, rel_paths: Vec<String>) -> Result<()> {
        if rel_paths.is_empty() {
            return Ok(());
        }
        let mut conn = self.get_conn()?;
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare("DELETE FROM files WHERE filepath = ?")?;
            for path in rel_paths {
                stmt.execute(params![path])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn delete_folder_records(&self, folder_rel_path: &str) -> Result<()> {
        let conn = self.get_conn()?;
        let folder_prefix = format!("{}/", folder_rel_path);
        conn.execute(
            "DELETE FROM files WHERE filepath = ? OR filepath LIKE ?",
            params![folder_rel_path, format!("{}%", folder_prefix)],
        )?;
        Ok(())
    }

    pub fn rename_file_record(&self, old_rel_path: &str, new_rel_path: &str, new_filename: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE files 
             SET filepath = ?, filename = ?, backup_disk_status = 0, backup_cloud_status = 0 
             WHERE filepath = ?",
            params![new_rel_path, new_filename, old_rel_path],
        )?;
        Ok(())
    }

    pub fn get_file_info(&self, rel_path: &str) -> Result<Option<FileRecord>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare("SELECT * FROM files WHERE filepath = ?")?;
        let mut rows = stmt.query(params![rel_path])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(FileRecord {
                id: Some(row.get(0)?),
                filepath: row.get(1)?,
                filename: row.get(2)?,
                file_size: row.get(3)?,
                modified_time: row.get(4)?,
                tags: row.get(5)?,
                description: row.get(6)?,
                backup_disk_status: row.get(7)?,
                backup_cloud_status: row.get(8)?,
                last_backup_time: row.get(9)?,
                relevance_score: None,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn search_files(&self, query: Option<String>, selected_tags: Option<Vec<String>>, file_status: Option<String>) -> Result<Vec<FileRecord>> {
        let conn = self.get_conn()?;
        
        let mut sql = "SELECT * FROM files".to_string();
        let mut params_vec: Vec<String> = Vec::new();
        let mut conditions = Vec::new();
        
        if let Some(ref tags) = selected_tags {
            for tag in tags {
                let cleaned = tag.trim();
                if !cleaned.is_empty() {
                    conditions.push("tags LIKE ?".to_string());
                    params_vec.push(format!("%{}%", cleaned));
                }
            }
        }
        
        if let Some(ref status) = file_status {
            let cleaned = status.trim();
            if !cleaned.is_empty() {
                conditions.push("tags LIKE ?".to_string());
                params_vec.push(format!("%{}%", cleaned));
            }
        }
        
        if !conditions.is_empty() {
            sql += &format!(" WHERE {}", conditions.join(" AND "));
        }
        
        let mut stmt = conn.prepare(&sql)?;
        
        // Convert dynamic parameters to rusqlite parameters
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let mut rows = stmt.query(&params_refs[..])?;
        
        let mut records = Vec::new();
        while let Some(row) = rows.next()? {
            records.push(FileRecord {
                id: Some(row.get(0)?),
                filepath: row.get(1)?,
                filename: row.get(2)?,
                file_size: row.get(3)?,
                modified_time: row.get(4)?,
                tags: row.get(5)?,
                description: row.get(6)?,
                backup_disk_status: row.get(7)?,
                backup_cloud_status: row.get(8)?,
                last_backup_time: row.get(9)?,
                relevance_score: None,
            });
        }

        // 1. Precise Tag Filtering
        if let Some(ref tags) = selected_tags {
            let norm_selected: std::collections::HashSet<String> = tags.iter()
                .filter(|t| !t.trim().is_empty())
                .map(|t| t.trim().to_lowercase().trim_start_matches('#').to_string())
                .collect();
                
            records = records.into_iter().filter(|r| {
                let file_tags: std::collections::HashSet<String> = r.tags.split(',')
                    .filter(|t| !t.trim().is_empty())
                    .map(|t| t.trim().to_lowercase().trim_start_matches('#').to_string())
                    .collect();
                norm_selected.is_subset(&file_tags)
            }).collect();
        }

        // 2. Precise Status Filtering
        if let Some(ref status) = file_status {
            let norm_status = status.trim().to_lowercase().trim_start_matches('#').to_string();
            if !norm_status.is_empty() {
                records = records.into_iter().filter(|r| {
                    let file_tags: std::collections::HashSet<String> = r.tags.split(',')
                        .filter(|t| !t.trim().is_empty())
                        .map(|t| t.trim().to_lowercase().trim_start_matches('#').to_string())
                        .collect();
                    file_tags.contains(&norm_status)
                }).collect();
            }
        }

        // 3. Pinyin initials & keyword relevance searching
        if let Some(ref q) = query {
            let keywords: Vec<String> = q.to_lowercase().split_whitespace().map(|s| s.to_string()).collect();
            if keywords.is_empty() {
                records.sort_by(|a, b| a.filepath.cmp(&b.filepath));
                return Ok(records);
            }
            
            let mut matched_records = Vec::new();
            for mut r in records {
                let filename_lower = r.filename.to_lowercase();
                let filepath_lower = r.filepath.to_lowercase();
                let desc_lower = r.description.to_lowercase();
                let tags_lower = r.tags.to_lowercase();
                let initials = get_pinyin_initials(&r.filename);
                
                let mut record_matches_all = true;
                let mut total_score = 0;
                
                for kw in &keywords {
                    let mut kw_matches = false;
                    let mut kw_relevance = 0;
                    
                    if filename_lower.contains(kw) {
                        kw_matches = true;
                        if filename_lower == *kw {
                            kw_relevance = kw_relevance.max(100);
                        } else if filename_lower.starts_with(kw) {
                            kw_relevance = kw_relevance.max(80);
                        } else {
                            kw_relevance = kw_relevance.max(50);
                        }
                    }
                    
                    if !initials.is_empty() && initials.contains(kw) {
                        kw_matches = true;
                        if initials == *kw {
                            kw_relevance = kw_relevance.max(45);
                        } else if initials.starts_with(kw) {
                            kw_relevance = kw_relevance.max(42);
                        } else {
                            kw_relevance = kw_relevance.max(40);
                        }
                    }
                    
                    if filepath_lower.contains(kw) {
                        kw_matches = true;
                        kw_relevance = kw_relevance.max(30);
                    }
                    
                    if desc_lower.contains(kw) {
                        kw_matches = true;
                        kw_relevance = kw_relevance.max(20);
                    }
                    
                    if tags_lower.contains(kw) {
                        kw_matches = true;
                        kw_relevance = kw_relevance.max(15);
                    }
                    
                    if !kw_matches {
                        record_matches_all = false;
                        break;
                    } else {
                        total_score += kw_relevance;
                    }
                }
                
                if record_matches_all {
                    r.relevance_score = Some(total_score);
                    matched_records.push(r);
                }
            }
            
            // Sort by relevance score descending, then by filepath alphabetically
            matched_records.sort_by(|a, b| {
                let score_a = a.relevance_score.unwrap_or(0);
                let score_b = b.relevance_score.unwrap_or(0);
                if score_a != score_b {
                    score_b.cmp(&score_a) // Descending
                } else {
                    a.filepath.cmp(&b.filepath) // Ascending
                }
            });
            
            Ok(matched_records)
        } else {
            // No text search, sort alphabetically
            records.sort_by(|a, b| a.filepath.cmp(&b.filepath));
            Ok(records)
        }
    }

    pub fn get_recent_files(&self, days: i64) -> Result<Vec<FileRecord>> {
        let conn = self.get_conn()?;
        let cutoff = (chrono::Utc::now().timestamp() - days * 24 * 60 * 60) as f64;
        
        let mut stmt = conn.prepare("SELECT * FROM files WHERE modified_time >= ? ORDER BY modified_time DESC")?;
        let mut rows = stmt.query(params![cutoff])?;
        
        let mut records = Vec::new();
        while let Some(row) = rows.next()? {
            records.push(FileRecord {
                id: Some(row.get(0)?),
                filepath: row.get(1)?,
                filename: row.get(2)?,
                file_size: row.get(3)?,
                modified_time: row.get(4)?,
                tags: row.get(5)?,
                description: row.get(6)?,
                backup_disk_status: row.get(7)?,
                backup_cloud_status: row.get(8)?,
                last_backup_time: row.get(9)?,
                relevance_score: None,
            });
        }
        Ok(records)
    }

    pub fn get_tag_distribution(&self) -> Result<HashMap<String, i32>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare("SELECT tags FROM files")?;
        let mut rows = stmt.query([])?;
        
        let mut distribution = HashMap::new();
        while let Some(row) = rows.next()? {
            let tags_str: String = row.get(0)?;
            for tag in tags_str.split(',') {
                let cleaned = tag.trim().to_string();
                if !cleaned.is_empty() {
                    *distribution.entry(cleaned).or_insert(0) += 1;
                }
            }
        }
        Ok(distribution)
    }

    pub fn mark_as_backed_up(&self, rel_paths: Vec<String>, backup_type: &str) -> Result<()> {
        let conn = self.get_conn()?;
        let now_str = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let field = if backup_type == "disk" { "backup_disk_status" } else { "backup_cloud_status" };
        
        let mut stmt = conn.prepare(&format!(
            "UPDATE files SET {} = 1, last_backup_time = ? WHERE filepath = ?",
            field
        ))?;
        
        for path in rel_paths {
            stmt.execute(params![now_str, path])?;
        }
        
        Ok(())
    }

    pub fn add_backup_history(&self, backup_type: &str, files_copied: i32, bytes_copied: i64, status: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO backup_history (backup_type, files_copied, bytes_copied, status) VALUES (?, ?, ?, ?)",
            params![backup_type, files_copied, bytes_copied, status],
        )?;
        Ok(())
    }

    pub fn get_backup_history(&self, limit: i32) -> Result<Vec<BackupHistoryRecord>> {
        let conn = self.get_conn()?;
        let mut stmt = conn.prepare("SELECT * FROM backup_history ORDER BY timestamp DESC LIMIT ?")?;
        let mut rows = stmt.query(params![limit])?;
        
        let mut history = Vec::new();
        while let Some(row) = rows.next()? {
            history.push(BackupHistoryRecord {
                id: Some(row.get(0)?),
                timestamp: row.get(1)?,
                backup_type: row.get(2)?,
                files_copied: row.get(3)?,
                bytes_copied: row.get(4)?,
                status: row.get(5)?,
            });
        }
        Ok(history)
    }
}
