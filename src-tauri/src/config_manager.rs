use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AutoRule {
    pub name: String,
    pub keywords: Vec<String>,
    pub extensions: Vec<String>,
    pub target_prefix: String,
    #[serde(default = "default_rule_enabled")]
    pub enabled: bool,
}

fn default_rule_enabled() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagGroups {
    pub primary: Vec<String>,
    pub secondary: Vec<String>,
    pub status: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub workspace_dir: String,
    pub downloads_dir: String,
    pub monitored_dirs: Vec<String>,
    pub backup_disk_dir: String,
    pub backup_cloud_dir: String,
    pub theme: String,
    pub monitored_downloads: bool,
    pub auto_rule_enabled: bool,
    pub tags: TagGroups,
    pub workspace_lang: String,
    pub auto_rules: Vec<AutoRule>,
    pub custom_name_templates: Vec<serde_json::Value>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\"));
        let default_workspace = dirs::config_dir()
            .map(|p| p.join("Ledger").join("Workspace"))
            .unwrap_or_else(|| home.join("Ledger").join("Workspace"));

        let downloads = dirs::download_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| home.join("Downloads").to_string_lossy().into_owned());

        AppConfig {
            workspace_dir: default_workspace.to_string_lossy().into_owned(),
            downloads_dir: downloads.clone(),
            monitored_dirs: vec![downloads],
            backup_disk_dir: String::new(),
            backup_cloud_dir: String::new(),
            theme: "dark".to_string(),
            monitored_downloads: true,
            auto_rule_enabled: false,
            tags: TagGroups {
                primary: vec![
                    "#人工智能".to_string(),
                    "#量子科技".to_string(),
                    "#高等数学".to_string(),
                    "#操作系统".to_string(),
                    "#计算机网络".to_string(),
                    "#专业英语".to_string(),
                    "#课程学习".to_string(),
                    "#课题研究".to_string(),
                ],
                secondary: vec![
                    "#实验报告".to_string(),
                    "#学术论文".to_string(),
                    "#项目文档".to_string(),
                    "#复习备考".to_string(),
                    "#期末考试".to_string(),
                    "#常用参考".to_string(),
                ],
                status: vec![
                    "#待处理".to_string(),
                    "#进行中".to_string(),
                    "#已完成".to_string(),
                    "#非常重要".to_string(),
                ],
            },
            workspace_lang: "zh-full".to_string(),
            auto_rules: vec![
                AutoRule {
                    name: "论文文档".to_string(),
                    keywords: vec!["paper".to_string(), "论文".to_string(), "arxiv".to_string()],
                    extensions: vec![".pdf".to_string()],
                    target_prefix: "05".to_string(),
                    enabled: true,
                },
                AutoRule {
                    name: "演示文稿".to_string(),
                    keywords: vec!["ppt".to_string(), "presentation".to_string(), "汇报".to_string()],
                    extensions: vec![".ppt".to_string(), ".pptx".to_string()],
                    target_prefix: "08".to_string(),
                    enabled: true,
                },
                AutoRule {
                    name: "代码文件".to_string(),
                    keywords: vec!["code".to_string(), "script".to_string()],
                    extensions: vec![
                        ".py".to_string(),
                        ".js".to_string(),
                        ".ts".to_string(),
                        ".cpp".to_string(),
                        ".java".to_string(),
                    ],
                    target_prefix: "04".to_string(),
                    enabled: true,
                },
                AutoRule {
                    name: "图片素材".to_string(),
                    keywords: vec!["image".to_string(), "photo".to_string(), "截图".to_string()],
                    extensions: vec![".png".to_string(), ".jpg".to_string(), ".jpeg".to_string()],
                    target_prefix: "07".to_string(),
                    enabled: true,
                },
            ],
            custom_name_templates: Vec::new(),
        }
    }
}

pub struct ConfigManager;

impl ConfigManager {
    pub fn get_config_path() -> PathBuf {
        let base_dir = dirs::config_dir()
            .map(|p| p.join("Ledger"))
            .unwrap_or_else(|| {
                dirs::home_dir()
                    .map(|p| p.join(".ledger"))
                    .unwrap_or_else(|| PathBuf::from("C:\\Ledger"))
            });
        
        let _ = fs::create_dir_all(&base_dir);
        base_dir.join(".config.json")
    }

    pub fn load_config() -> AppConfig {
        let path = Self::get_config_path();
        if path.exists() {
            // Read as raw bytes to handle BOM correctly
            if let Ok(raw_bytes) = fs::read(&path) {
                // Strip UTF-8 BOM (EF BB BF) if present
                let content_bytes = if raw_bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
                    &raw_bytes[3..]
                } else {
                    &raw_bytes[..]
                };
                if let Ok(content) = std::str::from_utf8(content_bytes) {
                    if let Ok(config) = serde_json::from_str::<AppConfig>(content) {
                        return config;
                    } else {
                        eprintln!("[ConfigManager] Failed to parse config JSON, using default.");
                    }
                }
            }
        }
        
        // If loading fails or file doesn't exist, save and return default config
        let default_config = AppConfig::default();
        let _ = Self::save_config(&default_config);
        default_config
    }

    pub fn save_config(config: &AppConfig) -> Result<(), String> {
        let path = Self::get_config_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let serialized = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        // Write without BOM using explicit UTF-8 byte slice to avoid platform encoding issues
        fs::write(&path, serialized.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    }
}

