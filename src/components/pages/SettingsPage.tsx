import { useState } from "react";
import { 
  Plus, 
  Search, 
  Edit3, 
  X, 
  Save, 
  ArrowUp, 
  ArrowDown, 
  TestTube2 
} from "lucide-react";
import type { AutoRule, TagGroupKey, PathValidationMap } from "../../types";
import { standardDirPresets } from "../../utils/fileUtils";
import { invoke } from "@tauri-apps/api/core";

interface SettingsPageProps {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  configHealthScore: number;
  monitoredPathList: string[];
  totalTagCount: number;
  enabledRulesCount: number;
  backupScore: number;
  tempWorkspaceDir: string;
  setTempWorkspaceDir: (dir: string) => void;
  tempMonitoredDirs: string;
  setTempMonitoredDirs: (dirs: string) => void;
  tempBackupDiskDir: string;
  setTempBackupDiskDir: (dir: string) => void;
  tempBackupCloudDir: string;
  setTempBackupCloudDir: (dir: string) => void;
  pathValidation: PathValidationMap;
  workspaceLang: string;
  setWorkspaceLang: (lang: string) => void;
  standardDirs: string[];
  tagsState: { primary: string[]; secondary: string[]; status: string[] };
  setTagsState: React.Dispatch<React.SetStateAction<{ primary: string[]; secondary: string[]; status: string[] }>>;
  namingTemplates: { key: string; label: string; pattern: string }[];
  setNamingTemplates: React.Dispatch<React.SetStateAction<{ key: string; label: string; pattern: string }[]>>;
  autoRulesState: AutoRule[];
  setAutoRulesState: React.Dispatch<React.SetStateAction<AutoRule[]>>;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveMessage: string;
  setSaveStatus: (status: "idle" | "saving" | "saved" | "error") => void;
  setSaveMessage: (msg: string) => void;
  handleSaveConfig: () => Promise<void>;
  handleSelectDir: (setter: (val: string) => void) => Promise<void>;
  setBackupDiskDir: (dir: string) => void;
  setBackupCloudDir: (dir: string) => void;
  addLog: (log: string) => void;
  showToast: (msg: string, type: "success" | "warning" | "error" | "info") => void;
}

export default function SettingsPage({
  theme,
  setTheme,
  configHealthScore,
  monitoredPathList,
  totalTagCount,
  enabledRulesCount,
  backupScore,
  tempWorkspaceDir,
  setTempWorkspaceDir,
  tempMonitoredDirs,
  setTempMonitoredDirs,
  tempBackupDiskDir,
  setTempBackupDiskDir,
  tempBackupCloudDir,
  setTempBackupCloudDir,
  pathValidation,
  workspaceLang,
  setWorkspaceLang,
  standardDirs,
  tagsState,
  setTagsState,
  namingTemplates,
  setNamingTemplates,
  autoRulesState,
  setAutoRulesState,
  saveStatus,
  saveMessage,
  setSaveStatus,
  setSaveMessage,
  handleSaveConfig,
  handleSelectDir,
  setBackupDiskDir,
  setBackupCloudDir,
  addLog,
  showToast
}: SettingsPageProps) {
  // Sub-navigation
  const [settingsSubTab, setSettingsSubTab] = useState<"paths" | "tags" | "rules">("paths");

  // Tag editing inputs
  const [newTagInput, setNewTagInput] = useState("");
  const [newTagGroup, setNewTagGroup] = useState<TagGroupKey>("primary");
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [editingTag, setEditingTag] = useState<{ group: TagGroupKey; value: string } | null>(null);
  const [editingTagValue, setEditingTagValue] = useState("");

  // Naming template inputs
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [newTemplatePattern, setNewTemplatePattern] = useState("");

  // AutoRule inputs
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePrefix, setNewRulePrefix] = useState("01");
  const [newRuleKeywords, setNewRuleKeywords] = useState("");
  const [newRuleExtensions, setNewRuleExtensions] = useState("");
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleTestFilename, setRuleTestFilename] = useState("");

  // Helpers
  const parseListInput = (value: string) => (value || "")
    .split(",")
    .map(p => p.trim())
    .filter(Boolean);

  const normalizeExtension = (value: string) => {
    const trimmed = (value || "").trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
  };

  const normalizeTag = (value: string) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return "";
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  };

  const getRuleTargetDir = (prefix: string) => standardDirs.find(dir => dir.startsWith(prefix)) || `${prefix}*`;

  const getRuleMatch = (filename: string, rules = autoRulesState) => {
    const lowerName = filename.trim().toLowerCase();
    const extMatch = lowerName.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";

    for (const rule of rules) {
      if (rule.enabled === false) continue;
      const extensionHit = rule.extensions.map(e => e.toLowerCase()).includes(ext);
      const keywordHit = rule.keywords.some(keyword => keyword.trim() && lowerName.includes(keyword.toLowerCase()));
      if (extensionHit || keywordHit) {
        return { rule, directory: getRuleTargetDir(rule.target_prefix), reason: extensionHit ? `扩展名 ${ext}` : "关键字命中" };
      }
    }
    return null;
  };

  const ruleTestMatch = ruleTestFilename.trim() ? getRuleMatch(ruleTestFilename) : null;

  // Visual Tag Pool Filter
  const filteredTagsState = {
    primary: tagsState.primary.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
    secondary: tagsState.secondary.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
    status: tagsState.status.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
  };

  // Rule Handlers
  const handleAddOrUpdateRule = () => {
    const normalizedRule: AutoRule = {
      name: newRuleName.trim(),
      keywords: parseListInput(newRuleKeywords),
      extensions: parseListInput(newRuleExtensions).map(normalizeExtension).filter(Boolean),
      target_prefix: newRulePrefix,
      enabled: true
    };

    if (!normalizedRule.name) {
      setSaveStatus("error");
      setSaveMessage("规则名称不能为空。");
      return;
    }

    if (normalizedRule.keywords.length === 0 && normalizedRule.extensions.length === 0) {
      setSaveStatus("error");
      setSaveMessage("规则至少需要一个关键字或扩展名。");
      return;
    }

    setAutoRulesState(prev => {
      if (editingRuleIndex === null) {
        return [...prev, normalizedRule];
      }
      return prev.map((rule, idx) => idx === editingRuleIndex ? { ...normalizedRule, enabled: rule.enabled !== false } : rule);
    });
    addLog(`${editingRuleIndex === null ? "新增" : "更新"}规则卡片: ${normalizedRule.name}`);
    setNewRuleName("");
    setNewRuleKeywords("");
    setNewRuleExtensions("");
    setNewRulePrefix("01");
    setEditingRuleIndex(null);
    setSaveStatus("idle");
    setSaveMessage("规则已更新，记得保存配置。");
  };

  const handleEditRule = (idx: number) => {
    const rule = autoRulesState[idx];
    setEditingRuleIndex(idx);
    setNewRuleName(rule.name);
    setNewRuleKeywords(rule.keywords.join(", "));
    setNewRuleExtensions(rule.extensions.join(", "));
    setNewRulePrefix(rule.target_prefix);
  };

  const handleMoveRule = (idx: number, direction: -1 | 1) => {
    setAutoRulesState(prev => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // Tag Handlers
  const handleAddTag = () => {
    const formatted = normalizeTag(newTagInput);
    if (!formatted) return;
    setTagsState(prev => ({
      ...prev,
      [newTagGroup]: prev[newTagGroup].includes(formatted) ? prev[newTagGroup] : [...prev[newTagGroup], formatted]
    }));
    setNewTagInput("");
    addLog(`成功新增标签泡泡: ${formatted}`);
  };

  const handleStartEditTag = (group: TagGroupKey, value: string) => {
    setEditingTag({ group, value });
    setEditingTagValue(value);
  };

  const handleCommitTagEdit = () => {
    if (!editingTag) return;
    const nextValue = normalizeTag(editingTagValue);
    if (!nextValue) return;

    if (nextValue !== editingTag.value && tagsState[editingTag.group].includes(nextValue)) {
      showToast(`标签 "${nextValue}" 已存在，请使用不同的名称。`, "warning");
      return;
    }

    setTagsState(prev => ({
      ...prev,
      [editingTag.group]: prev[editingTag.group].map(tag => tag === editingTag.value ? nextValue : tag)
    }));
    addLog(`标签已重命名: ${editingTag.value} -> ${nextValue}`);
    setEditingTag(null);
    setEditingTagValue("");
  };

  return (
    <div className="settings-shell" style={{ overflowY: "auto", flex: 1, height: "100%", paddingRight: "6px", paddingBottom: "30px", display: "flex", flexDirection: "column" }}>
      <div className="settings-header">
        <div>
          <span className="pro-max-kicker">Pro Control</span>
          <h3 className="card-title" style={{marginTop: "10px"}}>控制面板与全局系统配置</h3>
          <p>把路径、标签和自动规则作为一套可验证的工作流来管理。</p>
        </div>
        <div className="settings-health">
          <span>配置健康度</span>
          <strong>{configHealthScore}</strong>
          <small>/100</small>
        </div>
      </div>

      <div className="settings-metrics">
        <div><strong>{monitoredPathList.length}</strong><span>监听目录</span></div>
        <div><strong>{totalTagCount}</strong><span>标签泡泡</span></div>
        <div><strong>{enabledRulesCount}</strong><span>启用规则</span></div>
        <div><strong>{backupScore}</strong><span>备份指数</span></div>
      </div>

      {/* Fluent Segmented Control Sub-navigation */}
      <div style={{
        display: "flex",
        background: theme === "light" ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.03)",
        padding: "4px",
        borderRadius: "10px",
        border: "1px solid var(--border-light)",
        gap: "4px",
        marginBottom: "20px",
        flexShrink: 0
      }}>
        {[
          { key: "paths" as const, label: "🌐 基础路径与初始化" },
          { key: "tags" as const, label: "🏷️ 可视化标签池" },
          { key: "rules" as const, label: "🤖 整理与命名规则" }
        ].map(sub => (
          <button
            key={sub.key}
            type="button"
            onClick={() => setSettingsSubTab(sub.key)}
            style={{
              flex: 1,
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: settingsSubTab === sub.key
                ? (theme === "light" ? "#fff" : "rgba(255, 255, 255, 0.08)")
                : "transparent",
              color: settingsSubTab === sub.key
                ? "var(--color-primary)"
                : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: settingsSubTab === sub.key && theme === "light"
                ? "0 2px 8px rgba(0,0,0,0.06)"
                : "none",
              transition: "all 0.15s ease"
            }}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {settingsSubTab === "paths" && (
        <section className="settings-section">
          <div className="settings-section__title">
            <h4>路径与备份目标</h4>
            <span>真实校验目录状态，降低保存后才发现路径不可用的概率。</span>
          </div>
          <div className="settings-path-grid">
            {[
              { key: "workspace" as const, label: "工作空间根路径", value: tempWorkspaceDir, setter: setTempWorkspaceDir, required: true },
              { key: "monitor" as const, label: "多目录监听 (支持添加多个不同目录)", value: tempMonitoredDirs, setter: setTempMonitoredDirs, required: true },
              { key: "disk" as const, label: "外部硬盘备份路径", value: tempBackupDiskDir, setter: setTempBackupDiskDir, required: false },
              { key: "cloud" as const, label: "私有网盘/云端备份路径", value: tempBackupCloudDir, setter: setTempBackupCloudDir, required: false },
            ].map(item => {
              const validation = pathValidation[item.key];
              const ok = item.key === "monitor" ? validation?.exists : validation?.writable;
              const emptyOptional = !item.required && !item.value.trim();

              if (item.key === "monitor") {
                const pathsList = parseListInput(item.value);
                return (
                  <div key={item.key} className="settings-field" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column" }}>
                    <label>{item.label}</label>
                    <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "flex-start" }}>
                      <div 
                        className="input-field" 
                        style={{ 
                          flex: 1, 
                          minHeight: "36px", 
                          height: "auto", 
                          display: "flex", 
                          flexWrap: "wrap", 
                          gap: "6px", 
                          padding: "6px 12px",
                          background: theme === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.01)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "8px",
                          alignItems: "center"
                        }}
                      >
                        {pathsList.length === 0 ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>暂未添加任何监听目录</span>
                        ) : (
                          pathsList.map((p, pIdx) => (
                            <span 
                              key={pIdx} 
                              className="settings-chip" 
                              style={{ 
                                background: "var(--color-primary-glow)", 
                                color: "var(--color-primary)", 
                                border: "1px solid var(--border-glow)",
                                borderRadius: "6px",
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                wordBreak: "break-all"
                              }}
                            >
                              {p}
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = pathsList.filter((_, idx) => idx !== pIdx);
                                  item.setter(updated.join(", "));
                                  showToast("已移除该监听目录", "info");
                                }}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--color-primary)",
                                  cursor: "pointer",
                                  padding: "0 2px",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  transition: "transform 0.1s"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.2)"}
                                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                              >
                                ✕
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const selected: string = await invoke("select_directory");
                            if (selected && selected !== "USER_CANCELLED") {
                              if (pathsList.includes(selected)) {
                                showToast("该目录已在监听列表中！", "warning");
                              } else {
                                const updated = [...pathsList, selected];
                                item.setter(updated.join(", "));
                                showToast("成功添加监听目录", "success");
                              }
                            }
                          } catch (err) {
                            console.error("选择目录异常:", err);
                          }
                        }}
                        className="btn"
                        style={{
                          padding: "0 16px",
                          fontSize: "12px",
                          borderRadius: "8px",
                          background: "rgba(129, 140, 248, 0.12)",
                          border: "1px solid rgba(129, 140, 248, 0.25)",
                          color: "var(--color-primary)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--color-primary)";
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(129, 140, 248, 0.12)";
                          e.currentTarget.style.color = "var(--color-primary)";
                        }}
                      >
                        + 添加目录
                      </button>
                    </div>
                    <div className={`settings-status ${ok ? "ok" : "warn"}`} style={{ marginTop: "6px" }}>
                      {validation?.message || "等待校验"}
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.key} className="settings-field">
                  <label>{item.label}</label>
                  <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => item.setter(e.target.value)}
                      className="input-field"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectDir(item.setter)}
                      className="btn"
                      style={{
                        padding: "0 14px",
                        fontSize: "12px",
                        borderRadius: "8px",
                        background: "rgba(129, 140, 248, 0.12)",
                        border: "1px solid rgba(129, 140, 248, 0.25)",
                        color: "var(--color-primary)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--color-primary)";
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(129, 140, 248, 0.12)";
                        e.currentTarget.style.color = "var(--color-primary)";
                      }}
                    >
                      浏览...
                    </button>
                  </div>
                  <div className={`settings-status ${emptyOptional ? "warn" : ok ? "ok" : "warn"}`}>
                    {emptyOptional ? "未配置，将影响 3-2-1 备份完整度" : validation?.message || "等待校验"}
                  </div>
                </div>
              );
            })}

            {/* 🆕 Workspace Initialization Specification Selector */}
            <div className="settings-field" style={{ gridColumn: "span 2" }}>
              <label>工作空间初始目录规格</label>
              <select
                value={workspaceLang}
                onChange={(e) => setWorkspaceLang(e.target.value)}
                className="input-field"
                style={{ cursor: "pointer" }}
              >
                <option value="zh-full">中文标准版 (12 个目录 — 课程/研究/项目/代码/论文/笔记/资源等)</option>
                <option value="zh-min">中文精简版 (6 个目录 — 课程/研究/项目/归档)</option>
                <option value="zh-basic">中文基础版 (1 个目录 — A0-收集箱)</option>
                <option value="en-full">English Standard (12 dirs)</option>
                <option value="en-min">English Minimal (6 dirs)</option>
                <option value="en-basic">English Basic (1 dir — A0-Inbox)</option>
              </select>
              <div className="settings-status ok" style={{ marginTop: "6px" }}>
                当前模板将创建 <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{(standardDirPresets[workspaceLang] || standardDirPresets["zh-full"]).length}</span> 个基础目录：
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{(standardDirPresets[workspaceLang] || standardDirPresets["zh-full"]).slice(0, 6).join("、")}{ (standardDirPresets[workspaceLang] || standardDirPresets["zh-full"]).length > 6 ? "..." : "" }</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {settingsSubTab === "tags" && (
        <section className="settings-section">
          <div className="settings-section__title">
            <h4>VisualTagPool 可视化标签池</h4>
            <span>支持新增、搜索、重命名和删除，方便维护长期标签体系。</span>
          </div>
          <div className="settings-toolbar">
            <input
              type="text"
              placeholder="新标签名，例如 #量子力学"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="input-field"
            />
            <select
              value={newTagGroup}
              onChange={(e) => setNewTagGroup(e.target.value as TagGroupKey)}
              className="input-field"
            >
              <option value="primary">主分类标签</option>
              <option value="secondary">辅助分类标签</option>
              <option value="status">状态标签</option>
            </select>
            <button className="btn btn-primary" onClick={handleAddTag}>
              <Plus size={15} />
              新增标签
            </button>
          </div>
          <div className="settings-toolbar compact">
            <Search size={16} />
            <input
              type="text"
              placeholder="搜索标签"
              value={tagSearchQuery}
              onChange={(e) => setTagSearchQuery(e.target.value)}
              className="input-field"
            />
          </div>

          {(["primary", "secondary", "status"] as TagGroupKey[]).map(group => (
            <div key={group} className="tag-group">
              <span>
                {group === "primary" ? "主分类标签" : group === "secondary" ? "辅助分类标签" : "状态管理标签"}
                <small>{tagsState[group].length}</small>
              </span>
              <div className="settings-chip-row">
                {filteredTagsState[group].map(tag => (
                  <span key={tag} className={`tag-chip ${group}`}>
                    {editingTag?.group === group && editingTag.value === tag ? (
                      <input
                        value={editingTagValue}
                        onChange={(e) => setEditingTagValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCommitTagEdit();
                          if (e.key === "Escape") setEditingTag(null);
                        }}
                        autoFocus
                      />
                    ) : tag}
                    <button onClick={() => handleStartEditTag(group, tag)} title="重命名标签"><Edit3 size={11} /></button>
                    <button onClick={() => setTagsState(prev => ({ ...prev, [group]: prev[group].filter(t => t !== tag) }))} title="删除标签"><X size={11} /></button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {settingsSubTab === "rules" && (
        <>
          <section className="settings-section">
            <div className="settings-section__title">
              <h4>📁 可视化命名模板自定义管理器</h4>
              <span>定义并扩展智能收集箱里的文档命名模板。支持 `{"{date}"}`, `{"{topic}"}`, `{"{version}"}`, `{"{status}"}` 变量。</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: "10px", alignItems: "center" }}>
                <input 
                  type="text" 
                  placeholder="模板名称，如: 实验报告模板" 
                  value={newTemplateLabel} 
                  onChange={(e) => setNewTemplateLabel(e.target.value)} 
                  className="input-field" 
                />
                <input 
                  type="text" 
                  placeholder="命名格式，如: {date}_实验_{topic}_v{version}" 
                  value={newTemplatePattern} 
                  onChange={(e) => setNewTemplatePattern(e.target.value)} 
                  className="input-field" 
                />
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    if (!newTemplateLabel.trim() || !newTemplatePattern.trim()) {
                      showToast("模板名称与命名格式均不能为空！", "warning");
                      return;
                    }
                    const key = "custom_" + Math.random().toString(36).substring(2, 7);
                    setNamingTemplates(prev => [...prev, { key, label: newTemplateLabel.trim(), pattern: newTemplatePattern.trim() }]);
                    setNewTemplateLabel("");
                    setNewTemplatePattern("");
                    showToast("自定义命名模板添加成功！", "success");
                  }}
                >
                  添加模板
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                {namingTemplates.map((tpl) => (
                  <div key={tpl.key} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.01)"
                  }}>
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{tpl.label}</strong>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "10px", fontFamily: "monospace" }}>{tpl.pattern}</span>
                    </div>
                    {tpl.key.startsWith("custom_") && (
                      <button 
                        className="btn danger" 
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => {
                          setNamingTemplates(prev => prev.filter(t => t.key !== tpl.key));
                          showToast("模板已成功移除！", "info");
                        }}
                      >
                        移除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__title">
              <h4>AutoRules 智能自动匹配整理规则</h4>
              <span>支持启用、编辑、排序、删除和测试命中，越靠前优先级越高。</span>
            </div>
            <div className="settings-rule-editor">
              <div className="settings-rule-grid">
                <div className="settings-field">
                  <label>规则名称</label>
                  <input type="text" placeholder="如: 代码文档" value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} className="input-field" />
                </div>
                <div className="settings-field">
                  <label>目标目录</label>
                  <select value={newRulePrefix} onChange={(e) => setNewRulePrefix(e.target.value)} className="input-field">
                    {standardDirs.map(dir => <option key={dir} value={dir.substring(0, 2)}>{dir}</option>)}
                  </select>
                </div>
                <div className="settings-field">
                  <label>关键字匹配</label>
                  <input type="text" placeholder="paper, arxiv, 汇报" value={newRuleKeywords} onChange={(e) => setNewRuleKeywords(e.target.value)} className="input-field" />
                </div>
                <div className="settings-field">
                  <label>扩展名匹配</label>
                  <input type="text" placeholder=".pdf, .pptx, .py" value={newRuleExtensions} onChange={(e) => setNewRuleExtensions(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="settings-rule-actions">
                {editingRuleIndex !== null && (
                  <button className="btn" onClick={() => {
                    setEditingRuleIndex(null);
                    setNewRuleName("");
                    setNewRuleKeywords("");
                    setNewRuleExtensions("");
                    setNewRulePrefix("01");
                  }}>
                    取消编辑
                  </button>
                )}
                <button className="btn btn-primary" onClick={handleAddOrUpdateRule}>
                  <Save size={15} />
                  {editingRuleIndex === null ? "新增规则" : "保存规则"}
                </button>
              </div>
            </div>

            <div className="rule-test">
              <TestTube2 size={16} />
              <input
                type="text"
                value={ruleTestFilename}
                onChange={(e) => setRuleTestFilename(e.target.value)}
                className="input-field"
                placeholder="输入文件名测试，例如 report_final.pdf"
              />
              <span className={ruleTestMatch ? "settings-status ok" : "settings-status warn"}>
                {ruleTestMatch ? `${ruleTestMatch.rule.name} -> ${ruleTestMatch.directory} (${ruleTestMatch.reason})` : "未命中任何启用规则"}
              </span>
            </div>

            <div className="rule-list">
              {autoRulesState.map((rule, idx) => (
                <div key={`${rule.name}-${idx}`} className={`rule-card ${rule.enabled === false ? "disabled" : ""}`}>
                  <div className="rule-card__main">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rule.enabled !== false}
                        onChange={() => setAutoRulesState(prev => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, enabled: item.enabled === false } : item))}
                      />
                    </label>
                    <div>
                      <strong>{idx + 1}. {rule.name}</strong>
                      <span>{getRuleTargetDir(rule.target_prefix)} · {rule.extensions.join(", ") || "无扩展名"} · {rule.keywords.join(", ") || "无关键字"}</span>
                    </div>
                  </div>
                  <div className="rule-card__actions">
                    <button className="btn" onClick={() => handleMoveRule(idx, -1)} disabled={idx === 0} title="提高优先级"><ArrowUp size={13} /></button>
                    <button className="btn" onClick={() => handleMoveRule(idx, 1)} disabled={idx === autoRulesState.length - 1} title="降低优先级"><ArrowDown size={13} /></button>
                    <button className="btn" onClick={() => handleEditRule(idx)} title="编辑规则"><Edit3 size={13} /></button>
                    <button className="btn danger" onClick={() => {
                      setAutoRulesState(prev => prev.filter((_, i) => i !== idx));
                      addLog(`删除规则: ${rule.name}`);
                    }} title="删除规则"><X size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="settings-savebar">
        <div className={`settings-status ${saveStatus === "error" ? "warn" : saveStatus === "saved" ? "ok" : ""}`}>
          {saveMessage || "修改配置后请保存，保存会同步工作空间与监听规则。"}
        </div>
        <div style={{display: "flex", gap: "8px"}}>
          <button className="btn" onClick={async () => {
            try {
              const config = await invoke("load_config");
              const configJson = JSON.stringify(config, null, 2);
              await invoke("select_export_config_file", { configJson });
              showToast("配置已成功导出！", "success");
            } catch (err: any) {
              if (err !== "USER_CANCELLED") {
                showToast(`导出失败: ${err}`, "error");
              }
            }
          }} style={{fontSize: "11px", padding: "6px 12px"}}>📤 导出</button>
          <button className="btn" onClick={async () => {
            try {
              const text: string = await invoke("select_import_config_file");
              if (text && text !== "USER_CANCELLED") {
                const config = JSON.parse(text);
                await invoke("save_config", { config });
                showToast("配置已成功导入！正在重载...", "success");
                setTimeout(() => window.location.reload(), 1000);
              }
            } catch (err: any) {
              if (err !== "USER_CANCELLED") {
                showToast(`导入失败: ${err}`, "error");
              }
            }
          }} style={{fontSize: "11px", padding: "6px 12px"}}>📥 导入</button>
          <button className="btn danger" onClick={() => {
            if (!window.confirm("确定要重置所有配置为默认值吗？此操作不可撤销。\n注意：您的当前工作空间与多目录监听路径将被保留。")) return;
            setBackupDiskDir(""); setBackupCloudDir("");
            setTempBackupDiskDir(""); setTempBackupCloudDir("");
            setTagsState({primary: [], secondary: [], status: ["#待处理", "#进行中", "#已完成", "#非常重要"]});
            setAutoRulesState([]); setNamingTemplates(prev => prev.filter(t => !t.key.startsWith("custom_")));
            setWorkspaceLang("zh-full"); setTheme("light");
            showToast("配置已成功重置，请点击保存生效。", "warning");
          }} style={{fontSize: "11px", padding: "6px 12px"}}>🔄 重置</button>
          <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saveStatus === "saving"}>
            <Save size={16} />
            {saveStatus === "saving" ? "保存中..." : "保存并热加载"}
          </button>
        </div>
      </div>
    </div>
  );
}
