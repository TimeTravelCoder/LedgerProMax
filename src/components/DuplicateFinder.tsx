import { useState, useRef, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Trash2, Sparkles, RefreshCw, AlertCircle, CheckCircle, X } from "lucide-react";

interface FileRecord {
  filepath: String;
  filename: String;
  file_size: number;
  modified_time: number;
  tags: String;
  description: String;
  backup_disk_status: number;
  backup_cloud_status: number;
}

interface DuplicateFinderProps {
  workspaceDir: string;
  onRefreshWorkspace: () => void;
  addLog: (msg: string) => void;
  theme?: "dark" | "jade" | "light";
}

export default function DuplicateFinder({ workspaceDir, onRefreshWorkspace, addLog, theme = "dark" }: DuplicateFinderProps) {
  const [mode, setMode] = useState<"filename" | "size" | "hash">("filename");
  const [loading, setLoading] = useState<boolean>(false);
  const [duplicateGroups, setDuplicateGroups] = useState<Record<string, FileRecord[]>>({});
  const [checkedFiles, setCheckedFiles] = useState<string[]>([]); // Contains filepaths to be deleted
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  const [compareModalOpen, setCompareModalOpen] = useState<boolean>(false);
  const [compareGroup, setCompareGroup] = useState<FileRecord[]>([]);
  const [selectedFileA, setSelectedFileA] = useState<FileRecord | null>(null);
  const [selectedFileB, setSelectedFileB] = useState<FileRecord | null>(null);
  const [contentA, setContentA] = useState<string>("");
  const [contentB, setContentB] = useState<string>("");
  const [compareLoading, setCompareLoading] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string>("");

  const [imgScale, setImgScale] = useState<number>(1);
  const [imgOffset, setImgOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isImgDragging, setIsImgDragging] = useState<boolean>(false);
  const imgDragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isImageFile = (filename: string) => {
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
    return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".bmp"].includes(ext);
  };

  const isTextFile = (filename: string) => {
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
    return [".txt", ".md", ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".rs", ".html", ".sh", ".yml", ".yaml", ".ini", ".conf", ".cfg"].includes(ext);
  };

  const isDocxFile = (filename: string) => {
    return filename.toLowerCase().endsWith(".docx");
  };

  const handleOpenCompareModal = async (group: FileRecord[]) => {
    setCompareGroup(group);
    const fileA = group[0];
    const fileB = group[1];
    setSelectedFileA(fileA);
    setSelectedFileB(fileB);
    setCompareModalOpen(true);
    setCompareError("");
    setImgScale(1);
    setImgOffset({ x: 0, y: 0 });
    
    await fetchCompareContents(fileA, fileB);
  };

  const fetchCompareContents = async (fileA: FileRecord, fileB: FileRecord) => {
    setContentA("");
    setContentB("");
    setCompareError("");
    
    const nameA = fileA.filename.toString();
    const nameB = fileB.filename.toString();
    
    if (isImageFile(nameA) && isImageFile(nameB)) {
      return;
    }
    
    if (isTextFile(nameA) || isDocxFile(nameA)) {
      setCompareLoading(true);
      try {
        let textA = "";
        let textB = "";
        
        if (isDocxFile(nameA)) {
          textA = await invoke("read_docx_text", { workspaceDir, filepath: fileA.filepath });
        } else {
          textA = await invoke("read_file_content", { workspaceDir, filepath: fileA.filepath });
        }
        
        if (isDocxFile(nameB)) {
          textB = await invoke("read_docx_text", { workspaceDir, filepath: fileB.filepath });
        } else {
          textB = await invoke("read_file_content", { workspaceDir, filepath: fileB.filepath });
        }
        
        setContentA(textA);
        setContentB(textB);
      } catch (err: any) {
        console.error(err);
        setCompareError(`无法加载文件内容以进行比对: ${err}`);
      } finally {
        setCompareLoading(false);
      }
    }
  };

  const log = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    setLogs(prev => [...prev, formatted]);
    addLog(msg);
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const handleScan = async () => {
    setLoading(true);
    setCheckedFiles([]);
    setHasScanned(true);
    try {
      log(`开始执行查重扫描，模式: ${mode === "filename" ? "文件名" : mode === "size" ? "文件大小" : "SHA-256 哈希值"}`);
      const groups: Record<string, FileRecord[]> = await invoke("find_duplicates", { mode, workspaceDir });
      setDuplicateGroups(groups);
      
      const countGroups = Object.keys(groups).length;
      let countFiles = 0;
      Object.values(groups).forEach(g => { countFiles += g.length; });
      
      log(`查重扫描完成！发现 ${countGroups} 组重复文件，共计 ${countFiles} 个拷贝。`);
    } catch (err: any) {
      console.error(err);
      log(`[错误] 查重失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Keep the newest file in each group (the latest modified copy) and mark all other older copies for deletion.
  const handleAutoSelect = () => {
    const toDelete: string[] = [];
    Object.values(duplicateGroups).forEach(group => {
      if (group.length <= 1) return;
      
      // Sort group: newest first (maximum modified_time descending)
      const sorted = [...group].sort((a, b) => b.modified_time - a.modified_time);
      // Keep the first (newest, index 0), mark all older ones (index >= 1) for deletion
      for (let i = 1; i < sorted.length; i++) {
        toDelete.push(sorted[i].filepath.toString());
      }
    });
    setCheckedFiles(toDelete);
    log(`智能推荐勾选完成！已遵循【保留最新修改版本】原则推荐选中 ${toDelete.length} 个较旧的多余副本。`);
  };

  const handleToggleCheck = (filepath: string) => {
    if (checkedFiles.includes(filepath)) {
      setCheckedFiles(checkedFiles.filter(f => f !== filepath));
    } else {
      setCheckedFiles([...checkedFiles, filepath]);
    }
  };

  const handleDeleteChecked = async () => {
    if (checkedFiles.length === 0 || loading) return;
    const confirmMsg = `确定要永久删除这 ${checkedFiles.length} 个重复的冗余文件吗？此操作不可逆！`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    let deletedCount = 0;
    let errorCount = 0;
    const failedPaths: string[] = [];

    for (const filepath of checkedFiles) {
      try {
        await invoke("delete_file", { workspaceDir, filepath });
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete duplicate ${filepath}:`, err);
        errorCount++;
        failedPaths.push(filepath);
      }
    }

    log(`重复清理完毕！成功清理 ${deletedCount} 个副本文件${errorCount > 0 ? `，失败 ${errorCount} 个` : ""}`);
    if (failedPaths.length > 0) {
      log(`[警告] 以下 ${failedPaths.length} 个重复文件删除失败:`);
      failedPaths.forEach(p => log(` - ${p}`));
    }
    setCheckedFiles([]);
    
    // Rescan duplicates after cleanup
    await handleScan();
    onRefreshWorkspace();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const groupKeys = Object.keys(duplicateGroups);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "24px" }}>
      <div>
        <h3 className="card-title">👯 智能查重清理中心</h3>
        <p className="card-desc" style={{ marginTop: "4px" }}>
          在工作空间中精确扫描重复的文档副本，腾出宝贵的磁盘存储空间。
        </p>
      </div>

      {/* Mode selection block */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>查重维度:</span>
        <div style={{ display: "flex", gap: "6px", flex: 1 }}>
          <button
            onClick={() => setMode("filename")}
            className={`btn ${mode === "filename" ? "btn-primary" : ""}`}
            style={{ padding: "6px 12px", fontSize: "12px", flex: 1, justifyContent: "center" }}
          >
            文件名匹配
          </button>
          <button
            onClick={() => setMode("size")}
            className={`btn ${mode === "size" ? "btn-primary" : ""}`}
            style={{ padding: "6px 12px", fontSize: "12px", flex: 1, justifyContent: "center" }}
          >
            文件大小匹配
          </button>
          <button
            onClick={() => setMode("hash")}
            className={`btn ${mode === "hash" ? "btn-primary" : ""}`}
            style={{ padding: "6px 12px", fontSize: "12px", flex: 1, justifyContent: "center" }}
          >
            SHA-256 强一致哈希
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleScan}
          disabled={loading}
          className="btn btn-primary"
          style={{ flex: 1, justifyContent: "center", padding: "10px" }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} style={{ marginRight: "6px" }} />
          <span>开始查重扫描</span>
        </button>

        {groupKeys.length > 0 && (
          <button
            onClick={handleAutoSelect}
            className="btn"
            style={{ borderColor: "var(--color-warning)", color: "var(--color-warning)", flex: 1, justifyContent: "center" }}
          >
            <Sparkles size={14} style={{ marginRight: "6px" }} />
            <span>智能一键勾选</span>
          </button>
        )}
      </div>

      {/* Scanning Content Grid */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "4px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", color: "var(--text-secondary)" }}>
            <div className="spinner" style={{ marginBottom: "12px" }} />
            <p style={{ fontSize: "13px" }}>正在进行深度磁盘比对扫描，请稍候...</p>
          </div>
        ) : groupKeys.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", borderRadius: "12px", padding: "20px", textAlign: "center" }}>
            {hasScanned ? (
              <>
                <CheckCircle size={36} style={{ color: "var(--color-success)", marginBottom: "12px" }} />
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>太棒了，没有发现重复文档！</h4>
                <p style={{ fontSize: "12px", marginTop: "4px" }}>工作空间保持在极优健康度状态下运行。</p>
              </>
            ) : (
              <>
                <AlertCircle size={32} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>待开始查重比对</h4>
                <p style={{ fontSize: "12px", marginTop: "4px" }}>点击上方按钮选择规则维度进行扫描。</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {groupKeys.map((groupKey, groupIdx) => {
              const group = duplicateGroups[groupKey];
              const displayKey = mode === "hash" ? `HASH: ${groupKey.substring(0, 16)}...` : mode === "size" ? `大小: ${formatSize(parseFloat(groupKey))}` : `文件名: ${groupKey}`;

              return (
                <div
                  key={groupIdx}
                  style={{
                    background: theme === "light" ? "var(--bg-secondary)" : "rgba(255,255,255,0.015)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  {/* Group header */}
                  <div
                    style={{
                      background: theme === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255,255,255,0.03)",
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-primary)",
                      borderBottom: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "8px" }}>{displayKey}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <span className="badge badge-warning" style={{ fontSize: "10px" }}>{group.length} 个副本</span>
                      {group.length >= 2 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCompareModal(group);
                          }}
                          style={{
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "rgba(167, 139, 250, 0.08)",
                            border: "1px solid rgba(167, 139, 250, 0.2)",
                            color: "#a78bfa",
                            cursor: "pointer",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(167, 139, 250, 0.18)";
                            e.currentTarget.style.boxShadow = "0 0 6px rgba(167, 139, 250, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(167, 139, 250, 0.08)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          <span>👯</span>
                          <span>并列比对</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* List of files in group */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {group.map((file, fileIdx) => {
                      const isChecked = checkedFiles.includes(file.filepath.toString());
                      return (
                        <div
                          key={fileIdx}
                          onClick={() => handleToggleCheck(file.filepath.toString())}
                          style={{
                            padding: "10px 12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "12px",
                            cursor: "pointer",
                            background: isChecked ? "rgba(239, 68, 68, 0.03)" : "transparent",
                            borderBottom: fileIdx < group.length - 1 ? "1px solid var(--border-light)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Controlled click is handled by parent div onClick
                              style={{ pointerEvents: "none", cursor: "pointer" }}
                            />
                            <div style={{ overflow: "hidden" }}>
                              <div style={{ fontWeight: 500, color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{file.filepath}</div>
                              <div style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "2px" }}>
                                修改时间: {new Date(file.modified_time * 1000).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)", flexShrink: 0, marginLeft: "10px" }}>
                            {formatSize(file.file_size)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sleek Dark Glassmorphic Logs Terminal Console */}
      <div 
        style={{
          background: "rgba(0, 0, 0, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "10px",
          padding: "12px",
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#34d399",
          height: "120px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.5)",
          flexShrink: 0
        }}
      >
        <div style={{ color: "#a78bfa", fontWeight: "bold", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px", marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
          <span>💻 查重控制台日志终端</span>
          <span style={{ color: "var(--text-muted)", fontWeight: "normal", cursor: "pointer" }} onClick={() => setLogs([])}>清空</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {logs.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>[系统] 终端空闲中，等待查重扫描指令下达...</div>
          ) : (
            logs.map((item, index) => (
              <div key={index} style={{ wordBreak: "break-all", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                {item}
              </div>
            ))
          )}
          <div ref={logRef} />
        </div>
      </div>

      {/* Delete checked duplicates button */}
      {checkedFiles.length > 0 && (
        <button
          onClick={handleDeleteChecked}
          disabled={loading}
          className="btn"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgba(239, 68, 68, 0.3)",
            color: theme === "light" ? "var(--color-danger)" : "#f87171",
            width: "100%",
            justifyContent: "center",
            padding: "10px",
            boxShadow: "0 0 12px rgba(239, 68, 68, 0.2)",
          }}
        >
          <Trash2 size={14} style={{ marginRight: "6px" }} />
          <span>永久删除选中的 {checkedFiles.length} 个冗余文件</span>
        </button>
      )}

      {/* Full screen glassmorphic comparison modal */}
      {compareModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(12px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }}>
          <div style={{
            width: "95vw",
            height: "90vh",
            background: "rgba(10, 11, 16, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              flexShrink: 0,
              background: "rgba(255, 255, 255, 0.02)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "20px" }}>👯</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>双屏并列比对校验</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>深度校验重复副本的异同，协助决定取舍。</p>
                </div>
              </div>

              {/* Selector dropdowns */}
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>文件 A (对比基底):</span>
                  <select
                    value={selectedFileA?.filepath.toString()}
                    onChange={async (e) => {
                      const file = compareGroup.find(f => f.filepath.toString() === e.target.value);
                      if (file && selectedFileB) {
                        setSelectedFileA(file);
                        await fetchCompareContents(file, selectedFileB);
                      }
                    }}
                    style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", fontSize: "11px", maxWidth: "200px" }}
                  >
                    {compareGroup.map((f, fi) => (
                      <option key={fi} value={f.filepath.toString()}>{f.filename.substring(0, 15)} ({formatSize(f.file_size)})</option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>🆚</span>
                <div>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginBottom: "2px" }}>文件 B (比对副本):</span>
                  <select
                    value={selectedFileB?.filepath.toString()}
                    onChange={async (e) => {
                      const file = compareGroup.find(f => f.filepath.toString() === e.target.value);
                      if (file && selectedFileA) {
                        setSelectedFileB(file);
                        await fetchCompareContents(selectedFileA, file);
                      }
                    }}
                    style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", fontSize: "11px", maxWidth: "200px" }}
                  >
                    {compareGroup.map((f, fi) => (
                      <option key={fi} value={f.filepath.toString()}>{f.filename.substring(0, 15)} ({formatSize(f.file_size)})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setCompareModalOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "16px 24px", minHeight: 0 }}>
              {compareLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-secondary)" }}>
                  <div className="spinner" style={{ marginBottom: "12px" }} />
                  <span>正在深度加载文件内容，解析差异节点...</span>
                </div>
              ) : compareError ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--color-danger)" }}>
                  <AlertCircle size={32} style={{ marginBottom: "12px" }} />
                  <span>{compareError}</span>
                </div>
              ) : selectedFileA && selectedFileB ? (
                (() => {
                  const nameA = selectedFileA.filename.toString();
                  const nameB = selectedFileB.filename.toString();
                  
                  if (isImageFile(nameA) && isImageFile(nameB)) {
                    const imgUrlA = convertFileSrc(`${workspaceDir}/${selectedFileA.filepath}`.replace(/[/\\]+/g, "/"));
                    const imgUrlB = convertFileSrc(`${workspaceDir}/${selectedFileB.filepath}`.replace(/[/\\]+/g, "/"));
                    
                    return (
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", gap: "10px" }}>
                        <div style={{ fontSize: "11px", color: "#fbbf24", background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "6px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>💡 提示：</span>
                          <span>在下方图像区上使用<b>鼠标滚轮</b>可同步放大/缩小两张图片，<b>拖拽</b>任意位置可同步平移比对细节。</span>
                        </div>
                        <div
                          onWheel={(e) => {
                            const zoomFactor = 0.15;
                            let newScale = imgScale + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
                            newScale = Math.max(0.4, Math.min(newScale, 6));
                            setImgScale(newScale);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIsImgDragging(true);
                            imgDragStart.current = { x: e.clientX - imgOffset.x, y: e.clientY - imgOffset.y };
                          }}
                          onMouseMove={(e) => {
                            if (!isImgDragging) return;
                            setImgOffset({
                              x: e.clientX - imgDragStart.current.x,
                              y: e.clientY - imgDragStart.current.y
                            });
                          }}
                          onMouseUp={() => setIsImgDragging(false)}
                          onMouseLeave={() => setIsImgDragging(false)}
                          style={{
                            flex: 1,
                            display: "flex",
                            gap: "16px",
                            overflow: "hidden",
                            borderRadius: "10px",
                            background: "#050608",
                            border: "1px solid rgba(255,255,255,0.05)"
                          }}
                        >
                          {/* File A Image */}
                          <div style={{ flex: 1, borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
                            <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10, background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", border: "1px solid rgba(255,255,255,0.1)" }}>
                              基准 A: {selectedFileA.filepath}
                            </div>
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              <img
                                src={imgUrlA}
                                alt="File A"
                                style={{
                                  maxHeight: "90%",
                                  maxWidth: "90%",
                                  objectFit: "contain",
                                  transform: `scale(${imgScale}) translate(${imgOffset.x / imgScale}px, ${imgOffset.y / imgScale}px)`,
                                  transformOrigin: "center center",
                                  cursor: isImgDragging ? "grabbing" : "grab",
                                  userSelect: "none"
                                }}
                              />
                            </div>
                          </div>

                          {/* File B Image */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
                            <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10, background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", border: "1px solid rgba(255,255,255,0.1)" }}>
                              副本 B: {selectedFileB.filepath}
                            </div>
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              <img
                                src={imgUrlB}
                                alt="File B"
                                style={{
                                  maxHeight: "90%",
                                  maxWidth: "90%",
                                  objectFit: "contain",
                                  transform: `scale(${imgScale}) translate(${imgOffset.x / imgScale}px, ${imgOffset.y / imgScale}px)`,
                                  transformOrigin: "center center",
                                  cursor: isImgDragging ? "grabbing" : "grab",
                                  userSelect: "none"
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  if (isTextFile(nameA) || isDocxFile(nameA)) {
                    const linesA = contentA.split(/\r?\n/);
                    const linesB = contentB.split(/\r?\n/);
                    const maxLines = Math.max(linesA.length, linesB.length);
                    const lineDivs = [];
                    
                    for (let i = 0; i < maxLines; i++) {
                      const lA = linesA[i];
                      const lB = linesB[i];
                      const isDifferent = lA !== lB;
                      
                      lineDivs.push(
                        <div key={i} style={{ display: "flex", fontSize: "11px", fontFamily: "monospace", borderBottom: "1px solid rgba(255,255,255,0.02)", minHeight: "20px" }}>
                          {/* Pane A line */}
                          <div style={{
                            flex: 1,
                            padding: "2px 8px",
                            background: isDifferent && lA !== undefined ? "rgba(239, 68, 68, 0.12)" : "transparent",
                            color: isDifferent && lA !== undefined ? "#f87171" : "rgba(255,255,255,0.85)",
                            borderRight: "1px solid rgba(255,255,255,0.06)",
                            wordBreak: "break-all",
                            whiteSpace: "pre-wrap"
                          }}>
                            <span style={{ color: "rgba(255,255,255,0.2)", marginRight: "8px", display: "inline-block", width: "28px", textAlign: "right", userSelect: "none" }}>{i + 1}</span>
                            {lA !== undefined ? lA : ""}
                          </div>
                          
                          {/* Pane B line */}
                          <div style={{
                            flex: 1,
                            padding: "2px 8px",
                            background: isDifferent && lB !== undefined ? "rgba(16, 185, 129, 0.12)" : "transparent",
                            color: isDifferent && lB !== undefined ? "#34d399" : "rgba(255,255,255,0.85)",
                            wordBreak: "break-all",
                            whiteSpace: "pre-wrap"
                          }}>
                            <span style={{ color: "rgba(255,255,255,0.2)", marginRight: "8px", display: "inline-block", width: "28px", textAlign: "right", userSelect: "none" }}>{i + 1}</span>
                            {lB !== undefined ? lB : ""}
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", gap: "10px" }}>
                        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", borderTopLeftRadius: "10px", borderTopRightRadius: "10px", flexShrink: 0 }}>
                          <div style={{ flex: 1, padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#818cf8", borderRight: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            基准 A: {selectedFileA.filepath}
                          </div>
                          <div style={{ flex: 1, padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#34d399", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            副本 B: {selectedFileB.filepath}
                          </div>
                        </div>
                        <div style={{ display: "flex", flex: 1, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none", borderBottomLeftRadius: "10px", borderBottomRightRadius: "10px", background: "#050608", flexDirection: "column" }}>
                          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
                            {lineDivs}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Fallback: Non-previewable metadata comparison
                  return (
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto", justifyContent: "center", alignItems: "center" }}>
                      <div style={{
                        width: "80%",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "12px",
                        padding: "24px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)"
                      }}>
                        <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: 600, color: "#fbbf24", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px" }}>
                          📦 二进制/非文本介质属性差异比对
                        </h4>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "left" }}>
                              <th style={{ padding: "8px", color: "var(--text-muted)" }}>属性项</th>
                              <th style={{ padding: "8px", color: "#818cf8" }}>文件 A</th>
                              <th style={{ padding: "8px", color: "#34d399" }}>文件 B</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-muted)" }}>绝对路径</td>
                              <td style={{ padding: "10px 8px", color: "#f87171", wordBreak: "break-all" }}>{selectedFileA.filepath}</td>
                              <td style={{ padding: "10px 8px", color: "#34d399", wordBreak: "break-all" }}>{selectedFileB.filepath}</td>
                            </tr>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-muted)" }}>文件大小</td>
                              <td style={{ padding: "10px 8px", fontWeight: 600 }}>{formatSize(selectedFileA.file_size)}</td>
                              <td style={{ padding: "10px 8px", fontWeight: 600, color: selectedFileA.file_size !== selectedFileB.file_size ? "#fbbf24" : "inherit" }}>
                                {formatSize(selectedFileB.file_size)}
                              </td>
                            </tr>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-muted)" }}>最后修改时间</td>
                              <td style={{ padding: "10px 8px" }}>{new Date(selectedFileA.modified_time * 1000).toLocaleString()}</td>
                              <td style={{ padding: "10px 8px" }}>{new Date(selectedFileB.modified_time * 1000).toLocaleString()}</td>
                            </tr>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-muted)" }}>标签池</td>
                              <td style={{ padding: "10px 8px" }}>{selectedFileA.tags || "(无)"}</td>
                              <td style={{ padding: "10px 8px" }}>{selectedFileB.tags || "(无)"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>

            {/* Footer with safety actions */}
            {selectedFileA && selectedFileB && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(0,0,0,0.3)",
                flexShrink: 0
              }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  💡 温馨提示: 深度比对能极佳防范误删，请谨慎决策。
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`确定要永久物理删除基准 A: ${selectedFileA.filepath} 吗？`)) return;
                      setCompareModalOpen(false);
                      setLoading(true);
                      try {
                        await invoke("delete_file", { workspaceDir, filepath: selectedFileA.filepath });
                        log(`[比对删除] 成功物理清理基准 A: ${selectedFileA.filepath}`);
                      } catch (err) {
                        log(`[比对删除] [错误] 删除基准 A 失败: ${err}`);
                      }
                      await handleScan();
                      onRefreshWorkspace();
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    🗑️ 物理删除 A
                  </button>

                  <button
                    onClick={async () => {
                      if (!window.confirm(`确定要永久物理删除副本 B: ${selectedFileB.filepath} 吗？`)) return;
                      setCompareModalOpen(false);
                      setLoading(true);
                      try {
                        await invoke("delete_file", { workspaceDir, filepath: selectedFileB.filepath });
                        log(`[比对删除] 成功物理清理副本 B: ${selectedFileB.filepath}`);
                      } catch (err) {
                        log(`[比对删除] [错误] 删除副本 B 失败: ${err}`);
                      }
                      await handleScan();
                      onRefreshWorkspace();
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    🗑️ 物理删除 B
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
