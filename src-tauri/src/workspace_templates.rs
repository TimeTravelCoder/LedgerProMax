use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceTemplate {
    pub id: String,
    pub name: String,
    pub dirs: Vec<String>,
}

pub fn validate_directory_name(name: &str) -> Result<(), String> {
    let upper = name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL"].contains(&upper.as_str())
        || (upper.len() == 4
            && (upper.starts_with("COM") || upper.starts_with("LPT"))
            && matches!(upper.as_bytes()[3], b'1'..=b'9'));
    if name.is_empty()
        || name.trim() != name
        || name.starts_with('.')
        || name.ends_with('.')
        || name.encode_utf16().count() > 255
        || reserved
        || name
            .chars()
            .any(|c| c.is_control() || ['<', '>', ':', '"', '/', '\\', '|', '?', '*'].contains(&c))
    {
        return Err(format!("无效的一级目录名称：{name}"));
    }
    Ok(())
}

pub fn validate_templates(templates: &[WorkspaceTemplate], selection: &str) -> Result<(), String> {
    if templates.len() > 20 {
        return Err("自定义模板最多保存 20 个。".into());
    }
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    for template in templates {
        if template.id.is_empty()
            || template.id.len() > 80
            || !template
                .id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
            || !ids.insert(template.id.clone())
        {
            return Err("模板标识无效或重复。".into());
        }
        if template.name.trim().is_empty()
            || template.name.encode_utf16().count() > 80
            || !names.insert(template.name.trim().to_lowercase())
        {
            return Err("模板名称为空、过长或重复。".into());
        }
        if template.dirs.is_empty() || template.dirs.len() > 50 {
            return Err("每个模板需包含 1 至 50 个一级目录。".into());
        }
        let mut dirs = HashSet::new();
        for dir in &template.dirs {
            validate_directory_name(dir)?;
            if !dirs.insert(dir.to_lowercase()) {
                return Err(format!("目录名称重复：{dir}"));
            }
        }
    }
    if let Some(id) = selection.strip_prefix("custom:") {
        if !ids.contains(id) {
            return Err("选中的自定义模板不存在。".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn custom_names_are_validated_before_filesystem_operations() {
        for invalid in [
            "",
            "..",
            "../outside",
            "C:\\outside",
            "nested/dir",
            "CON",
            "nul.txt",
            "file.",
            ".hidden",
            "a?b",
        ] {
            assert!(validate_directory_name(invalid).is_err(), "{invalid}");
        }
        for valid in ["待处理", "客户项目", "合同资料", "00Inbox"] {
            assert!(validate_directory_name(valid).is_ok());
        }
    }
    #[test]
    fn template_roundtrip_and_selection_validation() {
        let templates = vec![WorkspaceTemplate {
            id: "my-template".into(),
            name: "项目资料".into(),
            dirs: vec!["待处理".into(), "项目".into()],
        }];
        let encoded = serde_json::to_string(&templates).unwrap();
        let decoded: Vec<WorkspaceTemplate> = serde_json::from_str(&encoded).unwrap();
        assert!(validate_templates(&decoded, "custom:my-template").is_ok());
        assert!(validate_templates(&decoded, "custom:missing").is_err());
        let mut duplicate = decoded.clone();
        duplicate[0].dirs = vec!["Inbox".into(), "inbox".into()];
        assert!(validate_templates(&duplicate, "custom:my-template").is_err());
    }
}
