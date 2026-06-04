import { useState, useEffect } from "react";
import { 
  FolderOpen, 
  Search, 
  X, 
  Archive, 
  FolderPlus, 
  FileText, 
  ChevronRight, 
  HardDrive, 
  Cloud, 
  Clipboard, 
  Trash2 
} from "lucide-react";
import type { FileRecord } from "../../types";
import { formatSize, getFileIcon } from "../../utils/fileUtils";
import { invoke } from "@tauri-apps/api/core";

interface WorkspacePageProps {
  theme: "dark" | "light";
  workspaceFiles: FileRecord[];
  allWorkspaceFiles: FileRecord[];
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  selectedTagsFilter: string[];
  setSelectedTagsFilter: (tags: string[]) => void;
  extensionFilter: string;
  setExtensionFilter: (ext: string) => void;
  tagDistribution: Record<string, number>;
  standardDirs: string[];
  workspaceDir: string;
  createFolderRoot: string;
  createFileRoot: string;
  setIsCreateFolderExpanded: (expanded: boolean) => void;
  setIsCreateFileExpanded: (expanded: boolean) => void;
  handleDeleteFile: (filepath: string) => void;
  selectedWorkspaceFile: FileRecord | null;
  setSelectedWorkspaceFile: (file: FileRecord | null) => void;
  setPreviewFile: (file: FileRecord | null) => void;
  addLog: (log: string) => void;
  showToast: (msg: string, type: "success" | "warning" | "error" | "info") => void;
  setShowZipModal: (show: boolean) => void;
  checkedWorkspaceFiles: string[];
  setCheckedWorkspaceFiles: (files: string[]) => void;
  setContextMenu: (menu: { show: boolean; x: number; y: number; file: FileRecord | null }) => void;
  handleScanWorkspace: () => Promise<void>;
}

export default function WorkspacePage({
  theme,
  workspaceFiles,
  allWorkspaceFiles,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  selectedTagsFilter,
  setSelectedTagsFilter,
  extensionFilter,
  setExtensionFilter,
  tagDistribution,
  standardDirs,
  workspaceDir,
  createFolderRoot,
  createFileRoot,
  setIsCreateFolderExpanded,
  setIsCreateFileExpanded,
  handleDeleteFile,
  selectedWorkspaceFile,
  setSelectedWorkspaceFile,
  setPreviewFile,
  addLog,
  showToast,
  setShowZipModal,
  checkedWorkspaceFiles,
  setCheckedWorkspaceFiles,
  setContextMenu,
  handleScanWorkspace
}: WorkspacePageProps) {
  // Localized view & layout states
  const [sortMethod, setSortMethod] = useState<"time_desc" | "time_asc" | "size_desc" | "size_asc" | "name_asc" | "name_desc">("time_desc");
  const [workspaceViewMode, setWorkspaceViewMode] = useState<"list" | "grid">("list");
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [listRenderLimit, setListRenderLimit] = useState(50);
  const [hoveredFileIdx, setHoveredFileIdx] = useState<number | null>(null);

  // Metadata editor states
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editDescriptionInput, setEditDescriptionInput] = useState("");
  const [editTagsInput, setEditTagsInput] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState("");

  // Reset limit when query or filter changes
  useEffect(() => {
    setListRenderLimit(50);
  }, [searchQuery, selectedCategory, selectedTagsFilter, statusFilter, extensionFilter]);

  // Sync editor input if selected workspace file changes
  useEffect(() => {
    if (selectedWorkspaceFile) {
      setEditDescriptionInput(selectedWorkspaceFile.description?.toString() || "");
      setEditTagsInput(selectedWorkspaceFile.tags || []);
      setIsEditingMetadata(false);
      setNewTagText("");
    } else {
      setEditDescriptionInput("");
      setEditTagsInput([]);
      setIsEditingMetadata(false);
      setNewTagText("");
    }
  }, [selectedWorkspaceFile]);

  // Save Metadata Execute
  const handleSaveMetadata = async () => {
    if (!selectedWorkspaceFile) return;
    try {
      const filepath = selectedWorkspaceFile.filepath.toString();
      
      // 1. Save Description
      await invoke("update_file_description", {
        workspaceDir,
        filepath,
        description: editDescriptionInput.trim()
      });

      // 2. Save Tags
      const cleanedTags = editTagsInput.map(t => t.trim()).filter(t => t.length > 0);
      await invoke("update_file_tags", {
        workspaceDir,
        filepath,
        tags: cleanedTags
      });

      showToast("文档元数据修改成功！", "success");
      addLog(`元数据修改成功: ${selectedWorkspaceFile.filename}`);
      setIsEditingMetadata(false);

      // 3. Atomically update local select target and refresh search list
      const updatedFile = {
        ...selectedWorkspaceFile,
        description: editDescriptionInput.trim(),
        tags: cleanedTags
      };
      setSelectedWorkspaceFile(updatedFile);
      await handleScanWorkspace();
    } catch (err: any) {
      showToast(`保存失败: ${err.toString()}`, "error");
      addLog(`[错误] 元数据保存失败: ${err.toString()}`);
    }
  };

  const sortedWorkspaceFiles = [...workspaceFiles].sort((a, b) => {
    switch (sortMethod) {
      case "time_desc":
        return b.modified_time - a.modified_time;
      case "time_asc":
        return a.modified_time - b.modified_time;
      case "size_desc":
        return b.file_size - a.file_size;
      case "size_asc":
        return a.file_size - b.file_size;
      case "name_asc":
        return a.filename.toString().localeCompare(b.filename.toString());
      case "name_desc":
        return b.filename.toString().localeCompare(a.filename.toString());
      default:
        return 0;
    }
  });

  return (
    <div style={{display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) 320px", gap: "16px", height: "100%"}}>
      {/* Left Column: Folders / Categories */}
      <div className="workspace-left-rail">
        <div className="workspace-tree-header">
          <h3 style={{fontSize: "14px", fontWeight: 700, color: "var(--text-primary)"}}>分类目录树</h3>
          <button 
            className="btn" 
            onClick={() => setSelectedCategory(null)} 
            style={{
              padding: "4px 8px", 
              fontSize: "11px",
              background: !selectedCategory ? "var(--color-primary-glow)" : "rgba(255,255,255,0.02)",
              borderColor: !selectedCategory ? "var(--color-primary)" : "var(--border-light)",
              color: !selectedCategory ? "var(--color-primary)" : "var(--text-secondary)"
            }}
          >
            全部
          </button>
        </div>
        
        {/* Standard Folders Tree */}
        <div className="workspace-tree-list">
          {standardDirs.map((dir, idx) => {
            const match = dir.match(/^(\d+)(.*)$/);
            const num = match ? match[1] : "";
            const name = match ? match[2].trim() : dir;
            const count = allWorkspaceFiles.filter(f => {
              const normalizedPath = (f.filepath as string).replace(/\\/g, "/");
              return normalizedPath.startsWith(dir + "/");
            }).length;
            
            const gradients = [
              "linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)", // Indogo
              "linear-gradient(135deg, #34d399 0%, #059669 100%)", // Jade
              "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)", // Amber
              "linear-gradient(135deg, #f87171 0%, #dc2626 100%)", // Red
              "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)", // Purple
              "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)", // Orange
            ];
            const numBg = gradients[idx % gradients.length];
            const isSelected = selectedCategory === dir;

            return (
              <div 
                key={idx}
                onClick={() => setSelectedCategory(dir)}
                className={`menu-item`}
                style={{
                  padding: "6px 10px", 
                  borderRadius: "8px",
                  fontSize: "13px",
                  background: isSelected 
                    ? "var(--color-primary-glow)" 
                    : "transparent",
                  color: isSelected ? "var(--color-primary)" : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                  border: isSelected ? "1px solid rgba(129, 140, 248, 0.25)" : "1px solid transparent",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {num && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: numBg,
                    color: "#fff",
                    fontSize: "9px",
                    fontWeight: 800,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
                    flexShrink: 0
                  }}>
                    {num}
                  </span>
                )}
                <span style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontWeight: isSelected ? 600 : 400}}>
                  {name}
                </span>
                <span style={{
                  fontSize: "10px",
                  padding: "1px 5px",
                  borderRadius: "99px",
                  background: isSelected ? "var(--color-primary)" : (theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255, 255, 255, 0.05)"),
                  color: isSelected ? "#fff" : "var(--text-muted)",
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        <div className="workspace-create-stack" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            className="btn"
            onClick={() => setIsCreateFolderExpanded(true)}
            style={{
              background: theme === "light" ? "#f8fafc" : "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-light)",
              padding: "10px 14px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = theme === "light" ? "0 6px 16px rgba(59, 130, 246, 0.08)" : "0 6px 16px rgba(59, 130, 246, 0.16)";
              e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--border-light)";
            }}
          >
            <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
              <div style={{background: "rgba(59, 130, 246, 0.08)", color: "#3b82f6", padding: "10px", borderRadius: "10px"}}>
                <FolderPlus size={18} />
              </div>
              <div style={{textAlign: "left"}}>
                <div style={{fontWeight: 600, fontSize: "14px", color: "var(--text-primary)"}}>新建子目录</div>
                <div style={{fontSize: "12px", color: "var(--text-muted)", marginTop: "2px"}}>{createFolderRoot.replace(/^\d+/, "") || "选择分类"}</div>
              </div>
            </div>
            <ChevronRight size={16} style={{color: "var(--text-muted)"}} />
          </button>

          <button
            className="btn"
            onClick={() => setIsCreateFileExpanded(true)}
            style={{
              background: theme === "light" ? "#f8fafc" : "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-light)",
              padding: "10px 14px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = theme === "light" ? "0 6px 16px rgba(16, 185, 129, 0.08)" : "0 6px 16px rgba(16, 185, 129, 0.16)";
              e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--border-light)";
            }}
          >
            <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
              <div style={{background: "rgba(16, 185, 129, 0.08)", color: "#10b981", padding: "10px", borderRadius: "10px"}}>
                <FileText size={18} />
              </div>
              <div style={{textAlign: "left"}}>
                <div style={{fontWeight: 600, fontSize: "14px", color: "var(--text-primary)"}}>新建文件</div>
                <div style={{fontSize: "12px", color: "var(--text-muted)", marginTop: "2px"}}>{createFileRoot.replace(/^\d+/, "") || "选择分类"}</div>
              </div>
            </div>
            <ChevronRight size={16} style={{color: "var(--text-muted)"}} />
          </button>
        </div>

        {/* storage snapshot dashboard */}
        <div className="workspace-storage-card" style={{
          padding: "12px 14px", 
          display: "flex", 
          flexDirection: "column", 
          gap: "8px", 
          background: theme === "light" ? "rgba(99, 102, 241, 0.02)" : "rgba(129, 140, 248, 0.03)", 
          border: "1px dashed var(--border-light)",
          borderRadius: "10px"
        }}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px"}}>
            <span style={{color: "var(--text-muted)"}}>存储概览</span>
            <span style={{color: "var(--color-success)", fontWeight: 700}}>安全运行中</span>
          </div>
          <div style={{height: "6px", background: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)", borderRadius: "99px", overflow: "hidden"}}>
            <div style={{
              width: `${Math.min(100, Math.round((sortedWorkspaceFiles.length / 500) * 100))}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 100%)",
              borderRadius: "99px"
            }} />
          </div>
          <div style={{display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)"}}>
            <span>总文档: {sortedWorkspaceFiles.length} / 500 个</span>
            <span>备份率: {allWorkspaceFiles.length > 0 ? Math.round((allWorkspaceFiles.filter(f => f.backup_disk_status === 1 || f.backup_cloud_status === 1).length / allWorkspaceFiles.length) * 100) : 0}%</span>
          </div>
        </div>
      </div>

      {/* Middle Column: Files search & results list */}
      <div style={{display: "flex", flexDirection: "column", gap: "20px", minHeight: 0, flex: 1}}>
        {/* Search Bar & Multi-select Toggle */}
        <div style={{display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap"}}>
          <div style={{
            position: "relative", 
            flex: "1 1 280px", 
            background: theme === "light" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.2)",
            borderRadius: "99px",
            boxShadow: theme === "light" ? "0 4px 14px rgba(0,0,0,0.03)" : "0 4px 14px rgba(0,0,0,0.1)",
            border: "1px solid var(--border-light)",
            display: "flex",
            alignItems: "center",
            padding: "2px",
            transition: "all 0.3s ease"
          }}>
            <Search size={18} style={{position: "absolute", left: "16px", color: "var(--text-muted)"}} />
            <input 
              type="text"
              placeholder="搜索文件名、标签、备注...（支持拼音首字母 / 空格分隔多关键词）"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: "44px",
                paddingRight: searchQuery ? "40px" : "16px",
                height: "40px",
                width: "100%",
                border: "none",
                background: "transparent",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "14px"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "14px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                  borderRadius: "50%",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 👑 Workspace View Mode Toggle Switcher */}
          <div style={{
            display: "flex", 
            background: theme === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)", 
            borderRadius: "99px", 
            padding: "3px", 
            border: "1px solid var(--border-light)",
            height: "44px",
            alignItems: "center",
            gap: "2px",
            flexShrink: 0
          }}>
            <button 
              onClick={() => setWorkspaceViewMode("list")}
              style={{
                height: "36px",
                padding: "0 16px",
                borderRadius: "99px",
                fontSize: "12px",
                fontWeight: 600,
                background: workspaceViewMode === "list" ? "var(--color-primary)" : "transparent",
                color: workspaceViewMode === "list" ? "#fff" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
            >
              📝 列表
            </button>
            <button 
              onClick={() => setWorkspaceViewMode("grid")}
              style={{
                height: "36px",
                padding: "0 16px",
                borderRadius: "99px",
                fontSize: "12px",
                fontWeight: 600,
                background: workspaceViewMode === "grid" ? "var(--color-primary)" : "transparent",
                color: workspaceViewMode === "grid" ? "#fff" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
            >
              🖼️ 图墙
            </button>
          </div>

          <button 
            onClick={() => {
              setMultiSelectMode(!multiSelectMode);
              setCheckedWorkspaceFiles([]);
            }}
            style={{ 
              padding: "0 18px", 
              height: "44px",
              borderRadius: "99px",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: multiSelectMode ? "var(--color-primary)" : (theme === "light" ? "#f1f5f9" : "rgba(255,255,255,0.05)"),
              color: multiSelectMode ? "#fff" : "var(--text-primary)",
              border: "1px solid var(--border-light)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: multiSelectMode ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none"
            }}
          >
            <span>🗂️</span> 
            {multiSelectMode ? "取消多选" : "开启多选"}
          </button>
          {multiSelectMode && checkedWorkspaceFiles.length > 0 && (
            <button 
              className="btn"
              onClick={() => setShowZipModal(true)}
              style={{ 
                height: "44px",
                padding: "0 18px", 
                borderRadius: "99px",
                fontSize: "13px", 
                background: theme === "light" ? "rgba(124, 58, 237, 0.08)" : "rgba(168, 85, 247, 0.15)", 
                borderColor: theme === "light" ? "rgba(124, 58, 237, 0.2)" : "rgba(168, 85, 247, 0.3)", 
                color: theme === "light" ? "#7c3aed" : "#c084fc",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Archive size={16} />
              <span>打包归档 ({checkedWorkspaceFiles.length})</span>
            </button>
          )}
        </div>

        {/* Filtering controls */}
        <div style={{display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center"}}>
          <span style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)"}}>快速过滤:</span>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: "120px", 
              padding: "6px 12px", 
              fontSize: "13px",
              borderRadius: "8px",
              border: "1px solid var(--border-light)",
              background: theme === "light" ? "#fff" : "rgba(0,0,0,0.2)",
              color: "var(--text-primary)",
              outline: "none"
            }}
          >
            <option value="">状态不限</option>
            <option value="#待处理">#待处理</option>
            <option value="#进行中">#进行中</option>
            <option value="#已完成">#已完成</option>
            <option value="#非常重要">#非常重要</option>
          </select>

          <span style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginLeft: "8px"}}>排序方式:</span>
          <select 
            value={sortMethod} 
            onChange={(e) => setSortMethod(e.target.value as any)}
            style={{
              width: "130px", 
              padding: "6px 12px", 
              fontSize: "13px",
              borderRadius: "8px",
              border: "1px solid var(--border-light)",
              background: theme === "light" ? "#fff" : "rgba(0,0,0,0.2)",
              color: "var(--text-primary)",
              outline: "none"
            }}
          >
            <option value="time_desc">最新修改优先</option>
            <option value="time_asc">最早修改优先</option>
            <option value="size_desc">最大文件优先</option>
            <option value="size_asc">最小文件优先</option>
            <option value="name_asc">文件名 A-Z</option>
            <option value="name_desc">文件名 Z-A</option>
          </select>

          {(searchQuery.trim() !== "" || statusFilter !== "" || selectedTagsFilter.length > 0 || extensionFilter !== "" || selectedCategory !== null) && (
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSearchQuery("");
                setStatusFilter("");
                setExtensionFilter("");
                setSelectedTagsFilter([]);
              }}
              className="btn"
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "var(--color-danger)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
                transition: "all 0.2s ease"
              }}
            >
              ✕ 清空全部过滤
            </button>
          )}

          {/* Hot tags list */}
          <div style={{display: "flex", gap: "8px", flexWrap: "wrap", flex: 1, paddingBottom: "4px"}}>
            {Object.entries(tagDistribution).slice(0, 5).map(([tag, count], idx) => {
              const isActive = selectedTagsFilter.includes(tag);
              return (
                <span 
                  key={idx}
                  onClick={() => {
                    if (isActive) {
                      setSelectedTagsFilter(selectedTagsFilter.filter(t => t !== tag));
                    } else {
                      setSelectedTagsFilter([...selectedTagsFilter, tag]);
                    }
                  }}
                  style={{
                    cursor: "pointer", 
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "6px 14px",
                    borderRadius: "99px",
                    background: isActive 
                      ? (theme === "light" ? "#f59e0b" : "#d97706") 
                      : (theme === "light" ? "#fef3c7" : "rgba(245, 158, 11, 0.1)"),
                    color: isActive 
                      ? "#fff" 
                      : (theme === "light" ? "#d97706" : "#fbbf24"),
                    border: isActive ? "1px solid transparent" : (theme === "light" ? "1px solid #fde68a" : "1px solid rgba(245, 158, 11, 0.2)"),
                    transition: "all 0.2s ease",
                    boxShadow: isActive ? "0 2px 8px rgba(245, 158, 11, 0.3)" : "none",
                    whiteSpace: "nowrap"
                  }}
                >
                  {tag} ({count})
                </span>
              );
            })}
          </div>
        </div>

        {/* 🆕 面包屑导航 */}
        <div style={{
          display: "flex", 
          alignItems: "center", 
          gap: "6px", 
          fontSize: "12px", 
          color: "var(--text-secondary)", 
          background: theme === "light" ? "rgba(0,0,0,0.015)" : "rgba(255,255,255,0.015)",
          padding: "8px 14px",
          borderRadius: "10px",
          border: "1px solid var(--border-light)",
          flexWrap: "wrap",
          alignSelf: "stretch",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <span 
            onClick={() => setSelectedCategory(null)} 
            style={{ cursor: "pointer", color: "var(--color-primary)", fontWeight: 600, transition: "color 0.2s" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = "underline";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = "none";
            }}
          >
            📁 全部工作区
          </span>
          
          {selectedCategory && (() => {
            const parts = selectedCategory.replace(/\\/g, "/").split("/");
            let accum = "";
            return parts.map((part, idx) => {
              accum = accum ? `${accum}/${part}` : part;
              const currentAccum = accum;
              const isLast = idx === parts.length - 1;
              
              return (
                <span key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "var(--text-muted)", opacity: 0.7 }}>/</span>
                  {isLast ? (
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {part.replace(/^\d+/, "")}
                    </span>
                  ) : (
                    <span 
                      onClick={() => setSelectedCategory(currentAccum)}
                      style={{ cursor: "pointer", color: "var(--color-primary)", fontWeight: 600, transition: "color 0.2s" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = "underline";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = "none";
                      }}
                    >
                      {part.replace(/^\d+/, "")}
                    </span>
                  )}
                </span>
              );
            });
          })()}
        </div>

        {/* Workspace Files List */}
        <div style={{display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0, overflowY: "auto"}}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
              setListRenderLimit(prev => Math.min(prev + 50, sortedWorkspaceFiles.length));
            }
          }}>
          {sortedWorkspaceFiles.length === 0 ? (
            <div style={{
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center", 
              flex: 1, 
              color: "var(--text-secondary)",
              padding: "40px",
              textAlign: "center",
              border: "2px dashed var(--border-light)",
              borderRadius: "16px",
              background: theme === "light" ? "rgba(0,0,0,0.01)" : "rgba(255,255,255,0.01)",
              margin: "20px 0"
            }}>
              <div style={{
                position: "relative",
                width: "80px",
                height: "80px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <div style={{
                  position: "absolute",
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "var(--color-primary)",
                  opacity: 0.15,
                  filter: "blur(12px)"
                }} />
                <FolderOpen size={48} style={{color: "var(--color-primary)", opacity: 0.6, position: "relative", zIndex: 2}} />
              </div>
              <h3 style={{fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px"}}>工作空间虚位以待</h3>
              <p style={{fontSize: "12px", color: "var(--text-muted)", maxWidth: "280px", lineHeight: "1.5"}}>
                当前筛选目录下暂无归档文档。您可以点击左侧标准目录进行切换，或在上方模糊搜索栏检索全盘文件。
              </p>
              <div style={{display: "flex", gap: "10px", marginTop: "20px"}}>
                <button 
                  className="btn" 
                  onClick={() => { setSelectedCategory(null); setSearchQuery(""); setStatusFilter(""); setExtensionFilter(""); setSelectedTagsFilter([]); }}
                  style={{
                    padding: "6px 14px",
                    fontSize: "11px",
                    borderRadius: "6px",
                    background: "rgba(129, 140, 248, 0.1)",
                    border: "1px solid rgba(129, 140, 248, 0.2)",
                    color: "var(--color-primary)",
                    cursor: "pointer"
                  }}
                >
                  重置所有筛选
                </button>
              </div>
            </div>
          ) : workspaceViewMode === "list" ? (
            sortedWorkspaceFiles.slice(0, listRenderLimit).map((file, idx) => {
              const isChecked = checkedWorkspaceFiles.includes(file.filepath.toString());
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    if (multiSelectMode) {
                      if (isChecked) {
                        setCheckedWorkspaceFiles(checkedWorkspaceFiles.filter(f => f !== file.filepath.toString()));
                      } else {
                        setCheckedWorkspaceFiles([...checkedWorkspaceFiles, file.filepath.toString()]);
                      }
                    } else {
                      setSelectedWorkspaceFile(file);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      show: true,
                      x: e.clientX,
                      y: e.clientY,
                      file: file
                    });
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
                    borderColor: selectedWorkspaceFile?.filepath === file.filepath ? "var(--color-primary)" : "var(--border-light)",
                    background: isChecked
                      ? (theme === "light" ? "rgba(124, 58, 237, 0.08)" : "rgba(168, 85, 247, 0.1)")
                      : (selectedWorkspaceFile?.filepath === file.filepath ? "var(--color-primary-glow)" : "var(--bg-secondary)"),
                    transition: "border-color 0.15s ease, background 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (selectedWorkspaceFile?.filepath !== file.filepath && !isChecked) {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedWorkspaceFile?.filepath !== file.filepath && !isChecked) {
                      e.currentTarget.style.borderColor = "var(--border-light)";
                      e.currentTarget.style.background = "var(--bg-secondary)";
                    }
                  }}
                >
                  <div style={{display: "flex", alignItems: "center", gap: "12px", overflow: "hidden", minWidth: 0, flex: 1}}>
                    {multiSelectMode && (
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ marginRight: "4px", cursor: "pointer" }}
                      />
                    )}
                    {getFileIcon(file.filename.toString(), 32)}
                    <div style={{overflow: "hidden", minWidth: 0, flex: 1}}>
                      <h4 style={{margin: 0, fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.4"}}>{file.filename}</h4>
                      <p style={{margin: 0, fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", paddingBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.4"}}>{file.filepath}</p>
                    </div>
                  </div>
                  <div style={{display: "flex", alignItems: "center", gap: "12px", flexShrink: 0}}>
                    {(file.tags || []).slice(0, 2).map((t, i) => (
                      <span key={i} className="badge badge-success" style={{fontSize: "10px", textTransform: "none"}}>{t}</span>
                    ))}
                    <span style={{fontSize: "11px", color: "var(--text-muted)"}}>{formatSize(file.file_size)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: "14px",
              padding: "4px 4px 16px 4px",
              width: "100%"
            }}>
              {sortedWorkspaceFiles.slice(0, listRenderLimit).map((file, idx) => {
                const isChecked = checkedWorkspaceFiles.includes(file.filepath.toString());
                const isSelected = selectedWorkspaceFile?.filepath === file.filepath;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (multiSelectMode) {
                        if (isChecked) {
                          setCheckedWorkspaceFiles(checkedWorkspaceFiles.filter(f => f !== file.filepath.toString()));
                        } else {
                          setCheckedWorkspaceFiles([...checkedWorkspaceFiles, file.filepath.toString()]);
                        }
                      } else {
                        setSelectedWorkspaceFile(file);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        show: true,
                        x: e.clientX,
                        y: e.clientY,
                        file: file
                      });
                    }}
                    onDoubleClick={() => setPreviewFile(file)}
                    style={{
                      padding: "16px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      position: "relative",
                      borderRadius: "14px",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--color-primary)" : "var(--border-light)",
                      background: isChecked
                        ? (theme === "light" ? "rgba(124, 58, 237, 0.08)" : "rgba(168, 85, 247, 0.1)")
                        : (isSelected ? "var(--color-primary-glow)" : "var(--bg-secondary)"),
                      boxShadow: isSelected ? "0 4px 14px rgba(99, 102, 241, 0.15)" : "none",
                      transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      setHoveredFileIdx(idx);
                      if (!isSelected && !isChecked) {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      setHoveredFileIdx(null);
                      if (!isSelected && !isChecked) {
                        e.currentTarget.style.borderColor = "var(--border-light)";
                        e.currentTarget.style.background = "var(--bg-secondary)";
                      }
                    }}
                  >
                    {hoveredFileIdx === idx && file.description && (
                      <div style={{
                        position: "absolute",
                        bottom: "102%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "200px",
                        background: theme === "light" ? "rgba(255, 255, 255, 0.9)" : "rgba(30, 30, 40, 0.9)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.2)",
                        zIndex: 99,
                        pointerEvents: "none",
                        fontSize: "12px",
                        color: "var(--text-primary)",
                        textAlign: "left",
                        wordBreak: "break-all"
                      }}>
                        <div style={{fontWeight: 600, marginBottom: "4px", color: "var(--color-primary)"}}>备注说明:</div>
                        <div style={{lineHeight: "1.4", opacity: 0.9}}>{file.description}</div>
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: "0",
                          height: "0",
                          borderLeft: "6px solid transparent",
                          borderRight: "6px solid transparent",
                          borderTop: `6px solid ${theme === "light" ? "rgba(255, 255, 255, 0.9)" : "rgba(30, 30, 40, 0.9)"}`
                        }} />
                      </div>
                    )}
                    {/* Checkbox indicator in multi-select mode */}
                    {multiSelectMode && (
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ 
                          position: "absolute",
                          top: "10px",
                          left: "10px",
                          cursor: "pointer" 
                        }}
                      />
                    )}
                    
                    <div style={{
                      display: "flex", 
                      justifyContent: "center", 
                      marginBottom: "12px",
                      marginTop: multiSelectMode ? "10px" : "0"
                    }}>
                      {getFileIcon(file.filename.toString(), 44)}
                    </div>

                    <div style={{
                      width: "100%", 
                      textAlign: "center", 
                      overflow: "hidden"
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: "12px", 
                        fontWeight: 600, 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap",
                        color: "var(--text-primary)",
                        lineHeight: "1.4"
                      }}>
                        {file.filename}
                      </h4>
                      <p style={{
                        margin: 0,
                        fontSize: "10px", 
                        color: "var(--text-muted)", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap",
                        marginTop: "4px",
                        paddingBottom: "2px",
                        lineHeight: "1.4"
                      }}>
                        {file.filepath}
                      </p>
                    </div>

                    {/* Tags or details badge */}
                    <div style={{
                      display: "flex",
                      gap: "4px",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: "10px",
                      width: "100%",
                      overflow: "hidden",
                      flexWrap: "wrap"
                    }}>
                      {(file.tags || []).slice(0, 1).map((t, i) => (
                        <span key={i} className="badge badge-success" style={{fontSize: "9px", textTransform: "none", padding: "1px 6px"}}>{t}</span>
                      ))}
                      <span style={{fontSize: "9px", color: "var(--text-muted)"}}>{formatSize(file.file_size)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: File Details / Actions */}
      <div style={{ height: "100%", overflow: "hidden" }}>
        {selectedWorkspaceFile ? (
          <div className="cyber-card" style={{height: "100%", display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden"}}>
            <div>
              <h3 className="card-title" style={{fontSize: "16px"}}>{selectedWorkspaceFile.filename}</h3>
              <div style={{fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", wordBreak: "break-all", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px"}}>
                {(() => {
                  const normalized = selectedWorkspaceFile.filepath.toString().replace(/\\/g, "/");
                  const parts = normalized.split("/");
                  const elements: any[] = [];
                  let accum = "";
                  for (let i = 0; i < parts.length; i++) {
                    const isLast = i === parts.length - 1;
                    const part = parts[i];
                    if (i > 0) {
                      accum += "/";
                    }
                    accum += part;
                    const currentAccum = accum;
                    if (isLast) {
                      elements.push(<span key={i} style={{color: "var(--text-secondary)"}}>{part}</span>);
                    } else {
                      elements.push(
                        <span 
                          key={i} 
                          onClick={() => setSelectedCategory(currentAccum)}
                          style={{
                            cursor: "pointer", 
                            color: "var(--color-primary)", 
                            textDecoration: "underline"
                          }}
                          title={`跳转到目录: ${currentAccum}`}
                        >
                          {part}
                        </span>
                      );
                      elements.push(<span key={`slash-${i}`} style={{margin: "0 2px"}}>/</span>);
                    }
                  }
                  return elements;
                })()}
              </div>
            </div>

            <div style={{display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto", paddingRight: "4px", minHeight: 0}}>
              <div>
                <span style={{fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px"}}>文件尺寸</span>
                <div style={{fontSize: "13px", fontWeight: 500}}>{formatSize(selectedWorkspaceFile.file_size)}</div>
              </div>

              <div>
                <span style={{fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px"}}>修改日期</span>
                <div style={{fontSize: "13px", fontWeight: 500}}>
                  {new Date(selectedWorkspaceFile.modified_time * 1000).toLocaleString()}
                </div>
              </div>

              <div>
                <span style={{fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px"}}>所属标签</span>
                {isEditingMetadata ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {/* Available Tags list to click-select */}
                    <div style={{
                      display: "flex", 
                      flexWrap: "wrap", 
                      gap: "6px", 
                      maxHeight: "140px",
                      overflowY: "auto", 
                      padding: "6px",
                      borderRadius: "8px",
                      background: theme === "light" ? "#f8fafc" : "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border-light)"
                    }}>
                      {(() => {
                        // Dynamically fetch all unique tags from workspaceFiles and settings tags
                        const allExistingTags = Array.from(new Set([
                          ...workspaceFiles.flatMap(f => f.tags || []),
                          "#待处理", "#进行中", "#已完成", "#非常重要", "#课程学习", "#学术科研", "#备份包", "#代码归档"
                        ])).filter(t => t.length > 0);

                        return allExistingTags.map((tag, i) => {
                          const isActive = editTagsInput.includes(tag);
                          return (
                            <span 
                              key={i} 
                              onClick={() => {
                                if (isActive) {
                                  setEditTagsInput(editTagsInput.filter(t => t !== tag));
                                } else {
                                  setEditTagsInput([...editTagsInput, tag]);
                                }
                              }}
                              className={`badge`}
                              style={{
                                cursor: "pointer",
                                textTransform: "none",
                                fontSize: "10px",
                                padding: "3px 8px",
                                borderRadius: "99px",
                                border: isActive ? "1px solid transparent" : "1px solid var(--border-light)",
                                background: isActive ? "var(--color-primary)" : "transparent",
                                color: isActive ? "#fff" : "var(--text-secondary)",
                                transition: "all 0.15s ease"
                              }}
                            >
                              {tag}
                            </span>
                          );
                        });
                      })()}
                    </div>

                    {/* Dynamically add new custom tag input */}
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input 
                        type="text"
                        placeholder="添加新标签 (如: #量子学)"
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        className="input-field"
                        style={{ flex: 1, height: "30px", fontSize: "11px", padding: "0 8px" }}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "s" || e.key === "S")) {
                            e.preventDefault();
                            handleSaveMetadata();
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            const cleaned = newTagText.trim();
                            if (cleaned) {
                              const formatted = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
                              if (!editTagsInput.includes(formatted)) {
                                setEditTagsInput([...editTagsInput, formatted]);
                              }
                              setNewTagText("");
                            }
                          }
                        }}
                      />
                      <button 
                        type="button"
                        className="btn"
                        onClick={() => {
                          const cleaned = newTagText.trim();
                          if (cleaned) {
                            const formatted = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
                            if (!editTagsInput.includes(formatted)) {
                              setEditTagsInput([...editTagsInput, formatted]);
                            }
                            setNewTagText("");
                          }
                        }}
                        style={{ height: "30px", padding: "0 10px", fontSize: "11px" }}
                      >
                        ＋ 添加
                      </button>
                    </div>

                    {/* Active selected tags indicator preview */}
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      已勾选: {editTagsInput.length > 0 ? editTagsInput.join(", ") : "无"}
                    </div>
                  </div>
                ) : (
                  <div style={{display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px"}}>
                    {selectedWorkspaceFile.tags && selectedWorkspaceFile.tags.length > 0 ? selectedWorkspaceFile.tags.map((t, i) => (
                      <span key={i} className="badge badge-success" style={{textTransform: "none", fontSize: "11px"}}>{t}</span>
                    )) : <span style={{fontSize: "12px", color: "var(--text-muted)"}}>无</span>}
                  </div>
                )}
              </div>

              <div>
                <span style={{fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px"}}>文档备注说明</span>
                {isEditingMetadata ? (
                  <textarea
                    value={editDescriptionInput}
                    onChange={(e) => setEditDescriptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "s" || e.key === "S")) {
                        e.preventDefault();
                        handleSaveMetadata();
                      }
                    }}
                    placeholder="输入文档备注或摘要说明..."
                    className="input-field"
                    style={{
                      width: "100%",
                      minHeight: "70px",
                      fontSize: "12px",
                      resize: "vertical",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-light)",
                      background: theme === "light" ? "#fff" : "rgba(0, 0, 0, 0.2)",
                      color: "var(--text-primary)",
                      outline: "none"
                    }}
                  />
                ) : (
                  <div style={{fontSize: "13px", background: theme === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-light)", color: "var(--text-secondary)", minHeight: "40px"}}>
                    {selectedWorkspaceFile.description || "未添加备注说明..."}
                  </div>
                )}
              </div>

              {/* 👁️ Floating Premium Preview Button */}
              <button
                onClick={() => setPreviewFile(selectedWorkspaceFile)}
                className="btn btn-primary"
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "12px",
                  marginBottom: "12px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px var(--color-primary-glow)",
                  cursor: "pointer"
                }}
              >
                <Search size={14} />
                <span>👁️ 弹出窗口预览</span>
              </button>

              <div style={{display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto"}}>
                <div style={{display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", padding: "4px 0"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "4px"}}><HardDrive size={12} /> 硬盘备份状态:</span>
                  <span style={{fontWeight: 600, color: selectedWorkspaceFile.backup_disk_status ? "var(--color-success)" : "var(--color-warning)"}}>
                    {selectedWorkspaceFile.backup_disk_status ? "已同步" : "未同步"}
                  </span>
                </div>
                <div style={{display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", padding: "4px 0"}}>
                  <span style={{display: "flex", alignItems: "center", gap: "4px"}}><Cloud size={12} /> 云端备份状态:</span>
                  <span style={{fontWeight: 600, color: selectedWorkspaceFile.backup_cloud_status ? "var(--color-success)" : "var(--color-warning)"}}>
                    {selectedWorkspaceFile.backup_cloud_status ? "已同步" : "未同步"}
                  </span>
                </div>
              </div>
            </div>

            {isEditingMetadata ? (
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
                <button 
                  className="btn btn-primary" 
                  style={{
                    justifyContent: "center", 
                    background: "var(--color-success)", 
                    borderColor: "var(--color-success)",
                    color: "#fff",
                    fontWeight: 600
                  }} 
                  onClick={handleSaveMetadata}
                >
                  ✓ 保存
                </button>
                <button 
                  className="btn" 
                  style={{justifyContent: "center", fontWeight: 600}} 
                  onClick={() => {
                    setIsEditingMetadata(false);
                    setNewTagText("");
                  }}
                >
                  ✕ 取消
                </button>
              </div>
            ) : (
              <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                <button 
                  className="btn" 
                  style={{
                    justifyContent: "center", 
                    borderColor: "var(--color-primary)", 
                    color: "var(--color-primary)", 
                    fontWeight: 600,
                    width: "100%",
                    padding: "10px 16px"
                  }} 
                  onClick={() => {
                    setEditDescriptionInput(selectedWorkspaceFile.description?.toString() || "");
                    setEditTagsInput(selectedWorkspaceFile.tags || []);
                    setIsEditingMetadata(true);
                    setNewTagText("");
                  }}
                >
                  ✏️ 编辑文档元数据
                </button>
                <div style={{display: "flex", gap: "10px"}}>
                  <button 
                    className="btn btn-primary" 
                    style={{
                      flex: 1,
                      justifyContent: "center", 
                      padding: "10px 12px"
                    }} 
                    onClick={() => {
                      const path = `${workspaceDir}/${selectedWorkspaceFile.filepath}`;
                      navigator.clipboard.writeText(path.replace(/\//g, "\\"));
                      addLog("文件完整路径已成功复制到剪贴板。");
                      showToast("已复制绝对路径！", "success");
                    }}
                  >
                    <Clipboard size={14} style={{ marginRight: "4px" }} />
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>复制绝对路径</span>
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => handleDeleteFile(selectedWorkspaceFile.filepath.toString())}
                    style={{
                      color: "var(--color-danger)", 
                      borderColor: "rgba(239, 68, 68, 0.2)", 
                      background: "rgba(239, 68, 68, 0.05)", 
                      width: "48px",
                      display: "flex", 
                      justifyContent: "center", 
                      alignItems: "center",
                      flexShrink: 0
                    }}
                    title="物理删除此文件"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="cyber-card" style={{maxHeight: "240px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed var(--border-light)", color: "var(--text-secondary)", padding: "32px 24px", textAlign: "center"}}>
            <FileText size={40} style={{color: "var(--text-muted)", marginBottom: "16px"}} />
            <h3 style={{fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px"}}>文档详细信息</h3>
            <p style={{fontSize: "13px", lineHeight: "1.4"}}>请在中间列表选择任意文档，即可在此查看其详细的备份状态、历史标签、手动备注并执行路径复制等管理操作。</p>
          </div>
        )}
      </div>
    </div>
  );
}
