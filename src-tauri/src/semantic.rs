use std::collections::{HashMap, HashSet};
use regex::Regex;

lazy_static::lazy_static! {
    static ref SEMANTIC_SYNONYMS: HashMap<&'static str, Vec<&'static str>> = {
        let mut m = HashMap::new();
        m.insert("财务报表", vec!["发票", "财务", "报表", "账单", "费用", "报销", "支出", "收入", "税", "流水", "资产", "invoice", "receipt", "finance", "billing", "tax"]);
        m.insert("发票收据", vec!["发票", "收据", "小票", "账单", "费用", "报销", "receipt", "invoice", "billing"]);
        m.insert("代码项目", vec!["代码", "程序", "软件", "系统", "开发", "技术", "源码", "工程", "编译", "github", "programming", "code", "develop", "software", "api"]);
        m.insert("技术文档", vec!["技术", "设计说明", "架构", "设计", "文档", "规范", "接口", "api", "doc", "spec", "markdown"]);
        m.insert("合同协议", vec!["合同", "协议", "合作", "签约", "租赁", "采购", "劳动", "保密", "contract", "agreement", "cooperate"]);
        m.insert("设计稿件", vec!["图片", "照片", "设计", "图纸", "稿件", "插图", "海报", "素材", "ui", "psd", "figma", "sketch", "design", "image", "drawing"]);
        m.insert("论文文献", vec!["论文", "文献", "期刊", "报告", "研究", "毕业设计", "毕设", "查重", "thesis", "paper", "research", "report", "journal"]);
        m.insert("个人证件", vec!["身份证", "护照", "驾照", "证件", "证书", "简历", "体检", "passport", "id", "license", "certificate", "resume"]);
        m.insert("会议纪要", vec!["会议", "纪要", "记录", "周报", "汇报", "日常", "沟通", "meeting", "minutes", "record", "weekly", "report"]);
        m.insert("学习资料", vec!["学习", "教程", "课件", "笔记", "书籍", "视频", "讲义", "study", "tutorial", "note", "book", "course"]);
        m
    };

    static ref EN_WORD_REGEX: Regex = Regex::new(r"[a-z0-9]+").unwrap();
    static ref CN_CHAR_REGEX: Regex = Regex::new(r"[\u{4e00}-\u{9fa5}]").unwrap();
}

pub fn extract_terms(text: &str) -> HashSet<String> {
    if text.is_empty() {
        return HashSet::new();
    }
    let text_lower = text.to_lowercase();
    let mut terms = HashSet::new();

    // Extract English words / numbers
    for mat in EN_WORD_REGEX.find_iter(&text_lower) {
        terms.insert(mat.as_str().to_string());
    }

    // Extract Chinese characters
    for mat in CN_CHAR_REGEX.find_iter(&text_lower) {
        terms.insert(mat.as_str().to_string());
    }

    terms
}

pub fn calculate_similarity(terms_a: &HashSet<String>, terms_b: &HashSet<String>) -> f64 {
    if terms_a.is_empty() || terms_b.is_empty() {
        return 0.0;
    }
    let intersection: HashSet<_> = terms_a.intersection(terms_b).collect();
    let union: HashSet<_> = terms_a.union(terms_b).collect();
    intersection.len() as f64 / union.len() as f64
}

pub fn recommend_tags(filename: &str, remark: &str, active_tags: Vec<String>, top_k: usize) -> Vec<String> {
    let filename_clean = filename.trim();
    let remark_clean = remark.trim();
    let combined_text = format!("{} {}", filename_clean, remark_clean).to_lowercase();
    let combined_terms = extract_terms(&combined_text);

    let db_tags = if active_tags.is_empty() {
        vec![
            "#财务报表".to_string(),
            "#代码项目".to_string(),
            "#合同协议".to_string(),
            "#设计稿件".to_string(),
            "#论文文献".to_string(),
            "#个人证件".to_string(),
            "#会议纪要".to_string(),
            "#学习资料".to_string(),
        ]
    } else {
        active_tags
    };

    let mut suggestions = Vec::new();
    for tag in &db_tags {
        let tag_plain = tag.trim_start_matches('#');
        let mut score = 0.0;

        // Category 1: Substring match (Weight 5.0)
        if combined_text.contains(&tag_plain.to_lowercase()) {
            score += 5.0;
        }

        // Category 2: Synonyms (Weight 2.5 per match)
        if let Some(syns) = SEMANTIC_SYNONYMS.get(tag_plain) {
            for syn in syns {
                if combined_text.contains(&syn.to_lowercase()) {
                    score += 2.5;
                }
            }
        }

        // Category 3: Jaccard similarity (Weight 1.5)
        let tag_terms = extract_terms(tag_plain);
        let jaccard = calculate_similarity(&combined_terms, &tag_terms);
        score += jaccard * 1.5;

        if score > 0.1 {
            suggestions.push((tag.clone(), score));
        }
    }

    // Sort by score descending
    suggestions.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut recommended: Vec<String> = suggestions.into_iter().take(top_k).map(|(t, _)| t).collect();

    // Fallback if we have fewer recommendations than top_k
    if recommended.len() < top_k {
        for tag in db_tags {
            if !recommended.contains(&tag) {
                recommended.push(tag);
            }
            if recommended.len() >= top_k {
                break;
            }
        }
    }

    recommended.into_iter().take(top_k).collect()
}
