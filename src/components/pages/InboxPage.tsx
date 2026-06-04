import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  Trash2, 
  X, 
  Layers 
} from "lucide-react";
import type { FileRecord, AutoRule } from "../../types";
import { getFileIcon, formatSize } from "../../utils/fileUtils";
import { invoke } from "@tauri-apps/api/core";

interface InboxPageProps {
  theme: "dark" | "light";
  inboxFiles: FileRecord[];
  setInboxFiles: React.Dispatch<React.SetStateAction<FileRecord[]>>;
  selectedInboxFile: FileRecord | null;
  setSelectedInboxFile: (file: FileRecord | null) => void;
  namingTemplates: { key: string; label: string; pattern: string }[];
  standardDirs: string[];
  inboxName: string;
  workspaceDir: string;
  autoRulesState: AutoRule[];
  getRuleMatch: (filename: string, rules?: AutoRule[]) => { rule: AutoRule; directory: string; reason: string } | null;
  handleDeleteFile: (filepath: string) => Promise<void>;
  addLog: (msg: string) => void;
  showToast: (msg: string, type: "success" | "warning" | "error" | "info") => void;
  onRefreshWorkspace: () => Promise<void>;
  setUndoStack: React.Dispatch<React.SetStateAction<any[]>>;
  setPreviewFile: (file: FileRecord | null) => void;
  desktopSummary: { normal_files: number; folders: number; shortcuts: number; temporary_files: number };
  handleCleanDesktop: () => void;
  isCleaningDesktop: boolean;
}

export default function InboxPage({
  theme,
  inboxFiles,
  setInboxFiles,
  selectedInboxFile,
  setSelectedInboxFile,
  namingTemplates,
  standardDirs,
  inboxName,
  workspaceDir,
  autoRulesState,
  getRuleMatch,
  handleDeleteFile,
  addLog,
  showToast,
  onRefreshWorkspace,
  setUndoStack,
  setPreviewFile,
  desktopSummary,
  handleCleanDesktop,
  isCleaningDesktop
}: InboxPageProps) {
  // Local sorting/multiselect states
  const [inboxSort, setInboxSort] = useState<"name" | "size" | "time">("time");
  const [inboxMultiMode, setInboxMultiMode] = useState(false);
  const [checkedInboxFiles, setCheckedInboxFiles] = useState<string[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);

  // Archive Form States
  const [selectedTemplate, setSelectedTemplate] = useState("regular");
  const [topicName, setTopicName] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [fileStatus, setFileStatus] = useState("#待处理");
  const [remark, setRemark] = useState("");
  const [recommendedTags, setRecommendedTags] = useState<string[]>([]);
  const [chosenTags, setChosenTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [targetCategory, setTargetCategory] = useState("01课程学习");

  // Load tag recommendations and target directory suggestions when a file is selected
  useEffect(() => {
    if (selectedInboxFile) {
      const updateSuggestions = async () => {
        try {
          // Recommend Tags
          const tags: string[] = await invoke("recommend_tags", {
            filename: selectedInboxFile.filename,
            remark: remark,
            activeTags: [],
            topK: 3
          });
          setRecommendedTags(tags);
          setChosenTags(tags.slice(0, 2)); // Pre-check top 2 recommended tags

          // Suggest category directory based on extension / keywords
          const suggestion: [string, string] | null = await invoke("suggest_rule_target", {
            filename: selectedInboxFile.filename,
            autoRules: autoRulesState,
            standardDirs
          });
          if (suggestion) {
            setTargetCategory(suggestion[1]);
          } else {
            // Default category fallback
            const defaultCat = standardDirs.find(d => d !== inboxName) || "01课程学习";
            setTargetCategory(defaultCat);
          }
        } catch (err) {
          console.error("加载智能归档推荐发生异常:", err);
        }
      };
      updateSuggestions();
    }
  }, [selectedInboxFile]);

  // Format filename based on selected template and inputs
  const getFormattedName = (originalName: string) => {
    const dotIdx = originalName.lastIndexOf(".");
    const ext = dotIdx > 0 ? originalName.substring(dotIdx) : "";
    const today = new Date().toISOString().substring(0, 10).replace(/-/g, "");
    const topic = topicName.trim() === "" ? "无主题" : topicName.trim();
    
    // Find active template
    const activeTpl = namingTemplates.find(t => t.key === selectedTemplate);
    if (activeTpl) {
      const cleanStatus = fileStatus.replace("#", "");
      let result = activeTpl.pattern;
      result = result.replace(/{date}/g, today);
      result = result.replace(/{topic}/g, topic);
      result = result.replace(/{version}/g, version);
      result = result.replace(/{status}/g, cleanStatus);
      return `${result}${ext}`;
    }

    // Fallback template
    const cleanStatus = fileStatus.replace("#", "");
    return `${today}_${topic}_${version}_${cleanStatus}${ext}`;
  };

  // Perform single file archive
  const handleArchiveFile = async () => {
    if (!selectedInboxFile || isArchiving) return;
    setIsArchiving(true);

    try {
      const formattedName = getFormattedName(selectedInboxFile.filename.toString());
      const destRel = `${targetCategory}/${formattedName}`;

      const finalRel: string = await invoke("organize_file", {
        workspaceDir,
        srcPath: `${workspaceDir}/${selectedInboxFile.filepath}`,
        destRelPath: destRel,
        newFilename: formattedName
      });

      const finalTags = [...chosenTags];
      if (fileStatus && !finalTags.includes(fileStatus)) {
        finalTags.push(fileStatus);
      }

      await invoke("update_file_tags", { workspaceDir, filepath: finalRel, tags: finalTags });
      if (remark.trim() !== "") {
        await invoke("update_file_description", { workspaceDir, filepath: finalRel, description: remark.trim() });
      }

      addLog(`文档归档成功: ${selectedInboxFile.filename} -> ${destRel}`);
      showToast("归档成功！", "success");
      setUndoStack(prev => [{action: `归档 ${selectedInboxFile.filename} → ${destRel}`, filepath: finalRel, timestamp: Date.now()}, ...prev].slice(0, 20));
      
      const archivedPath = selectedInboxFile.filepath;
      setSelectedInboxFile(null);
      setTopicName("");
      setRemark("");
      setChosenTags([]);
      setVersion("v1.0");
      setFileStatus("#待处理");
      
      await onRefreshWorkspace();
      
      // Auto-select next file in list for continuous processing
      setTimeout(() => {
        setInboxFiles(prev => {
          const remaining = prev.filter(f => f.filepath !== archivedPath);
          if (remaining.length > 0) {
            const next = remaining[0];
            const nextDot = next.filename.toString().lastIndexOf(".");
            setSelectedInboxFile(next);
            setTopicName(nextDot > 0 ? next.filename.toString().substring(0, nextDot) : next.filename.toString());
          }
          return remaining;
        });
      }, 200);
    } catch (err: any) {
      addLog(`[错误] 归档失败: ${err}`);
      showToast(`归档失败: ${err}`, "error");
    } finally {
      setIsArchiving(false);
    }
  };

  // Perform quick direct archive for multiselect
  const handleArchiveFileDirect = async (file: FileRecord) => {
    try {
      const match = getRuleMatch(file.filename, autoRulesState);
      const destDir = match ? match.directory : (standardDirs.find(d => d !== inboxName) || "01课程学习");
      const destRel = `${destDir}/${file.filename}`;

      const finalRel: string = await invoke("organize_file", {
        workspaceDir,
        srcPath: `${workspaceDir}/${file.filepath}`,
        destRelPath: destRel,
        newFilename: file.filename
      });

      const finalTags = [...(file.tags || [])];
      await invoke("update_file_tags", { workspaceDir, filepath: finalRel, tags: finalTags });
      if (file.description) {
        await invoke("update_file_description", { workspaceDir, filepath: finalRel, description: file.description });
      }

      addLog(`文档归档成功: ${file.filename} -> ${destRel}`);
      setUndoStack(prev => [{action: `归档 ${file.filename} → ${destRel}`, filepath: finalRel, timestamp: Date.now()}, ...prev].slice(0, 20));
    } catch (err: any) {
      addLog(`[错误] 归档失败: ${file.filename}, ${err}`);
      showToast(`归档失败: ${file.filename}, ${err}`, "error");
    }
  };

  return (
    <div style={{display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px", height: "100%"}}>
      {/* Left Panel: Desktop clean & Inbox List */}
      <div style={{display: "flex", flexDirection: "column", gap: "20px"}}>
        {/* Desktop Summary Panel */}
        <div className="cyber-card" style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)"}}>
          <div>
            <h3 className="card-title"><Sparkles size={18} className="text-primary" /> 本地桌面健康度</h3>
            <p className="card-desc" style={{marginTop: "6px"}}>
              {desktopSummary.normal_files === 0 ? (
                <>桌面非常整洁，暂无未归类文档 ✨</>
              ) : (
                <>发现桌面有 <strong style={{color: "var(--color-warning)"}}>{desktopSummary.normal_files}</strong> 个未归类文档，
              <strong style={{color: "var(--color-primary)"}}>{desktopSummary.folders}</strong> 个文件夹。</>
              )}
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleCleanDesktop} disabled={isCleaningDesktop} style={{opacity: isCleaningDesktop ? 0.65 : 1, cursor: isCleaningDesktop ? "not-allowed" : "pointer"}}>
            {isCleaningDesktop ? "⏳ 整理中..." : "🧹 一键整理到收集箱"}
          </button>
        </div>

        {/* Inbox files List */}
        <div style={{display: "flex", flexDirection: "column", gap: "16px", flex: 1, minHeight: 0}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0}}>
            <h3 className="card-title" style={{margin: 0}}>📥 收集箱待整理文件 ({inboxFiles.length})</h3>
            <div style={{display: "flex", gap: "8px", alignItems: "center"}}>
              <select value={inboxSort} onChange={(e) => setInboxSort(e.target.value as any)} style={{fontSize: "11px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-light)", background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer"}}>
                <option value="time">按时间</option><option value="name">按名称</option><option value="size">按大小</option>
              </select>
              <button onClick={() => { setInboxMultiMode(!inboxMultiMode); setCheckedInboxFiles([]); }} style={{fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border-light)", background: inboxMultiMode ? "var(--color-primary)" : "var(--bg-secondary)", color: inboxMultiMode ? "#fff" : "var(--text-secondary)", cursor: "pointer"}}>
                {inboxMultiMode ? "取消多选" : "多选"}
              </button>
              {inboxMultiMode && inboxFiles.length > 0 && (
                <button onClick={() => {
                  if (checkedInboxFiles.length === inboxFiles.length) {
                    setCheckedInboxFiles([]);
                  } else {
                    setCheckedInboxFiles(inboxFiles.map(f => f.filepath.toString()));
                  }
                }} style={{fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border-light)", background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: "pointer"}}>
                  {checkedInboxFiles.length === inboxFiles.length ? "取消全选" : "全选"}
                </button>
              )}
              {inboxMultiMode && checkedInboxFiles.length > 0 && (
                <button onClick={async () => {
                  setInboxMultiMode(false);
                  setIsArchiving(true);
                  for (const fp of checkedInboxFiles) {
                    const f = inboxFiles.find(x => x.filepath === fp);
                    if (f) {
                      await handleArchiveFileDirect(f);
                    }
                  }
                  setCheckedInboxFiles([]);
                  setIsArchiving(false);
                  await onRefreshWorkspace();
                  showToast("批量归档完成！", "success");
                }} style={{fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--color-success)", background: "var(--color-success-glow)", color: "var(--color-success)", cursor: "pointer", fontWeight: 600}}>
                  批量归档 ({checkedInboxFiles.length})
                </button>
              )}
            </div>
          </div>
          {inboxFiles.length === 0 ? (
            <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, border: "2px dashed var(--border-light)", borderRadius: "16px", padding: "40px", color: "var(--text-secondary)"}}>
              <CheckCircle2 size={48} style={{color: "var(--color-success)", marginBottom: "16px"}} />
              <p style={{fontSize: "15px", fontWeight: 500}}>收集箱空空如也，桌面十分整洁！</p>
              <p style={{fontSize: "13px", color: "var(--text-muted)", marginTop: "4px"}}>您可以从外部拖入文件或将文件放置于监听文件夹中。</p>
            </div>
          ) : (
            <div style={{display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1, minHeight: 0, paddingRight: "6px"}}>
              {[...inboxFiles].sort((a, b) => inboxSort === "name" ? String(a.filename).localeCompare(String(b.filename)) : inboxSort === "size" ? Number(b.file_size) - Number(a.file_size) : Number(b.modified_time) - Number(a.modified_time)).map((file, idx) => {
                const isChecked = checkedInboxFiles.includes(file.filepath.toString());
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (inboxMultiMode) {
                        setCheckedInboxFiles(prev => isChecked ? prev.filter(f => f !== file.filepath.toString()) : [...prev, file.filepath.toString()]);
                      } else {
                        setSelectedInboxFile(file);
                        const dotIdx = file.filename.toString().lastIndexOf(".");
                        setTopicName(dotIdx > 0 ? file.filename.toString().substring(0, dotIdx) : file.filename.toString());
                        setRemark("");
                        setVersion("v1.0");
                        setFileStatus("#待处理");
                        setCustomTagInput("");
                        setChosenTags([]);
                      }
                    }}
                    onDoubleClick={() => setPreviewFile(file)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      border: "1px solid",
                      borderColor: isChecked ? "var(--color-success)" : selectedInboxFile?.filepath === file.filepath ? "var(--color-primary)" : "var(--border-light)",
                      background: isChecked ? "var(--color-success-glow)" : selectedInboxFile?.filepath === file.filepath ? "var(--color-primary-glow)" : "var(--bg-secondary)",
                      transition: "border-color 0.15s ease, background 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      if (selectedInboxFile?.filepath !== file.filepath) {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedInboxFile?.filepath !== file.filepath) {
                        e.currentTarget.style.borderColor = "var(--border-light)";
                        e.currentTarget.style.background = "var(--bg-secondary)";
                      }
                    }}
                  >
                    <div style={{display: "flex", alignItems: "center", gap: "14px", overflow: "hidden", minWidth: 0, flex: 1}}>
                      {getFileIcon(file.filename.toString(), 34)}
                      <div style={{overflow: "hidden", minWidth: 0, flex: 1}}>
                        <h4 style={{margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.4"}}>{file.filename}</h4>
                        <p style={{margin: 0, fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", paddingBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.4"}}>{file.filepath}</p>
                      </div>
                    </div>
                    <div style={{display: "flex", alignItems: "center", gap: "10px", flexShrink: 0}}>
                      <div style={{display: "flex", flexWrap: "wrap", gap: "3px", maxWidth: "120px", justifyContent: "flex-end"}}>
                        {(file.tags || []).slice(0, 2).map((tag, ti) => {
                          const tagVal = tag.replace(/^#/, "");
                          if (!tagVal) return null;
                          const tagColors: Record<string, string> = { completed: "#34d399", done: "#34d399", active: "#fbbf24", pending: "#f87171", important: "#a78bfa", 已完成: "#34d399", 进行中: "#fbbf24", 待处理: "#f87171", 非常重要: "#a78bfa" };
                          const lower = tagVal.toLowerCase();
                          const tagColor = tagColors[lower] || "#818cf8";
                          return (
                            <span key={ti} style={{
                              display: "inline-block",
                              padding: "2px 6px",
                              borderRadius: "99px",
                              background: `${tagColor}22`,
                              color: tagColor,
                              fontSize: "10px",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              maxWidth: "64px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: "1.3"
                            }}>{tagVal}</span>
                          );
                        })}
                      </div>
                      <span style={{fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap"}}>{formatSize(file.file_size)}</span>
                      <span style={{width: "1px", height: "18px", background: "var(--border-light)", flexShrink: 0}} />
                      <button
                        className="btn"
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.filepath.toString()); }}
                        style={{padding: "4px", color: "var(--color-danger)", background: "transparent", border: "none", opacity: 0.55}}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.55"; }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Smart naming & categorization */}
      <div style={{ height: "100%", overflow: "hidden" }}>
        {selectedInboxFile ? (
          <div style={{height: "100%", display: "flex", flexDirection: "column", gap: "16px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "24px", overflow: "hidden"}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", flexShrink: 0}}>
              <div>
                <h3 className="card-title" style={{margin: 0}}>🏷️ 智能归档与命名</h3>
                <p className="card-desc" style={{marginTop: "4px"}}>针对当前选中的落地文件进行快速模板化更名与智能分类。</p>
              </div>
              <button
                onClick={() => setPreviewFile(selectedInboxFile)}
                className="btn"
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(129, 140, 248, 0.08)",
                  border: "1px solid rgba(129, 140, 248, 0.2)",
                  color: "var(--color-primary)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                👁️ 弹出预览
              </button>
            </div>

            <div style={{display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto", paddingRight: "4px", minHeight: 0}}>
              {/* Name template */}
              <div>
                <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>命名模版</label>
                <select 
                  value={selectedTemplate} 
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="input-field"
                >
                  {namingTemplates.map(tpl => (
                    <option key={tpl.key} value={tpl.key}>{tpl.label}</option>
                  ))}
                </select>
              </div>

              {/* Topic Name */}
              <div>
                <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>文档核心主题</label>
                <input 
                  type="text" 
                  placeholder="请输入主题词..."
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Template details conditional */}
              {selectedTemplate === "regular" && (
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
                  <div>
                    <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>版本号</label>
                    <input 
                      type="text" 
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>当前状态</label>
                    <select 
                      value={fileStatus} 
                      onChange={(e) => setFileStatus(e.target.value)}
                      className="input-field"
                    >
                      <option value="#待处理">#待处理</option>
                      <option value="#进行中">#进行中</option>
                      <option value="#已完成">#已完成</option>
                      <option value="#非常重要">#非常重要</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Recommended tags */}
              <div>
                <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>🤖 AI 推荐标签 (点击进行勾选或取消)</label>
                <div style={{display: "flex", flexWrap: "wrap", gap: "6px"}}>
                  {recommendedTags.map((tag, idx) => {
                    const isSelected = chosenTags.includes(tag);
                    return (
                      <span 
                        key={idx} 
                        onClick={() => {
                          if (isSelected) {
                            setChosenTags(chosenTags.filter(t => t !== tag));
                          } else {
                            setChosenTags([...chosenTags, tag]);
                          }
                        }}
                        className="badge"
                        style={{
                          cursor: "pointer", 
                          textTransform: "none", 
                          fontSize: "12px",
                          border: "1px solid var(--border-light)",
                          background: isSelected ? "var(--color-primary-glow)" : "rgba(255,255,255,0.02)",
                          color: isSelected ? "var(--color-primary)" : "var(--text-secondary)"
                        }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Custom Tags Input */}
              <div>
                <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>🏷️ 自定义追加标签</label>
                <div style={{display: "flex", gap: "8px"}}>
                  <input 
                    type="text" 
                    placeholder="追加新标签，如 #财务 敲回车或点击按钮"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!customTagInput.trim()) return;
                        const formatted = customTagInput.trim().startsWith("#") ? customTagInput.trim() : `#${customTagInput.trim()}`;
                        if (!chosenTags.includes(formatted)) {
                          setChosenTags([...chosenTags, formatted]);
                        }
                        setCustomTagInput("");
                      }
                    }}
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <button 
                    className="btn" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (!customTagInput.trim()) return;
                      const formatted = customTagInput.trim().startsWith("#") ? customTagInput.trim() : `#${customTagInput.trim()}`;
                      if (!chosenTags.includes(formatted)) {
                        setChosenTags([...chosenTags, formatted]);
                      }
                      setCustomTagInput("");
                    }}
                    style={{ padding: "8px 14px", flexShrink: 0 }}
                  >
                    追加
                  </button>
                </div>

                {/* Selected tags bubble display */}
                {chosenTags.length > 0 && (
                  <div style={{display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px", background: theme === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255,255,255,0.01)", padding: "8px", borderRadius: "8px", border: "1px solid var(--border-light)"}}>
                    {chosenTags.map((tag, idx) => (
                      <span 
                        key={idx} 
                        className="badge badge-success"
                        style={{cursor: "pointer", textTransform: "none", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px"}}
                      >
                        {tag}
                        <X size={13} onClick={() => setChosenTags(chosenTags.filter(t => t !== tag))} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Target Folder */}
              <div>
                <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>🚀 目标归档分类</label>
                <select 
                  value={standardDirs.includes(targetCategory) ? targetCategory : (standardDirs[1] || "")} 
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="input-field"
                >
                  {standardDirs.map((dir, idx) => (
                    <option key={idx} value={dir}>{dir}</option>
                  ))}
                </select>
                
                {/* 🤖 智能规则匹配快捷切换卡片 */}
                {(() => {
                  const match = getRuleMatch(selectedInboxFile.filename.toString(), autoRulesState);
                  if (!match || targetCategory === match.directory) return null;
                  return (
                    <div 
                      onClick={() => {
                        setTargetCategory(match.directory);
                        showToast(`已应用智能归档路径: ${match.directory}`, "success");
                      }}
                      style={{
                        marginTop: "10px",
                        background: theme === "light" ? "rgba(16, 185, 129, 0.06)" : "rgba(16, 185, 129, 0.08)",
                        border: "1px dashed rgba(16, 185, 129, 0.3)",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = theme === "light" ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.15)";
                        e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = theme === "light" ? "rgba(16, 185, 129, 0.06)" : "rgba(16, 185, 129, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.3)";
                      }}
                    >
                      <div style={{display: "flex", flexDirection: "column", gap: "2px", textAlign: "left"}}>
                        <span style={{fontSize: "11px", color: "#10b981", fontWeight: 600}}>🤖 智能投递建议 ({match.reason})</span>
                        <span style={{fontSize: "12px", color: "var(--text-secondary)"}}>建议分类至：<strong style={{color: "var(--text-primary)"}}>{match.directory}</strong></span>
                      </div>
                      <span style={{
                        fontSize: "10px", 
                        color: "#10b981", 
                        fontWeight: 600, 
                        border: "1px solid rgba(16, 185, 129, 0.25)", 
                        padding: "3px 8px", 
                        borderRadius: "6px", 
                        background: "rgba(16, 185, 129, 0.04)"
                      }}>
                        一键应用
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Remarks */}
              <div>
                <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>备注说明</label>
                <textarea 
                  placeholder="为此文件添加备注记录，以便检索..."
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="input-field"
                  rows={3}
                  style={{resize: "none"}}
                />
              </div>
            </div>

            {/* Preview Naming */}
            <div style={{background: theme === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255,255,255,0.02)", padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--border-light)", flexShrink: 0}}>
              <div style={{fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px"}}>更名预览</div>
              <div style={{fontSize: "13px", wordBreak: "break-all", fontWeight: 600, color: "var(--color-primary)", maxHeight: "72px", overflowY: "auto", paddingRight: "4px"}} title={getFormattedName(selectedInboxFile.filename.toString())}>
                {getFormattedName(selectedInboxFile.filename.toString())}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleArchiveFile} disabled={isArchiving} style={{width: "100%", justifyContent: "center", flexShrink: 0, opacity: isArchiving ? 0.7 : 1}}>
              {isArchiving ? "⏳ 归档中..." : "📁 执行智能归档搬运"}
            </button>
          </div>
        ) : (
          <div className="cyber-card" style={{maxHeight: "240px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed var(--border-light)", color: "var(--text-secondary)", padding: "32px 24px", textAlign: "center"}}>
            <Layers size={40} style={{color: "var(--text-muted)", marginBottom: "16px"}} />
            <h3 style={{fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px"}}>智能推荐面板</h3>
            <p style={{fontSize: "13px", lineHeight: "1.4"}}>请在左侧列表选中任意待处理文件，AI 语义算法将立即在此为您生成命名、同义推荐词及最优分类路径。</p>
          </div>
        )}
      </div>
    </div>
  );
}
