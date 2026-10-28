use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// Reserve a private sibling file without truncating another operation's data.
pub(crate) fn create_temp_file(directory: &Path) -> std::io::Result<(PathBuf, File)> {
    static NEXT_ID: AtomicU64 = AtomicU64::new(0);
    loop {
        let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        let path = directory.join(format!(".ledger-tmp-{}-{id}", std::process::id()));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(err) => return Err(err),
        }
    }
}

/// Publish without replacing any existing file, including on FAT/exFAT volumes
/// where hard links are unavailable. Callers keep source documents until success.
pub(crate) fn publish_no_replace(source: &Path, destination: &Path) -> std::io::Result<()> {
    if std::fs::hard_link(source, destination).is_ok() {
        return Ok(());
    }
    let mut input = File::open(source)?;
    let mut output = OpenOptions::new().write(true).create_new(true).open(destination)?;
    let result = std::io::copy(&mut input, &mut output).and_then(|_| output.sync_all());
    drop(output);
    let result = result.and_then(|_| {
        let source_hash = crate::file_manager::FileManager::calculate_file_hash(source)
            .map_err(std::io::Error::other)?;
        let destination_hash = crate::file_manager::FileManager::calculate_file_hash(destination)
            .map_err(std::io::Error::other)?;
        if source_hash != destination_hash {
            return Err(std::io::Error::other("归档保存后内容校验失败，原件已保留"));
        }
        Ok(())
    });
    if result.is_err() {
        let _ = std::fs::remove_file(destination);
    }
    result
}
