use crate::{backup::BackupManager, db::DatabaseManager, file_manager::FileManager};
use std::{fs, path::PathBuf, sync::atomic::{AtomicU64, Ordering}};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "ledger-regression-{}-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        Self(root)
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        crate::db::close_test_connections(&self.0);
        assert!(self.0.is_absolute() && self.0.starts_with(std::env::temp_dir()));
        assert!(self.0.file_name().unwrap().to_string_lossy().starts_with("ledger-regression-"));
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn search_supports_initials_metadata_multiple_keywords_and_filters() {
    let fixture = Fixture::new();
    let db = DatabaseManager::new(&fixture.0);
    db.sync_file_metadata("资料/报告.txt", "报告.txt", 8, 1.0).unwrap();
    db.update_file_tags("资料/报告.txt", vec!["#课程学习".into(), "#已完成".into()]).unwrap();
    db.update_file_description("资料/报告.txt", "量子实验").unwrap();
    for query in ["bg", "量子实验", "课程学习", "报告 量子"] {
        assert_eq!(db.search_files(Some(query.into()), None, None).unwrap().len(), 1, "{query}");
    }
    assert_eq!(db.search_files(Some("bg".into()), Some(vec!["#课程学习".into()]), Some("#已完成".into())).unwrap().len(), 1);
    assert!(db.search_files(Some("bg".into()), Some(vec!["#其他".into()]), None).unwrap().is_empty());
    assert!(db.search_files(Some("报告 不存在".into()), None, None).unwrap().is_empty());
}

#[test]
fn repeated_archive_name_preserves_old_archive_and_new_source() {
    let fixture = Fixture::new();
    let workspace = fixture.0.to_str().unwrap();
    let db = DatabaseManager::new(workspace);
    fs::write(fixture.0.join("first.txt"), b"first unique content").unwrap();
    FileManager::archive_to_zip(workspace, vec!["first.txt".into()], "same.zip", &db).unwrap();
    assert!(!fixture.0.join("first.txt").exists());
    let original = fs::read(fixture.0.join("10归档区/same.zip")).unwrap();
    fs::write(fixture.0.join("second.txt"), b"second unique content").unwrap();
    assert!(FileManager::archive_to_zip(workspace, vec!["second.txt".into()], "same.zip", &db).is_err());
    assert_eq!(fs::read(fixture.0.join("10归档区/same.zip")).unwrap(), original);
    assert_eq!(fs::read(fixture.0.join("second.txt")).unwrap(), b"second unique content");
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(original)).unwrap();
    let mut restored = Vec::new();
    std::io::Read::read_to_end(&mut archive.by_name("first.txt").unwrap(), &mut restored).unwrap();
    assert_eq!(restored, b"first unique content");
}

#[test]
fn publishing_does_not_replace_a_target_created_after_conflict_check() {
    let fixture = Fixture::new();
    let source = fixture.0.join("temporary");
    let destination = fixture.0.join("existing.zip");
    fs::write(&source, b"new archive").unwrap();
    fs::write(&destination, b"previous archive").unwrap();
    assert!(crate::storage::publish_no_replace(&source, &destination).is_err());
    assert_eq!(fs::read(&destination).unwrap(), b"previous archive");
    assert_eq!(fs::read(&source).unwrap(), b"new archive");
}

#[test]
fn backup_repairs_same_size_and_timestamp_corruption_and_restores_metadata() {
    let fixture = Fixture::new();
    let workspace = fixture.0.join("workspace");
    let destination = fixture.0.join("backup");
    fs::create_dir(&workspace).unwrap();
    let db = DatabaseManager::new(&workspace);
    fs::write(workspace.join("报告.txt"), b"original").unwrap();
    FileManager::scan_workspace_files(workspace.to_str().unwrap(), &db).unwrap();
    db.update_file_tags("报告.txt", vec!["#课程学习".into()]).unwrap();
    db.update_file_description("报告.txt", "重要备注").unwrap();
    let run = || BackupManager::perform_backup("disk", workspace.to_str().unwrap(), destination.to_str().unwrap(), &db).unwrap();
    run();
    let backup = destination.join("报告.txt");
    let time = fs::metadata(&backup).unwrap().modified().unwrap();
    fs::write(&backup, b"CORRUPT!").unwrap();
    filetime::set_file_mtime(&backup, filetime::FileTime::from_system_time(time)).unwrap();
    assert!(run().contains("1 个文件"));
    assert_eq!(fs::read(&backup).unwrap(), b"original");
    assert!(run().contains("0 个文件"));

    // Restore into a new workspace using only the backup data and SQLite snapshot.
    let restored = fixture.0.join("restored");
    fs::create_dir(&restored).unwrap();
    fs::copy(destination.join(".docman.db"), restored.join(".docman.db")).unwrap();
    fs::copy(&backup, restored.join("报告.txt")).unwrap();
    let recovered = DatabaseManager::new(&restored);
    FileManager::scan_workspace_files(restored.to_str().unwrap(), &recovered).unwrap();
    let record = recovered.get_file_info("报告.txt").unwrap().unwrap();
    assert_eq!(record.tags, "#课程学习");
    assert_eq!(record.description, "重要备注");
    assert!(!recovered.get_backup_history(10).unwrap().is_empty());
}

#[test]
fn snapshot_includes_committed_wal_changes_and_can_replace_a_previous_snapshot() {
    let fixture = Fixture::new();
    let db = DatabaseManager::new(&fixture.0);
    let connection = rusqlite::Connection::open(fixture.0.join(".docman.db")).unwrap();
    connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;").unwrap();
    db.sync_file_metadata("test.txt", "test.txt", 1, 1.0).unwrap();
    let snapshot = fixture.0.join("snapshot.db");
    db.snapshot_to(&snapshot).unwrap();
    db.update_file_description("test.txt", "committed in WAL").unwrap();
    db.snapshot_to(&snapshot).unwrap();
    let backup = rusqlite::Connection::open(&snapshot).unwrap();
    let description: String = backup.query_row("SELECT description FROM files", [], |row| row.get(0)).unwrap();
    assert_eq!(description, "committed in WAL");
}

#[test]
fn root_folders_are_created_and_discovered_even_when_empty() {
    let fixture = Fixture::new();
    let root = fixture.0.to_str().unwrap();
    FileManager::init_workspace(root, vec!["待处理".into(), "客户项目".into()]).unwrap();
    FileManager::create_folder("合同资料", root).unwrap();
    let dirs = FileManager::list_workspace_directories(root).unwrap();
    assert!(dirs.contains(&"合同资料".to_string()));
    assert!(fixture.0.join("合同资料").is_dir());
    assert!(FileManager::create_folder("../outside", root).is_err());
    assert!(FileManager::init_workspace(root, vec!["../outside".into()]).is_err());
    assert!(FileManager::init_workspace(root, vec!["CON".into()]).is_err());
}

#[test]
fn old_configurations_without_custom_templates_still_deserialize() {
    let mut old = serde_json::to_value(crate::config_manager::AppConfig::default()).unwrap();
    old.as_object_mut().unwrap().remove("custom_workspace_templates");
    let config: crate::config_manager::AppConfig = serde_json::from_value(old).unwrap();
    assert!(config.custom_workspace_templates.is_empty());
}
