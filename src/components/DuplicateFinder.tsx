import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, Sparkles, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";

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

  const handleScan = async () => {
    setLoading(true);
    setCheckedFiles([]);
    setHasScanned(true);
    try {
      addLog(`开始执行查重扫描，模式: ${mode === "filename" ? "文件名" : mode === "size" ? "文件大小" : "SHA-256 哈希值"}`);
      const groups: Record<string, FileRecord[]> = await invoke("find_duplicates", { mode, workspaceDir });
      setDuplicateGroups(groups);
      
      const countGroups = Object.keys(groups).length;
      let countFiles = 0;
      Object.values(groups).forEach(g => { countFiles += g.length; });
      
      addLog(`查重扫描完成！发现 ${countGroups} 组重复文件，共计 ${countFiles} 个拷贝。`);
    } catch (err: any) {
      console.error(err);
      addLog(`[错误] 查重失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Keep the oldest file in each group, check all other newer copies for deletion
  const handleAutoSelect = () => {
    const toDelete: string[] = [];
    Object.values(duplicateGroups).forEach(group => {
      if (group.length <= 1) return;
      
      // Sort group: oldest first (minimum modified_time)
      const sorted = [...group].sort((a, b) => a.modified_time - b.modified_time);
      // Keep the first (oldest), mark the rest for deletion
      for (let i = 1; i < sorted.length; i++) {
        toDelete.push(sorted[i].filepath.toString());
      }
    });
    setCheckedFiles(toDelete);
    addLog(`智能推荐勾选完成！已推荐选中 ${toDelete.length} 个冗余多余副本。`);
  };

  const handleToggleCheck = (filepath: string) => {
    if (checkedFiles.includes(filepath)) {
      setCheckedFiles(checkedFiles.filter(f => f !== filepath));
    } else {
      setCheckedFiles([...checkedFiles, filepath]);
    }
  };

  const handleDeleteChecked = async () => {
    if (checkedFiles.length === 0) return;
    const confirmMsg = `确定要永久删除这 ${checkedFiles.length} 个重复的冗余文件吗？此操作不可逆！`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    let deletedCount = 0;
    let errorCount = 0;

    for (const filepath of checkedFiles) {
      try {
        await invoke("delete_file", { workspaceDir, filepath });
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete duplicate ${filepath}:`, err);
        errorCount++;
      }
    }

    addLog(`重复清理完毕！成功清理 ${deletedCount} 个副本文件${errorCount > 0 ? `，失败 ${errorCount} 个` : ""}`);
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
              const displayKey = mode === "hash" ? `HASH: ${groupKey.substring(0, 16)}...` : mode === "size" ? `大小: ${formatSize(parseInt(groupKey))}` : `文件名: ${groupKey}`;

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
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayKey}</span>
                    <span className="badge badge-warning" style={{ fontSize: "10px" }}>{group.length} 个副本</span>
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

      {/* Delete checked duplicates button */}
      {checkedFiles.length > 0 && (
        <button
          onClick={handleDeleteChecked}
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
    </div>
  );
}
