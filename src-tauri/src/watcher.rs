use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use notify::{Watcher, RecommendedWatcher, RecursiveMode, EventKind};
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct FileDetectedPayload {
    pub filepath: String,
    pub filename: String,
    pub file_size: u64,
}

pub struct ActiveWatcher {
    watcher: Option<RecommendedWatcher>,
    monitored_paths: Vec<PathBuf>,
}

pub struct WatcherManager {
    active_watcher: Arc<Mutex<ActiveWatcher>>,
}

impl WatcherManager {
    pub fn new() -> Self {
        WatcherManager {
            active_watcher: Arc::new(Mutex::new(ActiveWatcher {
                watcher: None,
                monitored_paths: Vec::new(),
            })),
        }
    }

    pub fn start_watching(&self, paths: Vec<String>, app_handle: AppHandle) -> Result<(), String> {
        let mut active = self.active_watcher.lock().map_err(|e| e.to_string())?;

        // 1. Terminate existing watcher if any
        if let Some(mut old_watcher) = active.watcher.take() {
            for p in &active.monitored_paths {
                let _ = old_watcher.unwatch(p);
            }
        }
        active.monitored_paths.clear();

        if paths.is_empty() {
            return Ok(());
        }

        let app_handle_clone = app_handle.clone();
        
        // 2. Setup a new event handler
        let mut watcher = RecommendedWatcher::new(
            move |res: notify::Result<notify::Event>| {
                if let Ok(event) = res {
                    // Match generic Create or Modify events (including ModifyKind::Name/Rename)
                    let is_file_event = match event.kind {
                        EventKind::Create(_) => true,
                        EventKind::Modify(_) => true,
                        _ => false,
                    };

                    if is_file_event {
                        for path in event.paths {
                            if path.is_file() {
                                // Ignore temporary office files, browsers downloads caches, or dotfiles
                                let filename = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                                let lower_filename = filename.to_lowercase();
                                if filename.starts_with('.') 
                                    || filename.starts_with("~$") 
                                    || lower_filename.ends_with(".tmp") 
                                    || lower_filename.ends_with(".crdownload") 
                                    || lower_filename.ends_with(".download") 
                                {
                                    continue;
                                }

                                let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                                if size == 0 {
                                    continue; // Skip zero byte file creations (e.g. touch/open handles)
                                }

                                let filepath = path.to_string_lossy().into_owned();
                                let payload = FileDetectedPayload {
                                    filepath,
                                    filename,
                                    file_size: size,
                                };

                                // Emit file detection event to React UI
                                let _ = app_handle_clone.emit("file-detected", payload);
                            }
                        }
                    }
                }
            },
            notify::Config::default(),
        )
        .map_err(|e| e.to_string())?;

        // 3. Register paths
        let mut registered_paths = Vec::new();
        for p_str in paths {
            let p = PathBuf::from(&p_str);
            if p.exists() && p.is_dir() {
                if let Ok(canonical) = p.canonicalize() {
                    let _ = watcher.watch(&canonical, RecursiveMode::NonRecursive);
                    registered_paths.push(canonical);
                }
            }
        }

        active.watcher = Some(watcher);
        active.monitored_paths = registered_paths;

        Ok(())
    }

    pub fn stop_watching(&self) -> Result<(), String> {
        let mut active = self.active_watcher.lock().map_err(|e| e.to_string())?;
        if let Some(mut watcher) = active.watcher.take() {
            for p in &active.monitored_paths {
                let _ = watcher.unwatch(p);
            }
        }
        active.monitored_paths.clear();
        Ok(())
    }
}
