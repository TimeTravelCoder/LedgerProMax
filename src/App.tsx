import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import LiquidGlass from "./components/liquid-glass/LiquidGlass";
import PreviewPanel from "./components/PreviewPanel";
import DuplicateFinder from "./components/DuplicateFinder";
import ZipArchiveModal from "./components/ZipArchiveModal";
import { 
  Inbox, 
  FolderOpen, 
  ShieldCheck, 
  Settings, 
  Sparkles, 
  Search, 
  RotateCw, 
  FolderPlus, 
  FileText, 
  Trash2, 
  HardDrive, 
  Cloud, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Clipboard, 
  Bell,
  Archive,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit3,
  Save,
  TestTube2,
  X,
  ChevronDown,
  ChevronRight,
  FileImage,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  FileVideo,
  FileAudio
} from "lucide-react";

interface FileRecord {
  filepath: String;
  filename: String;
  file_size: number;
  modified_time: number;
  tags: String;
  description: String;
  backup_disk_status: number;
  backup_cloud_status: number;
  last_backup_time?: String;
}

interface BackupHistoryRecord {
  timestamp: String;
  backup_type: String;
  files_copied: number;
  bytes_copied: number;
  status: String;
}

type SignalStyle = CSSProperties & {
  "--signal-accent": string;
};

type TagGroupKey = "primary" | "secondary" | "status";

interface AutoRule {
  name: string;
  keywords: string[];
  extensions: string[];
  target_prefix: string;
  enabled?: boolean;
}

interface PathValidation {
  exists: boolean;
  is_dir: boolean;
  writable: boolean;
  message: string;
}

type PathValidationMap = Record<"workspace" | "monitor" | "disk" | "cloud", PathValidation | null>;

const getFileIcon = (filename: string, size = 32) => {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  
  const [label, color] = {
    ".pdf": ["PDF", "#DC2626"],
    ".doc": ["DOC", "#2563EB"],
    ".docx": ["DOC", "#2563EB"],
    ".txt": ["TXT", "#64748B"],
    ".md": ["MD", "#7C3AED"],
    ".png": ["IMG", "#059669"],
    ".jpg": ["IMG", "#059669"],
    ".jpeg": ["IMG", "#059669"],
    ".gif": ["IMG", "#059669"],
    ".webp": ["IMG", "#059669"],
    ".svg": ["IMG", "#059669"],
    ".py": ["PY", "#D97706"],
    ".js": ["JS", "#CA8A04"],
    ".ts": ["TS", "#0284C7"],
    ".tsx": ["TSX", "#0284C7"],
    ".jsx": ["JSX", "#CA8A04"],
    ".xlsx": ["XLS", "#16A34A"],
    ".xls": ["XLS", "#16A34A"],
    ".ppt": ["PPT", "#EA580C"],
    ".pptx": ["PPT", "#EA580C"],
    ".zip": ["ZIP", "#0F766E"],
    ".rar": ["RAR", "#0F766E"],
    ".7z": ["7Z", "#0F766E"],
    ".tar": ["TAR", "#0F766E"],
    ".gz": ["GZ", "#0F766E"],
    ".csv": ["CSV", "#0F766E"],
    ".json": ["JSON", "#4A6FA6"],
  }[ext] || ["FILE", "#4A6FA6"];

  const fontSize = label.length > 3 ? (size > 32 ? "9px" : "8px") : (size > 32 ? "11px" : "10px");
  const borderRadius = size > 32 ? "8px" : "6px";

  return (
    <div 
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: borderRadius,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: fontSize,
        fontWeight: "bold",
        fontFamily: "var(--font-display), 'Segoe UI', sans-serif",
        flexShrink: 0,
        boxShadow: `0 3px 8px ${color}33`,
        userSelect: "none"
      }}
      title={`${label} 文件`}
    >
      {label}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "inbox" | "workspace" | "backup" | "settings" | "duplicates">("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [inboxRightTab, setInboxRightTab] = useState<"archive" | "preview">("archive");

  // App State Restoration
  const [hoveredWeeklyIndex, setHoveredWeeklyIndex] = useState<number | null>(null);
  const [weeklyTooltipPos, setWeeklyTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [createFolderRoot, setCreateFolderRoot] = useState("01课程学习");
  const [createFolderSubpath, setCreateFolderSubpath] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState<FileRecord | null>(null);
  const [ruleTestFilename, setRuleTestFilename] = useState<string>("report_final.pdf");
  const [tagSearchQuery, setTagSearchQuery] = useState<string>("");
  const [customTagInput, setCustomTagInput] = useState<string>("");
  const [checkedWorkspaceFiles, setCheckedWorkspaceFiles] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [isCreateFolderExpanded, setIsCreateFolderExpanded] = useState(false);
  const [isCreateProjectExpanded, setIsCreateProjectExpanded] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Option A State & Methods
  const [toasts, setToasts] = useState<{ id: string; type: "success" | "warning" | "error" | "info"; message: string }[]>([]);
  const showToast = (message: string, type: "success" | "warning" | "error" | "info" = "info", duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number; file: FileRecord | null }>({ show: false, x: 0, y: 0, file: null });
  const [isDragging, setIsDragging] = useState(false);

  const [namingTemplates, setNamingTemplates] = useState<{ key: string; label: string; pattern: string }[]>([
    { key: "regular", label: "常规分类模板 (日期_主题_版本_状态)", pattern: "{date}_{topic}_{version}_{status}" },
    { key: "paper", label: "学术论文模板 (日期_论文名)", pattern: "{date}_{topic}" },
    { key: "note", label: "个人笔记模板 (日期_笔记主题)", pattern: "{date}_{topic}" },
  ]);
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [newTemplatePattern, setNewTemplatePattern] = useState("");

  const handleBatchImportToInbox = async (paths: string[]) => {
    let successCount = 0;
    for (const p of paths) {
      const filename = p.substring(p.lastIndexOf("\\") + 1).substring(p.lastIndexOf("/") + 1);
      try {
        await handleImportToInbox(p, filename);
        successCount++;
      } catch (err) {
        showToast(`导入文件失败: ${filename}`, "error");
      }
    }
    if (successCount > 0) {
      showToast(`成功导入 ${successCount} 个外部文件至收集箱！`, "success");
    }
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, show: false }));
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const handleIgnoreFile = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setNotification(null);
  };

  // Global Workspace Configuration
  const [workspaceDir, setWorkspaceDir] = useState<string>("C:\\Users\\Ming\\Desktop\\Ledger Pro Max\\Workspace");
  const inboxName = "00收集箱";
  const [monitoredDirs, setMonitoredDirs] = useState<string>("C:\\Users\\Ming\\Downloads");
  const [backupDiskDir, setBackupDiskDir] = useState<string>("D:\\LedgerBackup\\Disk");
  const [backupCloudDir, setBackupCloudDir] = useState<string>("D:\\LedgerBackup\\Cloud");

  // State: Notification
  const [notification, setNotification] = useState<{ show: boolean; name: string; size: number; filepath: string } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // State: Desktop Summary & Inbox Files
  const [desktopSummary, setDesktopSummary] = useState({ normal_files: 0, folders: 0, shortcuts: 0, temporary_files: 0 });
  const [inboxFiles, setInboxFiles] = useState<FileRecord[]>([]);
  const [selectedInboxFile, setSelectedInboxFile] = useState<FileRecord | null>(null);

  // State: Rename / Organize File Panel
  const [topicName, setTopicName] = useState("");
  const [fileStatus, setFileStatus] = useState("#待处理");
  const [remark, setRemark] = useState("");
  const [recommendedTags, setRecommendedTags] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("regular");
  const [targetCategory, setTargetCategory] = useState("01课程学习");

  // State: Workspace Panel
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTagsFilter, setSelectedTagsFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [extensionFilter, setExtensionFilter] = useState<string>("");
  
  // State: File Rename Modal
  const [renameModalShow, setRenameModalShow] = useState(false);
  const [renameFileTarget, setRenameFileTarget] = useState<FileRecord | null>(null);
  const [renameNewNameInput, setRenameNewNameInput] = useState("");

  // State: View Mode Toggle & Metadata Editing
  const [workspaceViewMode, setWorkspaceViewMode] = useState<"list" | "grid">("list");
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editDescriptionInput, setEditDescriptionInput] = useState("");
  const [editTagsInput, setEditTagsInput] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState("");

  const [workspaceFiles, setWorkspaceFiles] = useState<FileRecord[]>([]);
  const [newProjectInput, setNewProjectInput] = useState("");
  const projectSubdirs = ["docs", "src", "data", "assets", "models", "output", "test"];

  // State: Backup Panel
  const [backupConsole, setBackupConsole] = useState<string[]>([]);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryRecord[]>([]);

  // State: Global Status tags distribution
  const [tagDistribution, setTagDistribution] = useState<Record<string, number>>({});

  // Premium Custom Dynamic Configuration States
  const [tagsState, setTagsState] = useState<{ primary: string[]; secondary: string[]; status: string[] }>({
    primary: [
      "#人工智能", "#量子科技", "#高等数学", "#操作系统",
      "#计算机网络", "#专业英语", "#课程学习", "#课题研究"
    ],
    secondary: [
      "#实验报告", "#学术论文", "#项目文档", "#复习备考",
      "#期末考试", "#常用参考"
    ],
    status: [
      "#待处理", "#进行中", "#已完成", "#非常重要"
    ]
  });

  const [autoRulesState, setAutoRulesState] = useState<AutoRule[]>([
    { name: "论文文档", keywords: ["paper", "论文", "arxiv"], extensions: [".pdf"], target_prefix: "05", enabled: true },
    { name: "演示文稿", keywords: ["ppt", "presentation", "汇报"], extensions: [".ppt", ".pptx"], target_prefix: "08", enabled: true },
    { name: "代码文件", keywords: ["code", "script"], extensions: [".py", ".js", ".ts", ".cpp", ".java"], target_prefix: "04", enabled: true },
    { name: "图片素材", keywords: ["image", "photo", "截图"], extensions: [".png", ".jpg", ".jpeg"], target_prefix: "07", enabled: true },
  ]);

  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [showZipModal, setShowZipModal] = useState<boolean>(false);

  // States for Editing in Settings Tab
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [newTagGroup, setNewTagGroup] = useState<TagGroupKey>("primary");
  const [editingTag, setEditingTag] = useState<{ group: TagGroupKey; value: string } | null>(null);
  const [editingTagValue, setEditingTagValue] = useState<string>("");

  const [newRuleName, setNewRuleName] = useState<string>("");
  const [newRuleKeywords, setNewRuleKeywords] = useState<string>("");
  const [newRuleExtensions, setNewRuleExtensions] = useState<string>("");
  const [newRulePrefix, setNewRulePrefix] = useState<string>("01");
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [pathValidation, setPathValidation] = useState<PathValidationMap>({
    workspace: null,
    monitor: null,
    disk: null,
    cloud: null,
  });

  const [chosenTags, setChosenTags] = useState<string[]>([]);

  const standardDirs = [
    "00收集箱", "01课程学习", "02课题研究", "03项目管理", "04代码仓库",
    "05学术论文", "06知识笔记", "07常用资源", "08演示汇报", "09个人简历",
    "10归档区", "99临时缓冲"
  ];

  useEffect(() => {
    if (!selectedCategory) return;
    const normalized = selectedCategory.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const matchingRoot = standardDirs
      .filter(dir => dir !== inboxName)
      .find(dir => normalized === dir || normalized.startsWith(`${dir}/`));
    if (!matchingRoot) return;

    setCreateFolderRoot(matchingRoot);
    const nextSubpath = normalized === matchingRoot ? "" : normalized.slice(matchingRoot.length + 1);
    setCreateFolderSubpath(nextSubpath);
  }, [selectedCategory, inboxName]);

  const parseListInput = (value: string) => (value || "")
    .split(",")
    .map(item => item.trim())
    .filter(item => item.length > 0);

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

  const normalizeWorkspacePathInput = (value: string) => (value || "")
    .replace(/\\/g, "/")
    .split("/")
    .map(part => part.trim())
    .filter(Boolean)
    .join("/");

  const validateWorkspacePathParts = (value: string, options: { allowSlash: boolean }) => {
    const raw = (value || "").trim();
    if (!raw) return "名称不能为空。";
    const parts = raw.replace(/\\/g, "/").split("/");
    const illegalNameChars = /[<>:"|?*]/;

    if (!options.allowSlash && raw.includes("/")) {
      return "名称不能包含 / 或 \\，请把父路径填入上方父级路径。";
    }

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) return "路径不能包含空层级。";
      if (trimmed === "." || trimmed === ".." || trimmed.includes("..")) return "路径不能包含 . 或 ..。";
      if (illegalNameChars.test(trimmed)) return "包含 Windows 非法字符：< > : \" | ? *。";
    }

    return "";
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

  // Dynamic Mouse Container Reference for Elastic Stretching
  const mainRef = useRef<HTMLDivElement>(null);

  // Initialize Workspace Directories & Load DB Data
  useEffect(() => {
    // Apply theme attribute to body/html
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleInitWorkspace = async () => {
    try {
      await invoke("init_workspace", { workspaceDir, dirs: standardDirs });
      await handleScanWorkspace();
      addLog("工作空间初始化成功！标准目录已建立。");
    } catch (err: any) {
      console.error(err);
      addLog(`工作空间初始化失败: ${err}`);
    }
  };

  const handleScanWorkspace = async () => {
    try {
      await invoke("scan_workspace", { workspaceDir });
      await handleRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshData = async () => {
    try {
      // 1. Desktop summary
      const sum: any = await invoke("get_desktop_summary");
      setDesktopSummary(sum);

      // 2. Fetch Inbox Files
      const allFiles: FileRecord[] = await invoke("search_files", { workspaceDir });
      const inboxList = allFiles.filter(f => (f.filepath as string).replace(/\\/g, "/").startsWith(inboxName + "/"));
      setInboxFiles(inboxList);

      // 3. General workspace files
      setWorkspaceFiles(allFiles);

      // 4. Tag distribution
      const dist: any = await invoke("get_tag_distribution", { workspaceDir });
      setTagDistribution(dist);

      // 5. Backup history
      const hist: any = await invoke("get_backup_history", { workspaceDir, limit: 10 });
      setBackupHistory(hist);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportToInbox = async (srcPath: string, filename: string) => {
    try {
      const destRel = `${inboxName}/${filename}`;
      const finalRel: string = await invoke("organize_file", {
        workspaceDir,
        srcPath,
        destRelPath: destRel,
        newFilename: filename
      });

      addLog(`[智能监控] 成功导入外部文件至收集箱: ${filename}`);
      
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      setNotification(null);

      await handleScanWorkspace();
      setActiveTab("inbox");

      const allFiles: FileRecord[] = await invoke("search_files", { workspaceDir });
      const inboxList = allFiles.filter(f => (f.filepath as string).replace(/\\/g, "/").startsWith(inboxName + "/"));
      const importedFile = inboxList.find(f => f.filepath === finalRel);
      if (importedFile) {
        setSelectedInboxFile(importedFile);
        const stem = filename.substring(0, filename.lastIndexOf("."));
        const cleanStem = stem.replace(/ /g, "_").replace(/-/g, "_");
        setTopicName(cleanStem);
      }
    } catch (err: any) {
      console.error(err);
      addLog(`[错误] 文件导入失败: ${err}`);
    }
  };


  // Load Config on Startup — must run BEFORE workspace init to avoid using stale default path
  useEffect(() => {
    const initApp = async () => {
      let resolvedWorkspaceDir = workspaceDir;
      let resolvedMonitoredDirs = monitoredDirs;
      try {
        const config: any = await invoke("load_config");
        if (config) {
          resolvedWorkspaceDir = config.workspace_dir || workspaceDir;
          resolvedMonitoredDirs = (config.monitored_dirs || []).join(", ");

          setWorkspaceDir(resolvedWorkspaceDir);
          setMonitoredDirs(resolvedMonitoredDirs);
          setBackupDiskDir(config.backup_disk_dir || "");
          setBackupCloudDir(config.backup_cloud_dir || "");
          
          // Fallback loaded theme to light/dark
          let loadedTheme = config.theme;
          if (loadedTheme === "zhongguose" || loadedTheme === "jade") loadedTheme = "light";
          setTheme((loadedTheme || "light") as any);

          if (config.tags) setTagsState(config.tags);
          if (config.auto_rules) setAutoRulesState(config.auto_rules);
        }
      } catch (err) {
        console.error("加载配置文件失败:", err);
      }

      // Initialize workspace & scan with the resolved (loaded) path — NOT the stale state value
      try {
        await invoke("init_workspace", { workspaceDir: resolvedWorkspaceDir, dirs: standardDirs });
        await invoke("scan_workspace", { workspaceDir: resolvedWorkspaceDir });
        await handleRefreshData();
        addLog("工作空间初始化成功！");
      } catch (err: any) {
        console.error("工作空间初始化失败:", err);
        addLog(`工作空间初始化失败: ${err}`);
      }

      // Start watching monitored dirs
      try {
        const paths = resolvedMonitoredDirs.split(",").map((p: string) => p.trim()).filter((p: string) => p.length > 0);
        if (paths.length > 0) await invoke("start_watching", { paths });
      } catch (err) {
        console.error("启动监控失败", err);
      }

      setConfigLoaded(true);
    };
    initApp();

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      invoke("stop_watching");
    };
  }, []);

  // Tauri event listeners — separate from init so they always register
  useEffect(() => {
    const unlisten = listen("file-detected", (event: any) => {
      const payload = event.payload;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setNotification({
        show: true,
        name: payload.filename,
        size: payload.file_size,
        filepath: payload.filepath
      });
      handleRefreshData();
      toastTimeoutRef.current = setTimeout(() => setNotification(null), 15000);
    });

    const unlistenDragEnter = listen("tauri://drag-enter", () => setIsDragging(true));
    const unlistenDragLeave = listen("tauri://drag-leave", () => setIsDragging(false));
    const unlistenDragDrop = listen("tauri://drag-drop", (event: any) => {
      setIsDragging(false);
      const paths: string[] = event.payload.paths;
      if (paths && paths.length > 0) handleBatchImportToInbox(paths);
    });

    return () => {
      unlisten.then(f => f());
      unlistenDragEnter.then(f => f());
      unlistenDragLeave.then(f => f());
      unlistenDragDrop.then(f => f());
    };
  }, []);

  // Re-init watcher when workspace/monitor dirs change AFTER initial load
  useEffect(() => {
    if (!configLoaded) return; // skip during first load — handled by initApp above
    handleStartWatching();
  }, [workspaceDir, monitoredDirs, configLoaded]);

  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      const monitorPaths = parseListInput(monitoredDirs);

      try {
        const [workspace, disk, cloud] = await Promise.all([
          invoke<PathValidation>("validate_path", { path: workspaceDir, shouldExist: false, requireWritable: true }),
          invoke<PathValidation>("validate_path", { path: backupDiskDir, shouldExist: false, requireWritable: true }),
          invoke<PathValidation>("validate_path", { path: backupCloudDir, shouldExist: false, requireWritable: true }),
        ]);

        let monitor: PathValidation;
        if (monitorPaths.length === 0) {
          monitor = { exists: false, is_dir: false, writable: false, message: "未配置监听目录，请添加至少一个目录" };
        } else {
          const monitorResults = await Promise.all(
            monitorPaths.map(p => invoke<PathValidation>("validate_path", { path: p, shouldExist: true, requireWritable: false }))
          );
          const invalidIdx = monitorResults.findIndex(r => !r.exists);
          if (invalidIdx !== -1) {
            monitor = {
              exists: false,
              is_dir: false,
              writable: false,
              message: `目录不可用: ${monitorPaths[invalidIdx]}`
            };
          } else {
            monitor = {
              exists: true,
              is_dir: true,
              writable: false,
              message: `已就绪 - 当前监听 ${monitorPaths.length} 个本地目录`
            };
          }
        }

        if (!cancelled) {
          setPathValidation({ workspace, monitor, disk, cloud });
        }
      } catch {
        if (!cancelled) {
          setPathValidation({
            workspace: { exists: false, is_dir: false, writable: false, message: "路径校验服务不可用" },
            monitor: { exists: false, is_dir: false, writable: false, message: "路径校验服务不可用" },
            disk: { exists: false, is_dir: false, writable: false, message: "路径校验服务不可用" },
            cloud: { exists: false, is_dir: false, writable: false, message: "路径校验服务不可用" },
          });
        }
      }
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, [workspaceDir, monitoredDirs, backupDiskDir, backupCloudDir]);

  const handleSaveConfig = async () => {
    try {
      const config = {
        workspace_dir: workspaceDir || "",
        downloads_dir: (monitoredDirs || "").split(",")[0]?.trim() || "",
        monitored_dirs: (monitoredDirs || "").split(",").map(p => p.trim()).filter(p => p.length > 0),
        backup_disk_dir: backupDiskDir || "",
        backup_cloud_dir: backupCloudDir || "",
        theme: theme,
        monitored_downloads: true,
        auto_rule_enabled: true,
        tags: tagsState,
        workspace_lang: "zh",
        use_custom_dirs: false,
        custom_standard_dirs: [],
        auto_rules: autoRulesState,
        custom_name_templates: []
      };
      await invoke("save_config", { config });
      addLog("全局系统配置已成功保存并同步！");
      setSaveStatus("saved");
      setSaveMessage("配置已保存，工作空间与监听规则已同步。");
      await handleInitWorkspace();
    } catch (err: any) {
      addLog(`[错误] 配置保存失败: ${err}`);
      setSaveStatus("error");
      setSaveMessage(`保存失败: ${err}`);
    }
  };

  const handleStartWatching = async () => {
    try {
      const paths = monitoredDirs.split(",").map(p => p.trim()).filter(p => p.length > 0);
      await invoke("start_watching", { paths });
    } catch (err) {
      console.error("启动监控失败", err);
    }
  };

  // Trigger Pinyin Search
  useEffect(() => {
    const triggerSearch = async () => {
      try {
        const query = searchQuery.trim() === "" ? null : searchQuery;
        const tags = selectedTagsFilter.length === 0 ? null : selectedTagsFilter;
        const status = statusFilter.trim() === "" ? null : statusFilter;
        
        let filtered: FileRecord[] = await invoke("search_files", { 
          workspaceDir, 
          query, 
          selectedTags: tags, 
          fileStatus: status 
        });

        if (selectedCategory) {
          filtered = filtered.filter(f => f.filepath.replace(/\\/g, "/").startsWith(selectedCategory + "/"));
        }

        // Apply extensionFilter if selected
        if (extensionFilter) {
          filtered = filtered.filter(f => {
            if (!f.filename) return false;
            const ext = f.filename.substring(f.filename.lastIndexOf(".")).toLowerCase();
            switch (extensionFilter) {
              case "pdf":
                return ext === ".pdf";
              case "image":
                return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext);
              case "doc":
                return [".doc", ".docx", ".txt", ".md", ".xlsx", ".xls", ".csv", ".ppt", ".pptx"].includes(ext);
              case "code":
                return [".py", ".js", ".ts", ".tsx", ".jsx", ".json"].includes(ext);
              case "archive":
                return [".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext);
              default:
                return true;
            }
          });
        }

        setWorkspaceFiles(filtered);
      } catch (err) {
        console.error(err);
      }
    };
    triggerSearch();
  }, [searchQuery, selectedCategory, selectedTagsFilter, statusFilter, extensionFilter]);

  // Tag Recommendations & Rules Suggestion when selecting inbox file
  useEffect(() => {
    if (selectedInboxFile) {
      const updateSuggestions = async () => {
        // Recommend Tags
        const tags: string[] = await invoke("recommend_tags", {
          filename: selectedInboxFile.filename,
          remark: remark,
          activeTags: [],
          topK: 3
        });
        setRecommendedTags(tags);
        setChosenTags(tags.slice(0, 2)); // 默认自动预勾选前两个高频 AI 推荐标签

        // Suggest category directory based on extension / keywords
        const suggestion: [string, string] | null = await invoke("suggest_rule_target", {
          filename: selectedInboxFile.filename,
          autoRules: autoRulesState,
          standardDirs
        });
        if (suggestion) {
          setTargetCategory(suggestion[1]);
        }
      };
      updateSuggestions();
    }
  }, [selectedInboxFile, remark]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setBackupConsole(prev => [`[${time}] ${msg}`, ...prev]);
  };

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

    setTagsState(prev => ({
      ...prev,
      [editingTag.group]: prev[editingTag.group].map(tag => tag === editingTag.value ? nextValue : tag)
    }));
    addLog(`标签已重命名: ${editingTag.value} -> ${nextValue}`);
    setEditingTag(null);
    setEditingTagValue("");
  };

  // Clear Desktop Non-Shortcut Files
  const handleCleanDesktop = async () => {
    try {
      addLog("开始一键整理桌面...");
      const result: [number, string[]] = await invoke("clean_desktop", { workspaceDir, inboxName });
      const [count, errors] = result;
      addLog(`桌面整理完成！共收集 ${count} 个文档放入箱中。`);
      if (errors.length > 0) {
        errors.forEach(e => addLog(`[错误] ${e}`));
      }
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 桌面清理失败: ${err}`);
    }
  };

  // Build Structured Project Folder
  const handleCreateProject = async () => {
    if (!canCreateProject) {
      showToast(projectNameError || "项目目录层级超过 4 层，无法创建。", "warning");
      return;
    }
    try {
      await invoke("init_project", { projectName: newProjectInput.trim(), workspaceDir, standardDirs });
      addLog(`成功在 03项目管理 中初始化项目 '${newProjectInput}' 结构！`);
      showToast(`项目空间已初始化: ${projectFinalPath}`, "success");
      setNewProjectInput("");
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 项目创建失败: ${err}`);
      showToast(`项目创建失败: ${err}`, "error");
    }
  };

  // Build Free Folder
  const handleCreateFolder = async () => {
    if (!canCreateFolder) {
      showToast(folderValidationMessage || "目录名称不符合规范。", "warning");
      return;
    }
    try {
      await invoke("create_folder", { workspaceDir, relativePath: folderFinalPath });
      addLog(`新建文件夹成功: ${folderFinalPath}`);
      showToast(`新建文件夹成功: ${folderFinalPath}`, "success");
      setNewFolderInput("");
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 文件夹创建失败: ${err}`);
      showToast(`文件夹创建失败: ${err}`, "error");
    }
  };

  // Execute Backup
  const handleRunBackup = async (type: "disk" | "cloud") => {
    const targetDir = type === "disk" ? backupDiskDir : backupCloudDir;
    addLog(`正在向 ${type === "disk" ? "硬盘" : "云盘"} 备份数据 (${targetDir})...`);
    try {
      const msg: string = await invoke("perform_backup", { backupType: type, workspaceDir, destDir: targetDir });
      addLog(msg);
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 备份失败: ${err}`);
    }
  };

  // Get Formatted Name based on selected template
  const getFormattedName = (originalName: string) => {
    const ext = originalName.substring(originalName.lastIndexOf("."));
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

    // Fallback if not found
    const cleanStatus = fileStatus.replace("#", "");
    return `${today}_${topic}_${version}_${cleanStatus}${ext}`;
  };

  // Archive & Categorize Inbox File
  const handleArchiveFile = async () => {
    if (!selectedInboxFile) return;

    try {
      const formattedName = getFormattedName(selectedInboxFile.filename.toString());
      const destRel = `${targetCategory}/${formattedName}`;
      
      const finalRel: string = await invoke("organize_file", {
        workspaceDir,
        srcPath: `${workspaceDir}/${selectedInboxFile.filepath}`,
        destRelPath: destRel,
        newFilename: formattedName
      });

      // Update description & tags in DB
      const finalTags = [...chosenTags];
      if (fileStatus && !finalTags.includes(fileStatus)) {
        finalTags.push(fileStatus);
      }
      
      await invoke("update_file_tags", { workspaceDir, filepath: finalRel, tags: finalTags });
      if (remark.trim() !== "") {
        await invoke("update_file_description", { workspaceDir, filepath: finalRel, description: remark.trim() });
      }

      addLog(`文档归档成功: ${selectedInboxFile.filename} -> ${destRel}`);
      setSelectedInboxFile(null);
      setTopicName("");
      setRemark("");
      setChosenTags([]);
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 归档失败: ${err}`);
    }
  };

  // Delete File
  const handleDeleteFile = async (filepath: string) => {
    if (!window.confirm("确定要永久删除此文件吗？此操作无法撤销。")) return;
    try {
      await invoke("delete_file", { workspaceDir, filepath });
      addLog(`删除成功: ${filepath}`);
      setSelectedWorkspaceFile(null);
      setSelectedInboxFile(null);
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 删除失败: ${err}`);
    }
  };

  // Rename File Execute
  const handleRenameExecute = async () => {
    if (!renameFileTarget || !renameNewNameInput.trim()) return;
    try {
      const ext = renameFileTarget.filename.includes(".") 
        ? renameFileTarget.filename.substring(renameFileTarget.filename.lastIndexOf("."))
        : "";
      
      // Normalize directory slash separators
      const pathWithSlash = renameFileTarget.filepath.replace(/\\/g, "/");
      const parentDir = pathWithSlash.includes("/")
        ? pathWithSlash.substring(0, pathWithSlash.lastIndexOf("/"))
        : "";
      
      const newFilename = renameNewNameInput.trim() + ext;
      const newFilepath = parentDir ? `${parentDir}/${newFilename}` : newFilename;
      
      await invoke("rename_file", {
        workspaceDir,
        oldFilepath: renameFileTarget.filepath,
        newFilepath: newFilepath,
        newFilename: newFilename
      });
      
      showToast("文件重命名成功！", "success");
      addLog(`重命名成功: ${renameFileTarget.filename} -> ${newFilename}`);
      setRenameModalShow(false);
      setRenameFileTarget(null);
      
      // Refresh workspace data
      await handleScanWorkspace();
    } catch (err: any) {
      showToast(`重命名失败: ${err.toString()}`, "error");
      addLog(`[错误] 重命名失败: ${err.toString()}`);
    }
  };

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
        tags: cleanedTags.join(",")
      };
      setSelectedWorkspaceFile(updatedFile);
      await handleScanWorkspace();
    } catch (err: any) {
      showToast(`保存失败: ${err.toString()}`, "error");
      addLog(`[错误] 元数据保存失败: ${err.toString()}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getWeeklyActivity = (allFiles: FileRecord[]) => {
    const today = new Date();
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() / 1000;
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime() / 1000;
      const count = allFiles.filter(f => {
        const fileTime = Number(f.modified_time);
        return fileTime >= dayStart && fileTime <= dayEnd;
      }).length;
      list.push({ label, count });
    }
    return list;
  };

  // --- SYSTEM DATA DASHBOARD CALCULATIONS ---
  const totalFiles = workspaceFiles.length;
  const totalBytes = workspaceFiles.reduce((sum, f) => sum + Number(f.file_size || 0), 0);
  const formattedSize = totalBytes > 1024 * 1024 * 1024 
    ? (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + " GB" 
    : (totalBytes / (1024 * 1024)).toFixed(2) + " MB";
  const unorganizedCount = inboxFiles.length;

  const uniqueTagsList = Array.from(new Set(workspaceFiles.flatMap(f => 
    String(f.tags || "").split(",").map(t => t.trim()).filter(Boolean)
  )));
  const tagsCount = uniqueTagsList.length;

  const recentFilesCount = workspaceFiles.filter(f => 
    (new Date().getTime() - Number(f.modified_time) * 1000) <= 7 * 24 * 60 * 60 * 1000
  ).length;

  const hasDiskBackup = (backupDiskDir || "").trim().length > 0;
  const hasCloudBackup = (backupCloudDir || "").trim().length > 0;
  const backupScore = 40 + (hasDiskBackup ? 30 : 0) + (hasCloudBackup ? 30 : 0);

  const tagCountsMap: Record<string, number> = {};
  workspaceFiles.forEach(f => {
    String(f.tags || "").split(",").map(t => t.trim()).filter(Boolean).forEach(tag => {
      tagCountsMap[tag] = (tagCountsMap[tag] || 0) + 1;
    });
  });
  const sortedTags = Object.entries(tagCountsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxTagCount = Math.max(...sortedTags.map(t => t[1]), 1);

  const getTagColor = (tag: string) => {
    const value = tag.replace(/^#/, "").trim();
    if (!value) return "#818cf8";
    const colors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#38bdf8", "#2dd4bf", "#f472b6", "#4ade80", "#fb923c"];
    let sum = 0;
    for (let i = 0; i < value.length; i++) {
      sum += value.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const handleSelectDir = async (setter: (val: string) => void) => {
    try {
      const selected: string = await invoke("select_directory");
      if (selected && selected !== "USER_CANCELLED") {
        setter(selected);
      }
    } catch (err) {
      console.error("选择目录发生异常:", err);
    }
  };

  const topRecentFiles = [...workspaceFiles]
    .sort((a, b) => Number(b.modified_time) - Number(a.modified_time))
    .slice(0, 5);

  const weeklyTrendData = getWeeklyActivity(workspaceFiles);
  const maxWeeklyCount = Math.max(...weeklyTrendData.map(d => d.count), 1);

  // SVG Spline Chart Constants
  const chartLeft = 40;
  const chartWidth = 400; // 480 - 80
  const chartHeight = 110; // 160 - 50
  const svgHeight = 160;

  const splinePoints = weeklyTrendData.map((d, idx) => {
    const x = chartLeft + idx * (chartWidth / 6);
    const y = svgHeight - 30 - (d.count / maxWeeklyCount) * chartHeight;
    return { x, y, label: d.label, count: d.count };
  });

  const getSplinePathString = (pts: {x: number, y: number}[]) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePathStr = getSplinePathString(splinePoints);
  const areaPathStr = linePathStr ? `${linePathStr} L ${splinePoints[splinePoints.length - 1].x} ${svgHeight - 30} L ${splinePoints[0].x} ${svgHeight - 30} Z` : "";
  const taggedFilesCount = workspaceFiles.filter(f => String(f.tags || "").trim().length > 0).length;
  const archiveCoverage = totalFiles > 0 ? Math.round((taggedFilesCount / totalFiles) * 100) : 0;
  const enabledRulesCount = autoRulesState.filter(rule => rule.enabled !== false).length;
  const totalTagCount = tagsState.primary.length + tagsState.secondary.length + tagsState.status.length;
  const ruleCoverageScore = Math.min(100, enabledRulesCount * 20);
  const tagPoolScore = Math.min(100, totalTagCount * 4);
  const pathScore = [
    pathValidation.workspace?.writable,
    pathValidation.monitor?.exists,
    backupDiskDir.trim().length > 0 ? pathValidation.disk?.writable : false,
    backupCloudDir.trim().length > 0 ? pathValidation.cloud?.writable : false,
  ].filter(Boolean).length * 25;
  const configHealthScore = Math.round((pathScore * 0.45) + (ruleCoverageScore * 0.3) + (tagPoolScore * 0.25));
  const ruleTestMatch = getRuleMatch(ruleTestFilename);
  const monitoredPathList = parseListInput(monitoredDirs);
  const filteredTagsState = {
    primary: tagsState.primary.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
    secondary: tagsState.secondary.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
    status: tagsState.status.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
  };
  const creatableRoots = standardDirs.filter(dir => dir !== inboxName);
  const normalizedFolderSubpath = normalizeWorkspacePathInput(createFolderSubpath);
  const normalizedFolderName = normalizeWorkspacePathInput(newFolderInput);
  const folderFinalParts = [createFolderRoot, normalizedFolderSubpath, normalizedFolderName].filter(Boolean);
  const folderFinalPath = folderFinalParts.join("/");
  const folderDepth = folderFinalParts.flatMap(part => part.split("/").filter(Boolean)).length;
  const folderNameError = validateWorkspacePathParts(newFolderInput, { allowSlash: false });
  const folderSubpathError = createFolderSubpath.trim() ? validateWorkspacePathParts(createFolderSubpath, { allowSlash: true }) : "";
  const folderValidationMessage = folderNameError || folderSubpathError || (folderDepth > 4 ? `目录深度 ${folderDepth}/4，超过工作区规范。` : "");
  const canCreateFolder = !folderValidationMessage && folderDepth >= 2 && folderDepth <= 4;
  const projectRootDir = standardDirs[3] || "03项目管理";
  const normalizedProjectName = newProjectInput.trim();
  const projectFinalPath = `${projectRootDir}/${normalizedProjectName || "项目名称"}`;
  const projectDepth = normalizedProjectName ? 2 : 1;
  const projectNameError = validateWorkspacePathParts(normalizedProjectName, { allowSlash: false });
  const canCreateProject = !projectNameError && projectDepth <= 4;
  const proMaxSignals = [
    {
      icon: Inbox,
      label: "Pro Inbox",
      value: unorganizedCount,
      unit: "待处理",
      detail: "外部文件自动落入收集箱",
      accent: "var(--color-warning)",
      onClick: () => setActiveTab("inbox")
    },
    {
      icon: Sparkles,
      label: "AI 归档",
      value: archiveCoverage,
      unit: "%",
      detail: "标签覆盖率与语义命名",
      accent: "var(--color-success)",
      onClick: () => setActiveTab("workspace")
    },
    {
      icon: ShieldCheck,
      label: "3-2-1 Backup",
      value: backupScore,
      unit: "分",
      detail: "本地盘、外置盘、云端三层保护",
      accent: backupScore >= 100 ? "var(--color-success)" : (backupScore >= 70 ? "var(--color-warning)" : "var(--color-danger)"),
      onClick: () => setActiveTab("backup")
    },
    {
      icon: Layers,
      label: "Workspace",
      value: totalFiles,
      unit: "文件",
      detail: "结构化分类工作空间",
      accent: "var(--color-primary)",
      onClick: () => setActiveTab("workspace")
    }
  ];


  return (
    <div className="app-container" ref={mainRef}>
      {/* Background Glowing Ambient Orbs */}
      <div className="bg-ambient" />

      {/* 👑 macOS Liquid-Glass Sidebar */}
      <div className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">PM</div>
          <div className="logo-copy">
            <span>Ledger</span>
            <strong>Pro Max</strong>
          </div>
        </div>

        <div className="menu-list">
          <div 
            onClick={() => { setActiveTab("dashboard"); handleRefreshData(); }} 
            className={`menu-item ${activeTab === "dashboard" ? "active" : ""}`}
          >
            <Layers size={18} />
            <span>系统数据看板</span>
          </div>

          <div 
            onClick={() => setActiveTab("inbox")} 
            className={`menu-item ${activeTab === "inbox" ? "active" : ""}`}
          >
            <Inbox size={18} />
            <span>智能收集箱</span>
            {inboxFiles.length > 0 && (
              <span className="badge badge-warning" style={{marginLeft: "auto", padding: "2px 6px"}}>{inboxFiles.length}</span>
            )}
          </div>

          <div 
            onClick={() => { setActiveTab("workspace"); handleRefreshData(); }} 
            className={`menu-item ${activeTab === "workspace" ? "active" : ""}`}
          >
            <FolderOpen size={18} />
            <span>分类工作空间</span>
          </div>

          <div 
            onClick={() => setActiveTab("backup")} 
            className={`menu-item ${activeTab === "backup" ? "active" : ""}`}
          >
            <ShieldCheck size={18} />
            <span>3-2-1 备份管家</span>
          </div>

          <div 
            onClick={() => setActiveTab("duplicates")} 
            className={`menu-item ${activeTab === "duplicates" ? "active" : ""}`}
          >
            <Sparkles size={18} />
            <span>智能查重整理</span>
          </div>

          <div 
            onClick={() => setActiveTab("settings")} 
            className={`menu-item ${activeTab === "settings" ? "active" : ""}`}
          >
            <Settings size={18} />
            <span>控制面板与设置</span>
          </div>
        </div>

        {/* Global summary card inside sidebar */}
        <div style={{marginTop: "auto", padding: "16px", background: theme === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid var(--border-light)"}}>
          <div className="pro-max-badge">PRO MAX WORKSPACE</div>
          <h4 style={{fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase"}}>当前工作区概览</h4>
          <div style={{display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px"}}>
            <div style={{display: "flex", justifyContent: "space-between"}}>
              <span>全部文档:</span>
              <span style={{fontWeight: 600, color: "var(--color-primary)"}}>{workspaceFiles.length}</span>
            </div>
            <div style={{display: "flex", justifyContent: "space-between"}}>
              <span>待整理:</span>
              <span style={{fontWeight: 600, color: "var(--color-warning)"}}>{inboxFiles.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel Body */}
      <div className="main-content">
        {/* Top Header */}
        <div className="header-bar">
          <div className="header-title">
            {activeTab === "dashboard" && "Ledger Pro Max 指挥台"}
            {activeTab === "inbox" && "Pro Inbox 智能投递收集箱"}
            {activeTab === "workspace" && "Pro Workspace 分类工作空间"}
            {activeTab === "backup" && "Pro Backup 3-2-1 增量镜像"}
            {activeTab === "duplicates" && "Pro Cleaner 智能查重清理中心"}
            {activeTab === "settings" && "Pro Control 控制面板与系统配置"}
          </div>

          <div className="header-actions">
            <div style={{display: "flex", gap: "6px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "10px"}}>
              <button 
                onClick={() => setTheme("dark")} 
                style={{padding: "6px 12px", borderRadius: "8px", fontSize: "12px", border: "none", cursor: "pointer", background: theme === "dark" ? "var(--color-primary)" : "transparent", color: theme === "dark" ? "#fff" : "var(--text-secondary)"}}
              >
                赛博暗黑
              </button>
              <button 
                onClick={() => setTheme("light")} 
                style={{padding: "6px 12px", borderRadius: "8px", fontSize: "12px", border: "none", cursor: "pointer", background: theme === "light" ? "var(--color-primary)" : "transparent", color: theme === "light" ? "#fff" : "var(--text-secondary)"}}
              >
                极简明亮
              </button>
            </div>
            <button className="btn" onClick={handleScanWorkspace} style={{padding: "8px"}} title="物理重新扫描并刷新数据">
              <RotateCw size={16} />
            </button>
          </div>
        </div>

        {/* Dynamic Glass Notification Toast */}
        {notification?.show && (
          <div style={{position: "fixed", top: "24px", right: "24px", zIndex: 1000, pointerEvents: "auto"}}>
            <LiquidGlass overLight={theme === "light"} cornerRadius={16} padding="16px 20px" elasticity={0.4} displacementScale={80}>
              <div style={{display: "flex", flexDirection: "column", gap: "12px", width: "320px"}}>
                {/* Header */}
                <div style={{display: "flex", alignItems: "flex-start", gap: "12px"}}>
                  <div style={{
                    background: "var(--color-success-glow)",
                    padding: "8px",
                    borderRadius: "50%",
                    color: "var(--color-success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Bell size={18} />
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <h4 style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      marginBottom: "2px",
                      fontFamily: "var(--font-display)"
                    }}>
                      检测到落地文件
                    </h4>
                    <p style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }} title={notification.name}>
                      {notification.name}
                    </p>
                  </div>
                  <button 
                    onClick={handleIgnoreFile}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      borderRadius: "4px"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Subinfo (Size Badge) */}
                <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                  <span style={{fontSize: "11px", color: "var(--text-muted)"}}>大小:</span>
                  <span className="badge badge-success" style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: 600
                  }}>
                    {formatSize(notification.size)}
                  </span>
                </div>

                {/* Interactive Action Buttons */}
                <div style={{display: "flex", gap: "8px", marginTop: "4px"}}>
                  <button 
                    onClick={handleIgnoreFile}
                    className="btn"
                    style={{
                      flex: 1,
                      padding: "8px",
                      fontSize: "12px",
                      borderRadius: "8px",
                      background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border-light)",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
                    }}
                  >
                    忽略
                  </button>
                  <button 
                    onClick={() => handleImportToInbox(notification.filepath, notification.name)}
                    className="btn btn-primary"
                    style={{
                      flex: 2,
                      padding: "8px",
                      fontSize: "12px",
                      borderRadius: "8px",
                      background: "var(--color-primary)",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      boxShadow: "0 4px 12px var(--color-primary-glow)"
                    }}
                  >
                    🚀 立即导入收集箱
                  </button>
                </div>
              </div>
            </LiquidGlass>
          </div>
        )}

        {/* Dashboard Tab Panels */}
        <div className="panel-body">

          {/* 0. SYSTEM DATA DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <div style={{display: "flex", flexDirection: "column", gap: "20px", flex: 1, overflowY: "auto", paddingRight: "6px", height: "100%", paddingBottom: "24px"}}>
              <section className="pro-max-hero" style={{ flexShrink: 0 }}>
                <div className="pro-max-hero__copy">
                  <span className="pro-max-kicker">Ledger Pro Max</span>
                  <h1>文档、归档、备份的高级控制台</h1>
                  <p>
                    面向高强度学习、项目资料和长期资产管理，把自动收集、AI 标签、快速预览、查重清理和 3-2-1 备份放在同一个专业工作流里。
                  </p>
                  <div className="pro-max-actions">
                    <button className="btn btn-primary" onClick={() => setActiveTab("inbox")}>
                      <Inbox size={16} />
                      处理 Pro Inbox
                    </button>
                    <button className="btn" onClick={() => setActiveTab("workspace")}>
                      <FolderOpen size={16} />
                      进入工作空间
                    </button>
                    <button className="btn" onClick={() => setActiveTab("backup")}>
                      <ShieldCheck size={16} />
                      检查备份
                    </button>
                  </div>
                </div>

                <div className="pro-max-signal-grid">
                  {proMaxSignals.map(({ icon: Icon, label, value, unit, detail, accent, onClick }) => (
                    <button
                      key={label}
                      className="pro-max-signal"
                      onClick={onClick}
                      style={{ "--signal-accent": accent } as SignalStyle}
                    >
                      <span className="pro-max-signal__icon"><Icon size={18} /></span>
                      <span className="pro-max-signal__label">{label}</span>
                      <strong>{value}<small>{unit}</small></strong>
                      <span className="pro-max-signal__detail">{detail}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Metrics Grid */}
              <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", flexShrink: 0}}>
                {/* Metric 1: 文件总数 */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "8px", padding: "16px 20px", background: "linear-gradient(135deg, rgba(129, 140, 248, 0.05) 0%, rgba(129, 140, 248, 0.01) 100%)"}}>
                  <div style={{display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary)"}}>
                    <FileText size={18} />
                    <span style={{fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px"}}>文件总数</span>
                  </div>
                  <div style={{fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)"}}>{totalFiles}</div>
                  <div style={{fontSize: "11px", color: "var(--text-muted)"}}>工作空间中已索引的全部文档</div>
                </div>

                {/* Metric 2: 存储容量 */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "8px", padding: "16px 20px", background: "linear-gradient(135deg, rgba(52, 211, 153, 0.05) 0%, rgba(52, 211, 153, 0.01) 100%)"}}>
                  <div style={{display: "flex", alignItems: "center", gap: "8px", color: "var(--color-success)"}}>
                    <HardDrive size={18} />
                    <span style={{fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px"}}>存储容量</span>
                  </div>
                  <div style={{fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)"}}>{formattedSize}</div>
                  <div style={{fontSize: "11px", color: "var(--text-muted)"}}>当前归档文档占用的磁盘总量</div>
                </div>

                {/* Metric 3: 收集箱未整理 */}
                <div className="cyber-card" 
                  onClick={() => setActiveTab("inbox")}
                  style={{display: "flex", flexDirection: "column", gap: "8px", padding: "16px 20px", cursor: "pointer", transition: "all 0.2s", background: "linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(251, 191, 36, 0.01) 100%)"}}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--color-warning)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-light)"}
                >
                  <div style={{display: "flex", alignItems: "center", gap: "8px", color: "var(--color-warning)"}}>
                    <Inbox size={18} />
                    <span style={{fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px"}}>收集箱待处理</span>
                  </div>
                  <div style={{fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)"}}>{unorganizedCount}</div>
                  <div style={{fontSize: "11px", color: "var(--color-warning)", fontWeight: 500}}>点击前往待整理列表 📥</div>
                </div>

                {/* Metric 4: 使用标签数 */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "8px", padding: "16px 20px", background: "linear-gradient(135deg, rgba(167, 139, 250, 0.05) 0%, rgba(167, 139, 250, 0.01) 100%)"}}>
                  <div style={{display: "flex", alignItems: "center", gap: "8px", color: "#a78bfa"}}>
                    <Layers size={18} />
                    <span style={{fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px"}}>已用标签数</span>
                  </div>
                  <div style={{fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)"}}>{tagsCount}</div>
                  <div style={{fontSize: "11px", color: "var(--text-muted)"}}>当前已打在文件上的主客观标签</div>
                </div>

                {/* Metric 5: 近7天整理量 */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "8px", padding: "16px 20px", background: "linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(56, 189, 248, 0.01) 100%)"}}>
                  <div style={{display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary)"}}>
                    <Sparkles size={18} />
                    <span style={{fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px"}}>近7天整理量</span>
                  </div>
                  <div style={{fontSize: "28px", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)"}}>{recentFilesCount}</div>
                  <div style={{fontSize: "11px", color: "var(--text-muted)"}}>最近一周新增归档及整理的文件数</div>
                </div>
              </div>

              {/* Insight Strip */}
              <div style={{
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                background: theme === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)", 
                padding: "8px 16px", 
                borderRadius: "10px", 
                border: "1px solid var(--border-light)",
                flexShrink: 0
              }}>
                <span style={{fontSize: "11px", color: "var(--text-muted)"}}>
                  待处理: <strong style={{color: "var(--color-warning)"}}>{unorganizedCount} 个</strong>
                </span>
                <span style={{color: "var(--border-light)"}}>|</span>
                <span style={{fontSize: "11px", color: "var(--text-muted)"}}>
                  标签覆盖率: <strong style={{color: "var(--color-success)"}}>{archiveCoverage}%</strong>
                </span>
                <span style={{color: "var(--border-light)"}}>|</span>
                <span style={{fontSize: "11px", color: "var(--text-muted)"}}>
                  近7天整理度: <strong style={{color: "var(--color-primary)"}}>{recentFilesCount} 个文件</strong>
                </span>
              </div>

              {/* Charts Section */}
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flexShrink: 0}}>
                {/* Chart 1: Tag Distribution popularity */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "16px", minHeight: "260px", position: "relative"}}>
                  <h3 className="card-title">🏷️ 常用标签热度分布</h3>
                  <div style={{display: "flex", flexDirection: "column", gap: "14px", flex: 1, justifyContent: "center"}}>
                    {sortedTags.length === 0 ? (
                      <div style={{textAlign: "center", color: "var(--text-muted)", fontSize: "13px"}}>暂无标签使用统计</div>
                    ) : (
                      sortedTags.map(([tag, count], idx) => {
                        const widthPct = Math.max(8, Math.round((count / maxTagCount) * 100));
                        const accentColor = getTagColor(tag);
                        return (
                          <div key={idx} style={{display: "flex", alignItems: "center", gap: "12px"}}>
                            <span 
                              onClick={() => {
                                setActiveTab("workspace");
                                setSelectedTagsFilter([tag]);
                              }}
                              style={{
                                width: "90px", 
                                fontSize: "12px", 
                                fontWeight: 600, 
                                color: accentColor, 
                                overflow: "hidden", 
                                textOverflow: "ellipsis", 
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                                borderBottom: "1px dashed transparent"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = accentColor}
                              onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = "transparent"}
                              title={`点击筛选标签: ${tag}`}
                            >
                              {tag.replace(/^#/, "")}
                            </span>
                            <div style={{flex: 1, height: "14px", background: theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)", borderRadius: "99px", overflow: "hidden", position: "relative"}}>
                              <div style={{
                                width: `${widthPct}%`, 
                                height: "100%", 
                                background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}dd 100%)`, 
                                borderRadius: "99px",
                                boxShadow: `0 0 10px ${accentColor}33`
                              }} />
                            </div>
                            <span style={{width: "30px", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textAlign: "right"}}>{count}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Chart 2: SVG Spline Weekly Activity Trend */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "12px", minHeight: "260px", position: "relative"}}>
                  <h3 className="card-title">📈 近 7 天整理趋势看板</h3>
                  <div style={{position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center"}}>
                    {totalFiles === 0 ? (
                      <div style={{textAlign: "center", color: "var(--text-muted)", fontSize: "13px"}}>暂无近 7 天活动数据</div>
                    ) : (
                      <div style={{position: "relative", width: "100%", height: "160px"}}>
                        {/* Interactive vertical cursor line */}
                        {hoveredWeeklyIndex !== null && splinePoints[hoveredWeeklyIndex] && (
                          <div style={{
                            position: "absolute",
                            left: `${(splinePoints[hoveredWeeklyIndex].x / 480) * 100}%`,
                            top: "20px",
                            bottom: "30px",
                            width: "1px",
                            borderLeft: "1px dashed var(--color-primary)",
                            opacity: 0.6,
                            pointerEvents: "none"
                          }} />
                        )}

                        <svg 
                          width="100%" 
                          height="100%" 
                          viewBox="0 0 480 160" 
                          preserveAspectRatio="none"
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 480;
                            // Find closest point by X coordinate
                            let closestIdx = 0;
                            let minDist = 9999;
                            splinePoints.forEach((pt, idx) => {
                              const dist = Math.abs(pt.x - x);
                              if (dist < minDist) {
                                minDist = dist;
                                closestIdx = idx;
                              }
                            });
                            if (minDist < 40) {
                              setHoveredWeeklyIndex(closestIdx);
                              setWeeklyTooltipPos({
                                x: e.clientX - rect.left,
                                y: splinePoints[closestIdx].y - 45
                              });
                            } else {
                              setHoveredWeeklyIndex(null);
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredWeeklyIndex(null);
                          }}
                          style={{overflow: "visible", cursor: "crosshair"}}
                        >
                          <defs>
                            <linearGradient id="splineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          <line x1="40" y1="20" x2="440" y2="20" stroke={theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"} strokeDasharray="3 3" />
                          <line x1="40" y1="75" x2="440" y2="75" stroke={theme === "light" ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)"} strokeDasharray="3 3" />
                          <line x1="40" y1="130" x2="440" y2="130" stroke="var(--border-light)" />

                          {/* Spline Area Path */}
                          {areaPathStr && (
                            <path d={areaPathStr} fill="url(#splineAreaGrad)" stroke="none" />
                          )}

                          {/* Spline Stroke Path */}
                          {linePathStr && (
                            <path d={linePathStr} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          )}

                          {/* Coordinate Points & Labels */}
                          {splinePoints.map((pt, idx) => {
                            const isHovered = idx === hoveredWeeklyIndex;
                            return (
                              <g key={idx}>
                                {/* Date Label */}
                                <text 
                                  x={pt.x} 
                                  y="152" 
                                  fontSize="10" 
                                  fill="var(--text-muted)" 
                                  textAnchor="middle"
                                  fontWeight={isHovered ? 600 : 400}
                                >
                                  {pt.label}
                                </text>

                                {/* Value label strictly above active dots */}
                                <text 
                                  x={pt.x} 
                                  y={pt.y - 10} 
                                  fontSize="10" 
                                  fill="var(--text-primary)" 
                                  fontWeight="700" 
                                  textAnchor="middle"
                                >
                                  {pt.count}
                                </text>

                                {/* Coordinate Circle Node */}
                                <circle 
                                  cx={pt.x} 
                                  cy={pt.y} 
                                  r={isHovered ? 6 : 4} 
                                  fill="var(--bg-secondary)" 
                                  stroke="var(--color-primary)" 
                                  strokeWidth={isHovered ? 3 : 2} 
                                  style={{transition: "all 0.15s ease-out"}}
                                />
                              </g>
                            );
                          })}
                        </svg>

                        {/* Spline Floating Tooltip */}
                        {hoveredWeeklyIndex !== null && weeklyTooltipPos && splinePoints[hoveredWeeklyIndex] && (
                          <div style={{
                            position: "absolute",
                            left: `${weeklyTooltipPos.x}px`,
                            top: `${weeklyTooltipPos.y}px`,
                            transform: "translateX(-50%)",
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            boxShadow: "var(--shadow-lg)",
                            pointerEvents: "none",
                            zIndex: 100,
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            minWidth: "90px"
                          }}>
                            <span style={{fontSize: "10px", color: "var(--text-muted)"}}>日期: {splinePoints[hoveredWeeklyIndex].label}</span>
                            <span style={{fontSize: "11px", color: "var(--color-primary)", fontWeight: 700}}>整理量: {splinePoints[hoveredWeeklyIndex].count} 个</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* System Health Grid */}
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flexShrink: 0}}>
                {/* Card 1: Desktop Cleanliness */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "10px", padding: "16px 20px"}}>
                  <h3 className="card-title">🧹 本地桌面整理状况</h3>
                  <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0"}}>
                    <div>
                      <div style={{fontSize: "18px", fontWeight: 700, color: desktopSummary.normal_files > 10 ? "var(--color-warning)" : "var(--color-success)"}}>
                        桌面普通文件: {desktopSummary.normal_files} 个
                      </div>
                      <div style={{fontSize: "12px", color: "var(--text-muted)", marginTop: "4px"}}>
                        规范建议桌面普通文件数 ≤ 10，保持系统清爽。
                      </div>
                    </div>
                    <span className={`badge ${desktopSummary.normal_files > 15 ? "badge-danger" : (desktopSummary.normal_files > 8 ? "badge-warning" : "badge-success")}`} style={{padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 600}}>
                      {desktopSummary.normal_files > 15 ? "急需整理" : (desktopSummary.normal_files > 8 ? "整理预警" : "健康良好")}
                    </span>
                  </div>

                  {/* Summary list */}
                  <div style={{display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "8px", fontSize: "11px", color: "var(--text-muted)"}}>
                    <span>文件夹: {desktopSummary.folders} 个</span>
                    <span>•</span>
                    <span>快捷方式: {desktopSummary.shortcuts} 个</span>
                    <span>•</span>
                    <span>临时文件: {desktopSummary.temporary_files} 个</span>
                  </div>

                  <div style={{display: "flex", gap: "10px", marginTop: "4px"}}>
                    <button 
                      onClick={handleCleanDesktop}
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        padding: "10px",
                        fontSize: "12px",
                        borderRadius: "8px",
                        background: "var(--color-success)",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      🧹 一键迁移桌面普通文件到收集箱
                    </button>
                    <button 
                      onClick={() => setActiveTab("inbox")}
                      className="btn"
                      style={{
                        padding: "10px 16px",
                        fontSize: "12px",
                        borderRadius: "8px",
                        background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
                        border: "1px solid var(--border-light)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                    >
                      前往收集箱
                    </button>
                  </div>
                </div>

                {/* Card 2: 3-2-1 Backup Health */}
                <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "10px", padding: "16px 20px"}}>
                  <h3 className="card-title">🛡️ 3-2-1 备份健康度评估</h3>
                  <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0"}}>
                    <div>
                      <div style={{fontSize: "20px", fontWeight: 700, color: backupScore >= 100 ? "var(--color-success)" : (backupScore >= 70 ? "var(--color-warning)" : "var(--color-danger)")}}>
                        备份安全指数: {backupScore} 分
                      </div>
                      <div style={{fontSize: "12px", color: "var(--text-muted)", marginTop: "4px"}}>
                        标准 3-2-1 规范：3个备份，2种不同介质，1个异地归档。
                      </div>
                    </div>
                    <div style={{
                      width: "48px", 
                      height: "48px", 
                      borderRadius: "50%", 
                      border: `3px solid ${backupScore >= 100 ? "var(--color-success)" : (backupScore >= 70 ? "var(--color-warning)" : "var(--color-danger)")}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--text-primary)"
                    }}>
                      {backupScore}%
                    </div>
                  </div>

                  {/* Bullet Lists */}
                  <div style={{display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px"}}>
                    <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                      <span style={{width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-success)"}} />
                      <span style={{color: "var(--text-secondary)"}}>1. 主数据备份 (本地主工作空间盘): <strong style={{color: "var(--color-success)"}}>正常安全运行中 (40分)</strong></span>
                    </div>
                    <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                      <span style={{width: "8px", height: "8px", borderRadius: "50%", background: hasDiskBackup ? "var(--color-success)" : "var(--color-danger)"}} />
                      <span style={{color: "var(--text-secondary)"}}>2. 外部独立介质 (物理移动硬盘): <strong style={{color: hasDiskBackup ? "var(--color-success)" : "var(--color-danger)"}}>{hasDiskBackup ? `已配置 - ${backupDiskDir} (30分)` : "未配置 (缺30分)"}</strong></span>
                    </div>
                    <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                      <span style={{width: "8px", height: "8px", borderRadius: "50%", background: hasCloudBackup ? "var(--color-success)" : "var(--color-danger)"}} />
                      <span style={{color: "var(--text-secondary)"}}>3. 异地安全存储 (坚果云/OneDrive): <strong style={{color: hasCloudBackup ? "var(--color-success)" : "var(--color-danger)"}}>{hasCloudBackup ? `已配置 - ${backupCloudDir} (30分)` : "未配置 (缺30分)"}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Documents Section */}
              <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "12px", padding: "16px 20px", marginBottom: "20px", flexShrink: 0}}>
                <h3 className="card-title">📅 最近发生更新或修改的文档 (最新 5 个)</h3>
                <div style={{overflowX: "auto"}}>
                  <table style={{width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px"}}>
                    <thead>
                      <tr style={{borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)", height: "30px"}}>
                        <th style={{padding: "6px 12px"}}>名称</th>
                        <th style={{padding: "6px 12px"}}>分类目录</th>
                        <th style={{padding: "6px 12px"}}>大小</th>
                        <th style={{padding: "6px 12px"}}>修改时间</th>
                        <th style={{padding: "6px 12px", textAlign: "right"}}>快捷操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRecentFiles.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{textAlign: "center", padding: "30px", color: "var(--text-muted)"}}>暂无最近修改文档数据</td>
                        </tr>
                      ) : (
                        topRecentFiles.map((file, idx) => {
                          const fileFolder = file.filepath.toString().substring(0, file.filepath.toString().lastIndexOf("/"));
                          return (
                            <tr 
                              key={idx} 
                              style={{
                                borderBottom: "1px solid var(--border-light)", 
                                height: "38px",
                                background: "transparent",
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <td style={{padding: "6px 12px", fontWeight: 600, color: "var(--text-primary)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}} title={file.filename.toString()}>
                                {file.filename.toString()}
                              </td>
                              <td style={{padding: "6px 12px", color: "var(--color-primary)", fontWeight: 500}}>
                                {fileFolder || "根目录"}
                              </td>
                              <td style={{padding: "6px 12px", color: "var(--text-secondary)"}}>
                                {formatSize(file.file_size)}
                              </td>
                              <td style={{padding: "6px 12px", color: "var(--text-muted)"}}>
                                {new Date(Number(file.modified_time) * 1000).toLocaleString("zh-CN", {hour12: false})}
                              </td>
                              <td style={{padding: "6px 12px", textAlign: "right"}}>
                                <div style={{display: "flex", gap: "6px", justifyContent: "flex-end"}}>
                                  <button 
                                    onClick={() => {
                                      setActiveTab("workspace");
                                      setSelectedWorkspaceFile(file);
                                    }}
                                    className="btn"
                                    style={{
                                      padding: "4px 8px",
                                      fontSize: "11px",
                                      borderRadius: "6px",
                                      background: "rgba(129, 140, 248, 0.08)",
                                      border: "1px solid rgba(129, 140, 248, 0.2)",
                                      color: "var(--color-primary)",
                                      cursor: "pointer"
                                    }}
                                  >
                                    预览
                                  </button>
                                  <button 
                                    onClick={() => invoke("open_in_system", { workspaceDir, filepath: file.filepath })}
                                    className="btn"
                                    style={{
                                      padding: "4px 8px",
                                      fontSize: "11px",
                                      borderRadius: "6px",
                                      background: "rgba(52, 211, 153, 0.08)",
                                      border: "1px solid rgba(52, 211, 153, 0.2)",
                                      color: "var(--color-success)",
                                      cursor: "pointer"
                                    }}
                                  >
                                    系统打开
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 1. INBOX TAB */}
          {activeTab === "inbox" && (
            <div style={{display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px", height: "100%"}}>
              {/* Left Panel: Desktop clean & Inbox List */}
              <div style={{display: "flex", flexDirection: "column", gap: "20px"}}>
                {/* Desktop Summary Panel */}
                <div className="cyber-card" style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)"}}>
                  <div>
                    <h3 className="card-title"><Sparkles size={18} className="text-primary" /> 本地桌面健康度</h3>
                    <p className="card-desc" style={{marginTop: "6px"}}>
                      发现桌面有 <strong style={{color: "var(--color-warning)"}}>{desktopSummary.normal_files}</strong> 个未归类文档，
                      <strong style={{color: "var(--color-primary)"}}>{desktopSummary.folders}</strong> 个文件夹。
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={handleCleanDesktop}>
                    🧹 一键整理到收集箱
                  </button>
                </div>

                {/* Inbox files List */}
                <div style={{display: "flex", flexDirection: "column", gap: "16px", flex: 1, minHeight: 0}}>
                  <h3 className="card-title" style={{flexShrink: 0}}>📥 收集箱待整理文件 ({inboxFiles.length})</h3>
                  {inboxFiles.length === 0 ? (
                    <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, border: "2px dashed var(--border-light)", borderRadius: "16px", padding: "40px", color: "var(--text-secondary)"}}>
                      <CheckCircle2 size={48} style={{color: "var(--color-success)", marginBottom: "16px"}} />
                      <p style={{fontSize: "15px", fontWeight: 500}}>收集箱空空如也，桌面十分整洁！</p>
                      <p style={{fontSize: "13px", color: "var(--text-muted)", marginTop: "4px"}}>您可以从外部拖入文件或将文件放置于监听文件夹中。</p>
                    </div>
                  ) : (
                    <div style={{display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1, minHeight: 0, paddingRight: "6px"}}>
                      {inboxFiles.map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedInboxFile(file);
                            setTopicName(file.filename.toString().substring(0, file.filename.toString().lastIndexOf(".")));
                            setInboxRightTab("archive");
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
                            borderColor: selectedInboxFile?.filepath === file.filepath ? "var(--color-primary)" : "var(--border-light)",
                            background: selectedInboxFile?.filepath === file.filepath ? "var(--color-primary-glow)" : "var(--bg-secondary)",
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
                              {(file.tags ? String(file.tags).split(",").filter(t => t.trim()) : []).slice(0, 2).map((tag, ti) => {
                                const tagVal = tag.trim().replace(/^#/, "");
                                if (!tagVal) return null;
                                const tagColors: Record<string, string> = { completed: "#34d399", done: "#34d399", active: "#fbbf24", pending: "#f87171", important: "#a78bfa" };
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
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Smart naming & categorization */}
              <div>
                {selectedInboxFile ? (
                  <div className="cyber-card" style={{height: "100%", display: "flex", flexDirection: "column", gap: "16px"}}>
                    <div style={{display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflow: "hidden"}}>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "10px", marginBottom: "4px", flexShrink: 0}}>
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

                        <div style={{display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto", paddingRight: "4px"}}>
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
                                    <X size={10} onClick={() => setChosenTags(chosenTags.filter(t => t !== tag))} />
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Target Folder */}
                          <div>
                            <label style={{fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "8px"}}>🚀 目标归档分类</label>
                            <select 
                              value={targetCategory} 
                              onChange={(e) => setTargetCategory(e.target.value)}
                              className="input-field"
                            >
                              {standardDirs.map((dir, idx) => (
                                <option key={idx} value={dir}>{dir}</option>
                              ))}
                            </select>
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
                        <div style={{background: theme === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-light)", flexShrink: 0}}>
                          <div style={{fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px"}}>更名预览</div>
                          <div style={{fontSize: "13px", wordBreak: "break-all", fontWeight: 600, color: "var(--color-primary)"}}>{getFormattedName(selectedInboxFile.filename.toString())}</div>
                        </div>

                        <button className="btn btn-primary" onClick={handleArchiveFile} style={{width: "100%", justifyContent: "center", flexShrink: 0}}>
                          📁 执行智能归档搬运
                        </button>
                      </div>
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
          )}

          {/* 2. WORKSPACE TAB */}
          {activeTab === "workspace" && (
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
                    const count = workspaceFiles.filter(f => {
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
                    onClick={() => setIsCreateProjectExpanded(true)}
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
                        <Sparkles size={18} />
                      </div>
                      <div style={{textAlign: "left"}}>
                        <div style={{fontWeight: 600, fontSize: "14px", color: "var(--text-primary)"}}>新建科研/项目</div>
                        <div style={{fontSize: "12px", color: "var(--text-muted)", marginTop: "2px"}}>{projectRootDir}</div>
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
                      width: `${Math.min(100, Math.round((workspaceFiles.length / 500) * 100))}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 100%)",
                      borderRadius: "99px"
                    }} />
                  </div>
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)"}}>
                    <span>总文档: {workspaceFiles.length} / 500 个</span>
                    <span>备份率: {workspaceFiles.length > 0 ? Math.round((workspaceFiles.filter(f => f.backup_disk_status === 1 || f.backup_cloud_status === 1).length / workspaceFiles.length) * 100) : 0}%</span>
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
                        paddingRight: "16px",
                        height: "40px",
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        color: "var(--text-primary)",
                        fontSize: "14px"
                      }}
                    />
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

                  <select 
                    value={extensionFilter} 
                    onChange={(e) => setExtensionFilter(e.target.value)}
                    style={{
                      width: "140px", 
                      padding: "6px 12px", 
                      fontSize: "13px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-light)",
                      background: theme === "light" ? "#fff" : "rgba(0,0,0,0.2)",
                      color: "var(--text-primary)",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="">文件类型不限</option>
                    <option value="pdf">📄 PDF 文档</option>
                    <option value="image">🖼️ 图片图像</option>
                    <option value="doc">📝 工作文档</option>
                    <option value="code">💻 代码配置</option>
                    <option value="archive">📦 压缩归档</option>
                  </select>

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

                {/* Workspace Files List */}
                <div style={{display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0, overflowY: "auto"}}>
                  {workspaceFiles.length === 0 ? (
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
                    workspaceFiles.map((file, idx) => {
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
                              // Prep editor state in case editing is clicked
                              setEditDescriptionInput(file.description?.toString() || "");
                              setEditTagsInput(file.tags ? file.tags.split(",").map(t => t.trim()) : []);
                              setIsEditingMetadata(false);
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
                            {file.tags && file.tags.split(",").slice(0, 2).map((t, i) => (
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
                      {workspaceFiles.map((file, idx) => {
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
                                // Prep editor state in case editing is clicked
                                setEditDescriptionInput(file.description?.toString() || "");
                                setEditTagsInput(file.tags ? file.tags.split(",").map(t => t.trim()) : []);
                                setIsEditingMetadata(false);
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
                              if (!isSelected && !isChecked) {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
                                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected && !isChecked) {
                                e.currentTarget.style.borderColor = "var(--border-light)";
                                e.currentTarget.style.background = "var(--bg-secondary)";
                              }
                            }}
                          >
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
                            
                            {/* Massive solid capsule card */}
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
                              {file.tags && file.tags.split(",").slice(0, 1).map((t, i) => (
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
              <div>
                {selectedWorkspaceFile ? (
                  <div className="cyber-card" style={{height: "100%", display: "flex", flexDirection: "column", gap: "20px"}}>
                    <div>
                      <h3 className="card-title" style={{fontSize: "16px"}}>{selectedWorkspaceFile.filename}</h3>
                      <p style={{fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", wordBreak: "break-all"}}>{selectedWorkspaceFile.filepath}</p>
                    </div>

                    <div style={{display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto", paddingRight: "4px"}}>
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
                                  ...workspaceFiles.flatMap(f => f.tags ? f.tags.split(",").map(t => t.trim()) : []),
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
                                  if (e.key === "Enter") {
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
                            {selectedWorkspaceFile.tags ? selectedWorkspaceFile.tags.split(",").map((t, i) => (
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
                            setEditTagsInput(selectedWorkspaceFile.tags ? selectedWorkspaceFile.tags.split(",").map(t => t.trim()) : []);
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
          )}

          {/* 3. BACKUP TAB */}
          {activeTab === "backup" && (
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", height: "100%"}}>
              {/* Left Column: Backup Executions */}
              <div style={{display: "flex", flexDirection: "column", gap: "20px"}}>
                {/* 3-2-1 backup configuration cards */}
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px"}}>
                  {/* Disk Backup card */}
                  <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                    <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                      <div style={{background: "var(--color-primary-glow)", padding: "8px", borderRadius: "8px", color: "var(--color-primary)"}}>
                        <HardDrive size={22} />
                      </div>
                      <h3 style={{fontSize: "15px", fontWeight: 600}}>外部存储介质备份</h3>
                    </div>
                    <p style={{fontSize: "12px", color: "var(--text-secondary)"}}>将工作空间所有数据安全镜像备份到移动硬盘或本地闪存卡中。</p>
                    <button className="btn btn-primary" onClick={() => handleRunBackup("disk")} style={{width: "100%", justifyContent: "center"}}>
                      开始增量备份
                    </button>
                  </div>

                  {/* Cloud Backup card */}
                  <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                    <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                      <div style={{background: "var(--color-success-glow)", padding: "8px", borderRadius: "8px", color: "var(--color-success)"}}>
                        <Cloud size={22} />
                      </div>
                      <h3 style={{fontSize: "15px", fontWeight: 600}}>私有云盘异地备份</h3>
                    </div>
                    <p style={{fontSize: "12px", color: "var(--text-secondary)"}}>同步数据至百度云/坚果云/OneDrive等挂载盘完成异地多活备份。</p>
                    <button className="btn" onClick={() => handleRunBackup("cloud")} style={{width: "100%", justifyContent: "center", borderColor: "var(--color-success)", color: "var(--color-success)"}}>
                      开始云盘备份
                    </button>
                  </div>
                </div>

                {/* Active backup terminal console */}
                <div className="cyber-card" style={{flex: 1, display: "flex", flexDirection: "column", gap: "12px"}}>
                  <h4 style={{fontSize: "13px", fontWeight: 600}}>💻 实时备份监控控制台</h4>
                  <div style={{
                    flex: 1, 
                    background: "#0a0b10", 
                    borderRadius: "10px", 
                    padding: "16px", 
                    fontFamily: "var(--mono)", 
                    fontSize: "12px", 
                    color: "#10b981", 
                    overflowY: "auto",
                    maxHeight: "340px",
                    display: "flex",
                    flexDirection: "column-reverse"
                  }}>
                    {backupConsole.length === 0 ? (
                      <span style={{color: "#4b5563"}}>等待备份任务启动...</span>
                    ) : (
                      backupConsole.map((log, idx) => (
                        <div key={idx} style={{marginBottom: "4px"}}>{log}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Backup History */}
              <div className="cyber-card" style={{display: "flex", flexDirection: "column", gap: "20px"}}>
                <h3 className="card-title">📜 备份历史记录列表</h3>
                
                <div style={{display: "flex", flexDirection: "column", gap: "12px", flex: 1, overflowY: "auto", maxHeight: "calc(100vh - 220px)"}}>
                  {backupHistory.length === 0 ? (
                    <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-secondary)"}}>
                      <AlertTriangle size={32} style={{color: "var(--text-muted)", marginBottom: "12px"}} />
                      <p style={{fontSize: "13px"}}>暂无历史备份记录，请立即执行您的首次备份！</p>
                    </div>
                  ) : (
                    backupHistory.map((item, idx) => (
                      <div key={idx} style={{background: theme === "light" ? "rgba(0, 0, 0, 0.02)" : "rgba(255,255,255,0.01)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "12px 16px"}}>
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px"}}>
                          <span style={{fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px"}}>
                            {item.backup_type === "disk" ? <HardDrive size={14} style={{color: "var(--color-primary)"}} /> : <Cloud size={14} style={{color: "var(--color-success)"}} />}
                            {item.backup_type === "disk" ? "本地移动硬盘镜像" : "私有云端归档备份"}
                          </span>
                          <span className={`badge ${item.status === "success" ? "badge-success" : "badge-danger"}`} style={{fontSize: "9px"}}>
                            {item.status}
                          </span>
                        </div>
                        <div style={{display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)"}}>
                          <span>同步: {item.files_copied}文件 ({formatSize(item.bytes_copied)})</span>
                          <span>{item.timestamp}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="settings-shell" style={{ overflowY: "auto", flex: 1, height: "100%", paddingRight: "6px", paddingBottom: "30px" }}>
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

              <section className="settings-section">
                <div className="settings-section__title">
                  <h4>路径与备份目标</h4>
                  <span>真实校验目录状态，降低保存后才发现路径不可用的概率。</span>
                </div>
                <div className="settings-path-grid">
                  {[
                    { key: "workspace" as const, label: "工作空间根路径", value: workspaceDir, setter: setWorkspaceDir, required: true },
                    { key: "monitor" as const, label: "多目录监听 (支持添加多个不同目录)", value: monitoredDirs, setter: setMonitoredDirs, required: true },
                    { key: "disk" as const, label: "外部硬盘备份路径", value: backupDiskDir, setter: setBackupDiskDir, required: false },
                    { key: "cloud" as const, label: "私有网盘/云端备份路径", value: backupCloudDir, setter: setBackupCloudDir, required: false },
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
                </div>
              </section>

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

              <div className="settings-savebar">
                <div className={`settings-status ${saveStatus === "error" ? "warn" : saveStatus === "saved" ? "ok" : ""}`}>
                  {saveMessage || "修改配置后请保存，保存会同步工作空间与监听规则。"}
                </div>
                <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saveStatus === "saving"}>
                  <Save size={16} />
                  {saveStatus === "saving" ? "保存中..." : "保存全局配置并热加载"}
                </button>
              </div>
            </div>
          )}

          {/* 5. DUPLICATES TAB */}
          {activeTab === "duplicates" && (
            <DuplicateFinder 
              workspaceDir={workspaceDir} 
              onRefreshWorkspace={handleRefreshData} 
              addLog={addLog} 
              theme={theme}
            />
          )}

        </div>
      </div>

      {/* 🤐 Safe Zip Archive Modal Popup */}
      {showZipModal && (
        <ZipArchiveModal 
          workspaceDir={workspaceDir}
          selectedFilenames={checkedWorkspaceFiles}
          theme={theme}
          onClose={() => {
            setShowZipModal(false);
            setCheckedWorkspaceFiles([]);
            setMultiSelectMode(false);
          }}
          onSuccess={() => {
            handleRefreshData();
          }}
          addLog={addLog}
        />
      )}



      {/* --- NEW MODALS --- */}
      {isCreateFolderExpanded && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div style={{ width: "400px", background: theme === "light" ? "#fff" : "#1e1e1e", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}><FolderPlus size={18} className="primary" /> 新建子目录</h3>
              <button onClick={() => setIsCreateFolderExpanded(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="create-mini-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>根目录</label>
                <select value={createFolderRoot} onChange={(e) => setCreateFolderRoot(e.target.value)} className="input-field">
                  {creatableRoots.map(dir => <option key={dir} value={dir}>{dir}</option>)}
                </select>
              </div>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>父级路径</label>
                <input type="text" placeholder="可选，例如 项目/2024" value={createFolderSubpath} onChange={(e) => setCreateFolderSubpath(e.target.value)} className="input-field" />
              </div>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>子目录名</label>
                <input type="text" placeholder="输入文件夹名称" value={newFolderInput} onChange={(e) => setNewFolderInput(e.target.value)} className="input-field" />
              </div>
              <div className={`path-preview ${folderValidationMessage ? "invalid" : "valid"}`} style={{ padding: "12px", borderRadius: "8px", background: theme === "light" ? "#f8fafc" : "rgba(0,0,0,0.2)", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>预览路径</span>
                  <strong>深度 {folderDepth}/4</strong>
                </div>
                <div style={{ wordBreak: "break-all", color: "var(--text-primary)" }}>{folderFinalPath || `${createFolderRoot}/新文件夹`}</div>
              </div>
              <div style={{ fontSize: "12px", color: folderValidationMessage ? "var(--color-danger)" : "var(--color-success)" }}>
                {folderValidationMessage || "✓ 路径符合工作区 4 层规范。"}
              </div>
              <button className="btn btn-primary" disabled={!canCreateFolder} onClick={() => { handleCreateFolder(); setIsCreateFolderExpanded(false); }} style={{ width: "100%", padding: "12px", marginTop: "8px", display: "flex", justifyContent: "center", gap: "8px" }}>
                <Plus size={16} /> 创建目录
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateProjectExpanded && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div style={{ width: "420px", background: theme === "light" ? "#fff" : "#1e1e1e", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#10b981" }}><Sparkles size={18} /> 新建科研/项目</h3>
              <button onClick={() => setIsCreateProjectExpanded(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="create-mini-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>目标位置</div>
                <strong style={{ color: "var(--text-primary)" }}>{projectRootDir}</strong>
              </div>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>项目名称</label>
                <input type="text" placeholder="如: 量子力学大作业" value={newProjectInput} onChange={(e) => setNewProjectInput(e.target.value)} className="input-field" />
              </div>
              <div className={`path-preview ${canCreateProject ? "valid" : "invalid"}`} style={{ padding: "12px", borderRadius: "8px", background: theme === "light" ? "#f8fafc" : "rgba(0,0,0,0.2)", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>生成的目录结构</span>
                  <strong>深度 {projectDepth}/4</strong>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "8px", borderLeft: "2px solid rgba(16, 185, 129, 0.5)", fontFamily: "var(--mono)", color: "var(--text-primary)" }}>
                  <div>{normalizedProjectName || "项目名称"}/</div>
                  {projectSubdirs.slice(0,3).map(subdir => <div key={subdir} style={{ paddingLeft: "16px", color: "var(--text-muted)" }}>├── {subdir}/</div>)}
                  <div style={{ paddingLeft: "16px", color: "var(--text-muted)" }}>├── ... (更多目录)</div>
                  <div style={{ paddingLeft: "16px", color: "var(--text-muted)" }}>└── README.md</div>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: projectNameError ? "var(--color-danger)" : "var(--color-success)" }}>
                {projectNameError || "✓ 将自动生成标准科研/项目目录结构。"}
              </div>
              <button className="btn btn-primary" disabled={!canCreateProject} onClick={() => { handleCreateProject(); setIsCreateProjectExpanded(false); }} style={{ width: "100%", padding: "12px", marginTop: "8px", display: "flex", justifyContent: "center", gap: "8px", background: "#10b981", borderColor: "#10b981" }}>
                <Sparkles size={16} /> 初始化项目
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Premium Rename File Modal */}
      {renameModalShow && renameFileTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div style={{ 
            width: "400px", 
            background: theme === "light" ? "rgba(255, 255, 255, 0.9)" : "rgba(20, 20, 30, 0.85)", 
            backdropFilter: "blur(20px)",
            border: "1px solid var(--border-light)",
            borderRadius: "16px", 
            padding: "24px", 
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary)", fontWeight: 700 }}><Edit3 size={18} /> 快捷重命名</h3>
              <button onClick={() => { setRenameModalShow(false); setRenameFileTarget(null); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}><X size={18} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "8px", background: theme === "light" ? "#f8fafc" : "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)" }}>
                {getFileIcon(renameFileTarget.filename.toString(), 32)}
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>原文件名</div>
                  <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{renameFileTarget.filename}</strong>
                </div>
              </div>

              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>新文件名 (无需输入后缀)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input 
                    type="text" 
                    placeholder="输入新的文件名" 
                    value={renameNewNameInput} 
                    onChange={(e) => setRenameNewNameInput(e.target.value)} 
                    className="input-field"
                    style={{ flex: 1, height: "38px" }}
                    autoFocus
                  />
                  <span style={{ 
                    height: "38px",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 14px", 
                    background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", 
                    borderRadius: "8px", 
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-light)" 
                  }}>
                    {renameFileTarget.filename.includes(".") 
                      ? renameFileTarget.filename.substring(renameFileTarget.filename.lastIndexOf("."))
                      : ""}
                  </span>
                </div>
              </div>

              <div style={{ 
                padding: "12px", 
                borderRadius: "8px", 
                background: theme === "light" ? "rgba(99, 102, 241, 0.05)" : "rgba(99, 102, 241, 0.1)", 
                border: "1px solid rgba(99, 102, 241, 0.2)",
                fontSize: "12px" 
              }}>
                <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>重命名后路径</div>
                <div style={{ wordBreak: "break-all", color: "var(--text-primary)", fontWeight: 500, fontFamily: "monospace" }}>
                  {(() => {
                    const ext = renameFileTarget.filename.includes(".") 
                      ? renameFileTarget.filename.substring(renameFileTarget.filename.lastIndexOf("."))
                      : "";
                    const pathWithSlash = renameFileTarget.filepath.replace(/\\/g, "/");
                    const parentDir = pathWithSlash.includes("/")
                      ? pathWithSlash.substring(0, pathWithSlash.lastIndexOf("/"))
                      : "";
                    const newName = renameNewNameInput.trim() + ext;
                    return parentDir ? `${parentDir}/${newName}` : newName;
                  })()}
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                disabled={!renameNewNameInput.trim()} 
                onClick={handleRenameExecute} 
                style={{ width: "100%", padding: "12px", marginTop: "8px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontWeight: 600 }}
              >
                ✓ 确认重命名
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👑 Global Stacked Toast Notification Center */}
      <div style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none"
      }}>
        {toasts.map(t => {
          const icons = {
            success: "🟢",
            warning: "🟡",
            error: "🔴",
            info: "🔵"
          };
          return (
            <div key={t.id} className={`toast-card toast-${t.type}`} style={{ pointerEvents: "auto" }}>
              <span style={{ fontSize: "14px" }}>{icons[t.type]}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "2px 6px"
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* 👑 High-Contrast Glassmorphism Context Menu */}
      {contextMenu.show && contextMenu.file && (
        <div 
          className="context-menu"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="context-menu-item"
            onClick={() => {
              setActiveTab("workspace");
              setSelectedWorkspaceFile(contextMenu.file);
              setPreviewFile(contextMenu.file);
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            👁️ 预览文件
          </div>
          <div 
            className="context-menu-item"
            onClick={() => {
              if (contextMenu.file) {
                invoke("open_in_system", { workspaceDir, filepath: contextMenu.file.filepath });
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            🖥️ 系统中打开
          </div>
          <div 
            className="context-menu-item"
            onClick={() => {
              if (contextMenu.file) {
                navigator.clipboard.writeText(contextMenu.file.filepath.toString());
                showToast("已成功复制路径到剪贴板！", "success");
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            🔗 复制文件路径
          </div>
          <div 
            className="context-menu-item"
            onClick={() => {
              if (contextMenu.file) {
                setRenameFileTarget(contextMenu.file);
                const nameWithoutExt = contextMenu.file.filename.includes(".") 
                  ? contextMenu.file.filename.substring(0, contextMenu.file.filename.lastIndexOf("."))
                  : contextMenu.file.filename;
                setRenameNewNameInput(nameWithoutExt);
                setRenameModalShow(true);
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            ✏️ 快捷更名
          </div>
          <div style={{ height: "1px", background: "var(--border-light)", margin: "4px 0" }} />
          <div 
            className="context-menu-item danger"
            onClick={() => {
              if (contextMenu.file) {
                handleDeleteFile(contextMenu.file.filepath.toString());
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            🗑️ 物理删除文件
          </div>
        </div>
      )}

      {/* 🔍 Floating Glassmorphic File Preview Modal */}
      {previewFile && (
        <div 
          style={{ 
            position: "fixed", 
            inset: 0, 
            zIndex: 99999, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            background: "rgba(10, 10, 15, 0.75)", 
            backdropFilter: "blur(12px) saturate(140%)" 
          }}
          onClick={() => setPreviewFile(null)}
        >
          <div 
            className="cyber-card" 
            style={{ 
              width: "80vw", 
              maxWidth: "1000px", 
              height: "80vh", 
              maxHeight: "800px", 
              background: theme === "light" ? "rgba(255,255,255,0.95)" : "rgba(20,20,30,0.85)", 
              border: "1px solid var(--border-light)",
              borderRadius: "20px", 
              padding: "24px", 
              boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <PreviewPanel 
                workspaceDir={workspaceDir}
                filepath={previewFile.filepath.toString()}
                filename={previewFile.filename.toString()}
                theme={theme}
                onClose={() => setPreviewFile(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 👑 Full Screen Drag and Drop Overlay */}
      {isDragging && (
        <div className="drag-drop-overlay">
          <div className="drag-drop-box">
            <div style={{ fontSize: "40px", animation: "bounce 1.5s infinite" }}>📥</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>释放以智能导入外部文档</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>文件将自动搬运至 00收集箱 并执行 AI 智能推荐归档</p>
          </div>
        </div>
      )}
    </div>
  );
}
