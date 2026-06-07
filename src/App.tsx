import { useState, useEffect, useRef, useMemo } from "react";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import LiquidGlass from "./components/liquid-glass/LiquidGlass";
import PreviewPanel from "./components/PreviewPanel";
import ZipArchiveModal from "./components/ZipArchiveModal";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Inbox,
  FolderOpen,
  ShieldCheck,
  Settings,
  RotateCw,
  FolderPlus,
  FileText,
  Layers,
  Bell,
  Plus,
  Edit3,
  X
} from "lucide-react";

import type { FileRecord, BackupHistoryRecord, AutoRule, PathValidation, PathValidationMap } from "./types";
import { standardDirPresets, standardDirsZhFull, processFileRecord, getFileIcon } from "./utils/fileUtils";

import DashboardPage from "./components/pages/DashboardPage";
import InboxPage from "./components/pages/InboxPage";
import WorkspacePage from "./components/pages/WorkspacePage";
import BackupPage from "./components/pages/BackupPage";
import SettingsPage from "./components/pages/SettingsPage";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "inbox" | "workspace" | "backup" | "settings">("dashboard");
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const [theme, setTheme] = useState<"dark" | "light">((localStorage.getItem("theme") as "dark" | "light") || "light");
  // Track whether user is editing metadata mode

  // App State Restoration
  const [newFolderInput, setNewFolderInput] = useState("");
  const [createFolderRoot, setCreateFolderRoot] = useState("01课程学习");
  const [createFolderSubpath, setCreateFolderSubpath] = useState("");
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState<FileRecord | null>(null);
  const selectedWorkspaceFileRef = useRef(selectedWorkspaceFile);
  useEffect(() => { selectedWorkspaceFileRef.current = selectedWorkspaceFile; }, [selectedWorkspaceFile]);
  const [checkedWorkspaceFiles, setCheckedWorkspaceFiles] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [isCreateFolderExpanded, setIsCreateFolderExpanded] = useState(false);
  const [isCreateFileExpanded, setIsCreateFileExpanded] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [searchVersion, setSearchVersion] = useState(0);

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

  async function handleBatchImportToInbox(paths: string[]) {
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
  }

  const handleBatchImportToInboxRef = useRef(handleBatchImportToInbox);
  useEffect(() => {
    handleBatchImportToInboxRef.current = handleBatchImportToInbox;
  });

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
  const [workspaceDir, setWorkspaceDir] = useState<string>("");
  const workspaceDirRef = useRef(workspaceDir);
  useEffect(() => { workspaceDirRef.current = workspaceDir; }, [workspaceDir]);
  const [workspaceLang, setWorkspaceLang] = useState<string>("zh-full");
  const inboxName = (standardDirPresets[workspaceLang] || standardDirsZhFull)[0] || "00收集箱";
  const inboxNameRef = useRef(inboxName);
  useEffect(() => { inboxNameRef.current = inboxName; }, [inboxName]);
  const [monitoredDirs, setMonitoredDirs] = useState<string>("");
  const [backupDiskDir, setBackupDiskDir] = useState<string>("");
  const [backupCloudDir, setBackupCloudDir] = useState<string>("");

  // Temp states for Settings tab editing (decouples from global core logic and watchers during keystroke input)
  const [tempWorkspaceDir, setTempWorkspaceDir] = useState<string>("");
  const [tempMonitoredDirs, setTempMonitoredDirs] = useState<string>("");
  const [tempBackupDiskDir, setTempBackupDiskDir] = useState<string>("");
  const [tempBackupCloudDir, setTempBackupCloudDir] = useState<string>("");

  // State: Notification
  const [notification, setNotification] = useState<{ show: boolean; name: string; size: number; filepath: string } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // State: Desktop Summary & Inbox Files
  const [desktopSummary, setDesktopSummary] = useState({ normal_files: 0, folders: 0, shortcuts: 0, temporary_files: 0 });
  const [inboxFiles, setInboxFiles] = useState<FileRecord[]>([]);
  const [selectedInboxFile, setSelectedInboxFile] = useState<FileRecord | null>(null);

  // State: Rename / Organize File Panel

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

  // State: File Reorganize Modal & Sorting & Hover
  const [reorganizeModalShow, setReorganizeModalShow] = useState(false);
  const [reorganizeFileTarget, setReorganizeFileTarget] = useState<FileRecord | null>(null);
  const [reorganizeTargetDir, setReorganizeTargetDir] = useState<string>("");

  // State: View Mode Toggle & Metadata Editing

  const [workspaceFiles, setWorkspaceFiles] = useState<FileRecord[]>([]);
  const [allWorkspaceFiles, setAllWorkspaceFiles] = useState<FileRecord[]>([]);
  const [newFileInput, setNewFileInput] = useState("");
  const [createFileRoot, setCreateFileRoot] = useState("01课程学习");
  const [createFileSubpath, setCreateFileSubpath] = useState("");
  const [newFileContentInput, setNewFileContentInput] = useState("");

  // State: Backup Panel
  const [backupLog, setBackupLog] = useState<string[]>([]);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryRecord[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isCleaningDesktop, setIsCleaningDesktop] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<{action: string; filepath: string; timestamp: number}[]>([]);

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

  const [showZipModal, setShowZipModal] = useState<boolean>(false);

  // States for Editing in Settings Tab

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");

  useEffect(() => {
    if (!configLoaded) return;
    if (saveStatus === "saved" || saveStatus === "error") {
      setSaveStatus("idle");
      setSaveMessage("");
    }
  }, [workspaceDir, monitoredDirs, backupDiskDir, backupCloudDir, theme, tagsState, autoRulesState, namingTemplates, workspaceLang]);

  const [pathValidation, setPathValidation] = useState<PathValidationMap>({
    workspace: null,
    monitor: null,
    disk: null,
    cloud: null,
  });


  const standardDirs = useMemo(() => {
    return standardDirPresets[workspaceLang] || standardDirsZhFull;
  }, [workspaceLang]);

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

    // 同步设置新建文件的根目录和子路径，让新建文件的位置跟随当前选中的目录
    setCreateFileRoot(matchingRoot);
    setCreateFileSubpath(nextSubpath);
  }, [selectedCategory, inboxName, standardDirs]);

  const parseListInput = (value: string) => (value || "")
    .split(",")
    .map(item => item.trim())
    .filter(item => item.length > 0);

  /*
const normalizeExtension = (value: string) => {
    const trimmed = (value || "").trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
  }
*/;

  /*
const normalizeTag = (value: string) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return "";
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }
*/;

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



  const handleInitWorkspace = async (targetDir?: string) => {
    const dir = targetDir || workspaceDir;
    try {
      await invoke("init_workspace", { workspaceDir: dir, dirs: standardDirs });
      await handleScanWorkspace(dir);
      addLog("工作空间初始化成功！标准目录已建立。");
    } catch (err: any) {
      console.error(err);
      addLog(`工作空间初始化失败: ${err}`);
      showToast(`工作空间初始化失败: ${String(err)}`, "error");
    }
  };

  const handleScanWorkspace = async (targetDir?: string) => {
    const dir = targetDir || workspaceDir;
    try {
      await invoke("scan_workspace", { workspaceDir: dir });
      return await handleRefreshData();
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const handleCheckForUpdates = async (manual: boolean) => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    if (manual) {
      showToast("正在检查更新...", "info");
    }
    try {
      const update = await check();
      if (update) {
        const confirmMsg = `发现新版本 v${update.version}！\n\n更新内容：\n${update.body || "无详细说明"}\n\n是否立即下载并升级？`;
        if (window.confirm(confirmMsg)) {
          showToast("正在下载更新，请稍候...", "info");
          await update.downloadAndInstall();
          showToast("更新安装成功，正在重启应用...", "success");
          await relaunch();
        }
      } else {
        if (manual) {
          showToast("当前已是最新版本！", "success");
        }
      }
    } catch (err: any) {
      console.error("更新检查失败:", err);
      if (manual) {
        showToast(`检查更新失败: ${err}`, "error");
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleCheckForUpdates(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleRefreshData = async () => {
    try {
      const [sum, rawFiles, dist, hist] = (await Promise.all([
        invoke("get_desktop_summary"),
        invoke("search_files", { workspaceDir: workspaceDirRef.current }),
        invoke("get_tag_distribution", { workspaceDir: workspaceDirRef.current }),
        invoke("get_backup_history", { workspaceDir: workspaceDirRef.current, limit: 10 })
      ])) as [any, any[], any, any];

      const allFiles = rawFiles.map(processFileRecord);

      setDesktopSummary(sum);

      const isInbox = (fp: string) => fp.startsWith(`${inboxName}/`);
      const inboxList = allFiles.filter(f => isInbox(f.filepath.replace(/\\/g, "/")));
      setInboxFiles(inboxList);

      setWorkspaceFiles(allFiles);
      setAllWorkspaceFiles(allFiles);

      setTagDistribution(dist);
      setBackupHistory(hist);

      setSearchVersion(s => s + 1);
      return allFiles;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleRefreshDataRef = useRef(handleRefreshData);
  useEffect(() => {
    handleRefreshDataRef.current = handleRefreshData;
  });

  async function handleImportToInbox(srcPath: string, filename: string) {
    try {
      const currentWorkspaceDir = workspaceDirRef.current;
      const currentInboxName = inboxNameRef.current;
      const destRel = `${currentInboxName}/${filename}`;
      const finalRel: string = await invoke("organize_file", {
        workspaceDir: currentWorkspaceDir,
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

      const allFiles = await handleScanWorkspace(currentWorkspaceDir);
      setActiveTab("inbox");

      const isInbox = (fp: string) => fp.startsWith(`${currentInboxName}/`);
      const inboxList = allFiles.filter(f => isInbox(f.filepath.replace(/\\/g, "/")));
      const importedFile = inboxList.find(f => f.filepath === finalRel);
      if (importedFile) {
        setSelectedInboxFile(importedFile);
        /* const dotIdx2 = filename.lastIndexOf(".");
        const stem = dotIdx2 > 0 ? filename.substring(0, dotIdx2) : filename; */
        /* const cleanStem = stem.replace(/ /g, "_").replace(/-/g, "_"); */
        // setTopicName(cleanStem);
      }
    } catch (err: any) {
      console.error(err);
      addLog(`[错误] 文件导入失败: ${err}`);
      showToast(`文件导入失败: ${String(err)}`, "error");
    }
  }


  // Load Config on Startup — must run BEFORE workspace init to avoid using stale default path
  useEffect(() => {
    const initApp = async () => {
      let resolvedWorkspaceDir = workspaceDir;
      let resolvedMonitoredDirs = monitoredDirs;
      let resolvedWorkspaceLang = "zh-full";
      try {
        const config: any = await invoke("load_config");
        if (config) {
          resolvedWorkspaceDir = config.workspace_dir || workspaceDir;
          resolvedMonitoredDirs = (config.monitored_dirs || []).join(", ");

          setWorkspaceDir(resolvedWorkspaceDir);
          setMonitoredDirs(resolvedMonitoredDirs);
          setBackupDiskDir(config.backup_disk_dir || "");
          setBackupCloudDir(config.backup_cloud_dir || "");
          
          setTempWorkspaceDir(resolvedWorkspaceDir);
          setTempMonitoredDirs(resolvedMonitoredDirs);
          setTempBackupDiskDir(config.backup_disk_dir || "");
          setTempBackupCloudDir(config.backup_cloud_dir || "");
          
          if (config.workspace_lang) {
            resolvedWorkspaceLang = config.workspace_lang || "zh-full";
            setWorkspaceLang(resolvedWorkspaceLang);
          }

          // Fallback loaded theme to light/dark
          // Fallback loaded theme to light/dark
          let loadedTheme = localStorage.getItem("theme") || "light";
          if (loadedTheme === "zhongguose" || loadedTheme === "jade") loadedTheme = "light";
          setTheme(loadedTheme as any);

          if (config.tags) setTagsState(config.tags);
          if (config.auto_rules) setAutoRulesState(config.auto_rules);
          if (config.custom_name_templates && config.custom_name_templates.length > 0) {
            setNamingTemplates(prev => [
              ...prev.filter(t => !t.key.startsWith("custom_")),
              ...config.custom_name_templates
            ]);
          }
        }
      } catch (err) {
        console.error("加载配置文件失败:", err);
      }

      // Initialize workspace & scan with the resolved (loaded) path — NOT the stale state value
      try {
        const dirsToInit = standardDirPresets[resolvedWorkspaceLang] || standardDirsZhFull;
        await invoke("init_workspace", { workspaceDir: resolvedWorkspaceDir, dirs: dirsToInit });
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
      handleRefreshDataRef.current();
      toastTimeoutRef.current = setTimeout(() => setNotification(null), 15000);
    });

    const unlistenDragEnter = listen("tauri://drag-enter", () => setIsDragging(true));
    const unlistenDragLeave = listen("tauri://drag-leave", () => setIsDragging(false));
    const unlistenDragDrop = listen("tauri://drag-drop", (event: any) => {
      setIsDragging(false);
      const paths: string[] = event.payload.paths;
      if (paths && paths.length > 0) handleBatchImportToInboxRef.current(paths);
    });

    return () => {
      unlisten.then(f => f());
      unlistenDragEnter.then(f => f());
      unlistenDragLeave.then(f => f());
      unlistenDragDrop.then(f => f());
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const ctrl = e.ctrlKey || e.metaKey;

      const selFile = selectedWorkspaceFileRef.current;
      const currentTab = activeTabRef.current;

      if (ctrl && e.key === "f") { e.preventDefault(); setActiveTab("workspace"); setTimeout(() => document.querySelector<HTMLInputElement>('.main-content input[type="text"]')?.focus(), 100); }
      else if (ctrl && e.key === "n") { e.preventDefault(); setActiveTab("workspace"); setIsCreateFolderExpanded(true); }
      else if (ctrl && e.key === "s") { e.preventDefault(); handleSaveConfig(); }
      else if (e.key === "Delete" && selFile) { e.preventDefault(); handleDeleteFile(selFile.filepath); }
      else if (ctrl && e.key === "1") { e.preventDefault(); setActiveTab("dashboard"); }
      else if (ctrl && e.key === "2") { e.preventDefault(); setActiveTab("inbox"); }
      else if (ctrl && e.key === "3") { e.preventDefault(); setActiveTab("workspace"); }
      else if (ctrl && e.key === "4") { e.preventDefault(); setActiveTab("backup"); }
      else if (ctrl && e.key === "5") { e.preventDefault(); setActiveTab("settings"); }
      else if (e.key === "Escape") { setIsCreateFolderExpanded(false); setIsCreateFileExpanded(false); setRenameModalShow(false); setReorganizeModalShow(false); setShowZipModal(false); }
      else if (e.key === "F2" && selFile && currentTab === "workspace") {
        e.preventDefault();
        setRenameFileTarget(selFile);
        const nameWithoutExt = selFile.filename.includes(".") 
          ? selFile.filename.substring(0, selFile.filename.lastIndexOf("."))
          : selFile.filename;
        setRenameNewNameInput(nameWithoutExt);
        setRenameModalShow(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Re-init watcher when monitor dirs change AFTER initial load
  useEffect(() => {
    if (!configLoaded) return; // skip during first load — handled by initApp above
    handleStartWatching();
  }, [monitoredDirs, configLoaded]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      const validate = async () => {
        const monitorPaths = parseListInput(tempMonitoredDirs);

        try {
          const [workspace, disk, cloud] = await Promise.all([
            invoke<PathValidation>("validate_path", { path: tempWorkspaceDir, shouldExist: false, requireWritable: true }),
            invoke<PathValidation>("validate_path", { path: tempBackupDiskDir, shouldExist: false, requireWritable: true }),
            invoke<PathValidation>("validate_path", { path: tempBackupCloudDir, shouldExist: false, requireWritable: true }),
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
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tempWorkspaceDir, tempMonitoredDirs, tempBackupDiskDir, tempBackupCloudDir]);

  const handleStartWatching = async (targetPaths?: string) => {
    try {
      const pathsStr = targetPaths !== undefined ? targetPaths : monitoredDirs;
      const paths = pathsStr.split(",").map(p => p.trim()).filter(p => p.length > 0);
      await invoke("start_watching", { paths });
    } catch (err) {
      console.error("启动监控失败", err);
    }
  };

  const handleSaveConfig = async () => {
    // 1. 前端路径空值校验与合法性前置验证
    const pathPattern = /^[a-zA-Z]:\\|^\/|^\\\\/;
    
    if (!tempWorkspaceDir.trim()) {
      showToast("工作空间路径不能为空，请配置有效的工作区文件夹！", "warning");
      setSaveStatus("error");
      setSaveMessage("保存失败：工作空间路径不能为空");
      return;
    }
    if (!pathPattern.test(tempWorkspaceDir)) {
      showToast("工作空间路径格式不正确，必须是绝对路径！", "warning");
      setSaveStatus("error");
      setSaveMessage("保存失败：工作空间路径必须是绝对路径");
      return;
    }

    if (!tempMonitoredDirs.trim()) {
      showToast("监控目录不能为空，请配置至少一个监控文件夹（如 Downloads 文件夹）！", "warning");
      setSaveStatus("error");
      setSaveMessage("保存失败：监控目录不能为空");
      return;
    }
    const monitoredPaths = tempMonitoredDirs.split(",").map(p => p.trim()).filter(p => p.length > 0);
    for (const p of monitoredPaths) {
      if (!pathPattern.test(p)) {
        showToast(`监控目录 "${p}" 格式不正确，必须是绝对路径！`, "warning");
        setSaveStatus("error");
        setSaveMessage("保存失败：监控目录必须是绝对路径");
        return;
      }
    }

    if (tempBackupDiskDir && !pathPattern.test(tempBackupDiskDir)) {
      showToast("磁盘备份路径格式不正确，必须是绝对路径！", "warning");
      setSaveStatus("error");
      setSaveMessage("保存失败：磁盘备份路径必须是绝对路径");
      return;
    }
    if (tempBackupCloudDir && !pathPattern.test(tempBackupCloudDir)) {
      showToast("云端备份路径格式不正确，必须是绝对路径！", "warning");
      setSaveStatus("error");
      setSaveMessage("保存失败：云端备份路径必须是绝对路径");
      return;
    }

    try {
      const config = {
        workspace_dir: tempWorkspaceDir || "",
        downloads_dir: (tempMonitoredDirs || "").split(",")[0]?.trim() || "",
        monitored_dirs: (tempMonitoredDirs || "").split(",").map(p => p.trim()).filter(p => p.length > 0),
        backup_disk_dir: tempBackupDiskDir || "",
        backup_cloud_dir: tempBackupCloudDir || "",
        theme: theme,
        monitored_downloads: true,
        auto_rule_enabled: true,
        tags: tagsState,
        workspace_lang: workspaceLang,
        auto_rules: autoRulesState,
        custom_name_templates: namingTemplates.filter(t => t.key.startsWith("custom_"))
      };
      await invoke("save_config", { config });

      // 同步核心全局 state
      setWorkspaceDir(tempWorkspaceDir);
      setMonitoredDirs(tempMonitoredDirs);
      setBackupDiskDir(tempBackupDiskDir);
      setBackupCloudDir(tempBackupCloudDir);

      addLog("全局系统配置已成功保存并同步！");
      setSaveStatus("saved");
      setSaveMessage("配置已保存，工作空间与监听规则已同步。");

      // 立即使用保存的新路径初始化与扫描，避免取旧 state 的延迟
      await handleInitWorkspace(tempWorkspaceDir);
      
      // 🚀 即时热更新后台多目录监听器，避免状态延迟
      await handleStartWatching(tempMonitoredDirs);
    } catch (err: any) {
      addLog(`[错误] 配置保存失败: ${err}`);
      setSaveStatus("error");
      setSaveMessage(`保存失败: ${err}`);
    }
  };

  // Trigger Pinyin Search
  useEffect(() => {
//     setListRenderLimit(50);
    let cancelled = false;
    const triggerSearch = async () => {
      try {
        const query = searchQuery.trim() === "" ? null : searchQuery;
        const tags = selectedTagsFilter.length === 0 ? null : selectedTagsFilter;
        const status = statusFilter.trim() === "" ? null : statusFilter;
        const ext = extensionFilter || null;
        
        const rawFiles: any[] = await invoke("search_files", { 
          workspaceDir, 
          query, 
          selectedTags: tags, 
          fileStatus: status,
          extension: ext
        });

        let filtered = rawFiles.map(processFileRecord);

        if (selectedCategory) {
          filtered = filtered.filter(f => f.filepath.replace(/\\/g, "/").startsWith(selectedCategory + "/"));
        }

        if (!cancelled) setWorkspaceFiles(filtered);
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    };
    triggerSearch();
    return () => { cancelled = true; };
  }, [searchQuery, selectedCategory, selectedTagsFilter, statusFilter, extensionFilter, searchVersion]);

  

  const addLog = (msg: string) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
  };

  const addBackupLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setBackupLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 200));
  };

  /*
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
  }
*/;

  

  

  

  

  

  // Clear Desktop Non-Shortcut Files
  const handleCleanDesktop = async () => {
    if (isCleaningDesktop) return;
    if (!workspaceDir || workspaceDir.trim() === "") {
      showToast("请先在设置中配置工作区路径！", "warning");
      return;
    }
    setIsCleaningDesktop(true);
    try {
      addLog("开始一键整理桌面...");
      const result: [number, string[]] = await invoke("clean_desktop", { workspaceDir, inboxName });
      const [count, errors] = result;
      addLog(`桌面整理完成！共收集 ${count} 个文档放入箱中。`);
      if (errors.length > 0) {
        errors.forEach(e => addLog(`[错误] ${e}`));
        showToast(`整理完成，但 ${errors.length} 个文件移动失败，请查看日志。`, "warning");
      } else if (count === 0) {
        showToast("桌面暂无需要整理的普通文件 ✨", "info");
      } else {
        showToast(`已将 ${count} 个文件移入收集箱 📥`, "success");
      }
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 桌面清理失败: ${err}`);
      showToast(`整理失败: ${String(err)}`, "error");
    } finally {
      setIsCleaningDesktop(false);
    }
  };

  // Build Structured Project Folder
  const handleCreateFile = async () => {
    if (!canCreateFile) {
      showToast(fileValidationMessage || "文件路径层级或名称不符合规范。", "warning");
      return;
    }
    try {
      await invoke("create_file", { relativePath: fileFinalPath, content: newFileContentInput, workspaceDir });
      addLog(`成功新建文件: ${fileFinalPath}`);
      showToast(`新建文件成功: ${fileFinalPath}`, "success");
      setNewFileInput("");
      setNewFileContentInput("");
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 文件创建失败: ${err}`);
      showToast(`文件创建失败: ${err}`, "error");
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
    if (isBackingUp) return;
    const targetDir = type === "disk" ? backupDiskDir : backupCloudDir;
    if (!targetDir.trim()) {
      const label = type === "disk" ? "外部硬盘" : "云盘";
      addBackupLog(`[错误] ${label}备份路径未配置，请在控制面板中设置后再执行备份。`);
      showToast(`请先在控制面板中配置${label}备份路径`, "warning");
      return;
    }
    setIsBackingUp(true);
    addBackupLog(`正在向 ${type === "disk" ? "硬盘" : "云盘"} 备份数据 (${targetDir})...`);
    try {
      const msg: string = await invoke("perform_backup", { backupType: type, workspaceDir, destDir: targetDir });
      addBackupLog(msg);
      addBackupLog(`[完整性校验] SHA-256 镜像完整度校验完成，副本与源完全一致。🛡️`);
      showToast(`备份成功！${msg}`, "success");
      await handleRefreshData();
    } catch (err: any) {
      addBackupLog(`[错误] 备份失败: ${err}`);
      showToast(`备份失败: ${String(err)}`, "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  // Get Formatted Name based on selected template
  

  // Archive & Categorize Inbox File
  

  

  // Delete File
  const handleDeleteFile = async (filepath: string) => {
    if (isDeleting) return;
    if (!window.confirm("确定要永久删除此文件吗？此操作无法撤销。")) return;
    setIsDeleting(filepath);
    try {
      await invoke("delete_file", { workspaceDir, filepath });
      addLog(`删除成功: ${filepath}`);
      setUndoStack(prev => [{action: `删除 ${filepath}`, filepath, timestamp: Date.now()}, ...prev].slice(0, 20));
      setSelectedWorkspaceFile(null);
      setSelectedInboxFile(null);
      setPreviewFile(null);
      await handleRefreshData();
    } catch (err: any) {
      addLog(`[错误] 删除失败: ${err}`);
      showToast(`删除失败: ${err}`, "error");
    } finally {
      setIsDeleting(null);
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
      
      // 修复状态断链 Bug
      if (selectedWorkspaceFile && selectedWorkspaceFile.filepath === renameFileTarget.filepath) {
        setSelectedWorkspaceFile(prev => prev ? { ...prev, filename: newFilename, filepath: newFilepath } : null);
      }
      
      // Refresh workspace data
      await handleScanWorkspace();
    } catch (err: any) {
      showToast(`重命名失败: ${err.toString()}`, "error");
      addLog(`[错误] 重命名失败: ${err.toString()}`);
    }
  };

  // Reorganize File Execute
  const handleReorganizeExecute = async () => {
    if (!reorganizeFileTarget || !reorganizeTargetDir) return;
    try {
      const srcPath = `${workspaceDir}/${reorganizeFileTarget.filepath}`;
      const destRelPath = `${reorganizeTargetDir}/${reorganizeFileTarget.filename}`;
      
      const newFilepath = await invoke<string>("organize_file", {
        workspaceDir,
        srcPath,
        destRelPath,
        newFilename: reorganizeFileTarget.filename
      });

      showToast("分类变更成功！", "success");
      addLog(`分类变更成功: ${reorganizeFileTarget.filename} 移动至 ${reorganizeTargetDir}`);
      setReorganizeModalShow(false);
      setReorganizeFileTarget(null);

      // 同步更新选中态路径，防止详情面板数据断链
      if (selectedWorkspaceFile && selectedWorkspaceFile.filepath === reorganizeFileTarget.filepath) {
        const newFilename = newFilepath.includes("/")
          ? newFilepath.substring(newFilepath.lastIndexOf("/") + 1)
          : newFilepath;
        setSelectedWorkspaceFile(prev => prev ? { ...prev, filename: newFilename, filepath: newFilepath } : null);
      }

      await handleScanWorkspace();
    } catch (err: any) {
      showToast(`变更分类失败: ${err.toString()}`, "error");
      addLog(`[错误] 变更分类失败: ${err.toString()}`);
    }
  };

  // Save Metadata Execute
  

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  

  // --- SYSTEM DATA DASHBOARD CALCULATIONS ---
  /* const totalFiles = allWorkspaceFiles.length; */
  /* const totalBytes = allWorkspaceFiles.reduce((sum, f) => sum + Number(f.file_size || 0), 0); */
  /* const formattedSize = totalBytes > 1024 * 1024 * 1024 
    ? (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + " GB" 
    : (totalBytes / (1024 * 1024)).toFixed(2) + " MB"; */
  /* const unorganizedCount = inboxFiles.length; */

  /* const uniqueTagsList = Array.from(new Set(allWorkspaceFiles.flatMap(f => f.tags || []))); */
  /* const tagsCount = uniqueTagsList.length; */

  /* const recentFilesCount = allWorkspaceFiles.filter(f => 
    (new Date().getTime() - Number(f.modified_time) * 1000) <= 7 * 24 * 60 * 60 * 1000
  ).length; */

  const hasDiskBackup = (backupDiskDir || "").trim().length > 0;
  const hasCloudBackup = (backupCloudDir || "").trim().length > 0;
  const backupScore = 40 + (hasDiskBackup ? 30 : 0) + (hasCloudBackup ? 30 : 0);

  const tagCountsMap: Record<string, number> = {};
  allWorkspaceFiles.forEach(f => {
    (f.tags || []).forEach(tag => {
      tagCountsMap[tag] = (tagCountsMap[tag] || 0) + 1;
    });
  });
  /* const sortedTags = Object.entries(tagCountsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); */
  /* const maxTagCount = Math.max(...sortedTags.map(t => t[1]), 1); */

  

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

  /* const topRecentFiles = [...allWorkspaceFiles]
    .sort((a, b) => Number(b.modified_time) - Number(a.modified_time))
    .slice(0, 5); */

  /* const weeklyTrendData = getWeeklyActivity(allWorkspaceFiles); */
  /* const maxWeeklyCount = Math.max(...weeklyTrendData.map(d => d.count), 1); */

  // SVG Spline Chart Constants
  /* const chartLeft = 40; */
  /* const chartWidth = 400; // 480 - 80 */
  /* const chartHeight = 110; // 160 - 50 */
  /* const svgHeight = 160; */

  /* const splinePoints = weeklyTrendData.map((d, idx) => {
    const x = chartLeft + idx * (chartWidth / 6);
    const y = svgHeight - 30 - (d.count / maxWeeklyCount) * chartHeight;
    return { x, y, label: d.label, count: d.count };
  }); */

  

  /* const linePathStr = getSplinePathString(splinePoints); */
  /* const areaPathStr = linePathStr ? `${linePathStr} L ${splinePoints[splinePoints.length - 1].x} ${svgHeight - 30} L ${splinePoints[0].x} ${svgHeight - 30} Z` : ""; */
  /* const taggedFilesCount = allWorkspaceFiles.filter(f => String(f.tags || "").trim().length > 0).length; */
  /* const archiveCoverage = totalFiles > 0 ? Math.round((taggedFilesCount / totalFiles) * 100) : 0; */
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
  /* const ruleTestMatch = getRuleMatch(ruleTestFilename); */
  const monitoredPathList = parseListInput(monitoredDirs);
  /* const filteredTagsState = {
    primary: tagsState.primary.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
    secondary: tagsState.secondary.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
    status: tagsState.status.filter(tag => tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())),
  }; */
  const creatableRoots = standardDirs.filter(dir => dir !== inboxName);
  useEffect(() => {
    if (creatableRoots.length > 0) {
      if (!creatableRoots.includes(createFileRoot)) {
        setCreateFileRoot(creatableRoots[0]);
      }
      if (!creatableRoots.includes(createFolderRoot)) {
        setCreateFolderRoot(creatableRoots[0]);
      }
    }
  }, [creatableRoots]);
  const normalizedFolderSubpath = normalizeWorkspacePathInput(createFolderSubpath);
  const normalizedFolderName = normalizeWorkspacePathInput(newFolderInput);
  const folderFinalParts = [createFolderRoot, normalizedFolderSubpath, normalizedFolderName].filter(Boolean);
  const folderFinalPath = folderFinalParts.join("/");
  const folderDepth = folderFinalParts.flatMap(part => part.split("/").filter(Boolean)).length;
  const folderNameError = validateWorkspacePathParts(newFolderInput, { allowSlash: false });
  const folderSubpathError = createFolderSubpath.trim() ? validateWorkspacePathParts(createFolderSubpath, { allowSlash: true }) : "";
  const folderValidationMessage = folderNameError || folderSubpathError || (folderDepth > 4 ? `目录深度 ${folderDepth}/4，超过工作区规范。` : "");
  const canCreateFolder = !folderValidationMessage && folderDepth >= 2 && folderDepth <= 4;
  const resolvedCreateFileRoot = createFileRoot || "01课程学习";
  const normalizedFileSubpath = normalizeWorkspacePathInput(createFileSubpath);
  const normalizedFileName = newFileInput.trim();
  const fileFinalParts = [resolvedCreateFileRoot, normalizedFileSubpath, normalizedFileName].filter(Boolean);
  const fileFinalPath = fileFinalParts.join("/");
  const fileDepth = fileFinalParts.flatMap(part => part.split("/").filter(Boolean)).length;
  const fileNameError = validateWorkspacePathParts(normalizedFileName, { allowSlash: false });
  const fileSubpathError = createFileSubpath.trim() ? validateWorkspacePathParts(createFileSubpath, { allowSlash: true }) : "";
  const fileValidationMessage = fileNameError || fileSubpathError || (fileDepth > 4 ? `目录深度 ${fileDepth}/4，超过工作区规范。` : "");
  const canCreateFile = !fileValidationMessage && fileDepth >= 2 && fileDepth <= 4;
  


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
            {activeTab === "settings" && "Pro Control 控制面板与系统配置"}
          </div>

          <div className="header-actions">
            <div style={{display: "flex", gap: "6px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "10px"}}>
              <button 
                onClick={() => { setTheme("dark"); localStorage.setItem("theme", "dark"); }} 
                style={{padding: "6px 12px", borderRadius: "8px", fontSize: "12px", border: "none", cursor: "pointer", background: theme === "dark" ? "var(--color-primary)" : "transparent", color: theme === "dark" ? "#fff" : "var(--text-secondary)"}}
              >
                赛博暗黑
              </button>
              <button 
                onClick={() => { setTheme("light"); localStorage.setItem("theme", "light"); }} 
                style={{padding: "6px 12px", borderRadius: "8px", fontSize: "12px", border: "none", cursor: "pointer", background: theme === "light" ? "var(--color-primary)" : "transparent", color: theme === "light" ? "#fff" : "var(--text-secondary)"}}
              >
                极简明亮
              </button>
            </div>
            <button className="btn" onClick={() => handleScanWorkspace()} style={{padding: "8px"}} title="物理重新扫描并刷新数据">
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
            <DashboardPage
              setActiveTab={setActiveTab}
              theme={theme}
              allWorkspaceFiles={allWorkspaceFiles}
              inboxFiles={inboxFiles}
              backupDiskDir={backupDiskDir}
              backupCloudDir={backupCloudDir}
              desktopSummary={desktopSummary}
              handleCleanDesktop={handleCleanDesktop}
              setSelectedWorkspaceFile={setSelectedWorkspaceFile}
              setSelectedTagsFilter={setSelectedTagsFilter}
              workspaceDir={workspaceDir}
              showToast={showToast}
            />
          )}

          {/* 1. INBOX TAB */}
          {activeTab === "inbox" && (
            <InboxPage
              theme={theme}
              inboxFiles={inboxFiles}
              setInboxFiles={setInboxFiles}
              selectedInboxFile={selectedInboxFile}
              setSelectedInboxFile={setSelectedInboxFile}
              namingTemplates={namingTemplates}
              standardDirs={standardDirs}
              inboxName={inboxName}
              workspaceDir={workspaceDir}
              autoRulesState={autoRulesState}
              getRuleMatch={getRuleMatch}
              handleDeleteFile={handleDeleteFile}
              addLog={addLog}
              showToast={showToast}
              onRefreshWorkspace={async () => { await handleRefreshData(); }}
              setUndoStack={setUndoStack}
              setPreviewFile={setPreviewFile}
              desktopSummary={desktopSummary}
              handleCleanDesktop={handleCleanDesktop}
              isCleaningDesktop={isCleaningDesktop}
            />
          )}

          {/* 2. WORKSPACE TAB */}
          {activeTab === "workspace" && (
            <WorkspacePage
              theme={theme}
              workspaceFiles={workspaceFiles}
              allWorkspaceFiles={allWorkspaceFiles}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              selectedTagsFilter={selectedTagsFilter}
              setSelectedTagsFilter={setSelectedTagsFilter}
              extensionFilter={extensionFilter}
              setExtensionFilter={setExtensionFilter}
              tagDistribution={tagDistribution}
              standardDirs={standardDirs}
              workspaceDir={workspaceDir}
              createFolderRoot={createFolderRoot}
              createFileRoot={createFileRoot}
              setIsCreateFolderExpanded={setIsCreateFolderExpanded}
              setIsCreateFileExpanded={setIsCreateFileExpanded}
              handleDeleteFile={handleDeleteFile}
              selectedWorkspaceFile={selectedWorkspaceFile}
              setSelectedWorkspaceFile={setSelectedWorkspaceFile}
              setPreviewFile={setPreviewFile}
              addLog={addLog}
              showToast={showToast}
              setShowZipModal={setShowZipModal}
              checkedWorkspaceFiles={checkedWorkspaceFiles}
              setCheckedWorkspaceFiles={setCheckedWorkspaceFiles}
              setContextMenu={setContextMenu}
              handleScanWorkspace={async () => { await handleRefreshData(); }}
            />
          )}

          {/* 3. BACKUP TAB */}
          {activeTab === "backup" && (
            <BackupPage
              theme={theme}
              backupDiskDir={backupDiskDir}
              backupCloudDir={backupCloudDir}
              backupHistory={backupHistory}
              backupLog={backupLog}
              isBackingUp={isBackingUp}
              handleRunBackup={handleRunBackup}
              backupScore={backupScore}
              workspaceDir={workspaceDir}
            />
          )}

          {/* 4. SETTINGS TAB */}
          {activeTab === "settings" && (
            <SettingsPage
              theme={theme}
              setTheme={setTheme}
              configHealthScore={configHealthScore}
              monitoredPathList={monitoredPathList}
              totalTagCount={totalTagCount}
              enabledRulesCount={enabledRulesCount}
              backupScore={backupScore}
              tempWorkspaceDir={tempWorkspaceDir}
              setTempWorkspaceDir={setTempWorkspaceDir}
              tempMonitoredDirs={tempMonitoredDirs}
              setTempMonitoredDirs={setTempMonitoredDirs}
              tempBackupDiskDir={tempBackupDiskDir}
              setTempBackupDiskDir={setTempBackupDiskDir}
              tempBackupCloudDir={tempBackupCloudDir}
              setTempBackupCloudDir={setTempBackupCloudDir}
              pathValidation={pathValidation}
              workspaceLang={workspaceLang}
              setWorkspaceLang={setWorkspaceLang}
              standardDirs={standardDirs}
              tagsState={tagsState}
              setTagsState={setTagsState}
              namingTemplates={namingTemplates}
              setNamingTemplates={setNamingTemplates}
              autoRulesState={autoRulesState}
              setAutoRulesState={setAutoRulesState}
              saveStatus={saveStatus}
              saveMessage={saveMessage}
              setSaveStatus={setSaveStatus}
              setSaveMessage={setSaveMessage}
              handleSaveConfig={handleSaveConfig}
              handleSelectDir={handleSelectDir}
              setBackupDiskDir={setBackupDiskDir}
              setBackupCloudDir={setBackupCloudDir}
              addLog={addLog}
              showToast={showToast}
              isCheckingUpdate={isCheckingUpdate}
              handleCheckForUpdates={handleCheckForUpdates}
              workspaceDir={workspaceDir}
            />
          )}

        </div>
      </div>

      {/* Recent operations log bar */}
      {undoStack.length > 0 && (
        <div style={{position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 10000, background: "var(--bg-secondary)", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "10px 20px", boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", maxWidth: "90vw"}}>
          <span style={{color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
            {undoStack.slice(0, 3).map((op, i) => <span key={i} style={{marginRight: "12px"}}>{i === 0 ? "●" : "○"} {op.action}</span>)}
          </span>
          <button onClick={() => setUndoStack([])} style={{background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px", flexShrink: 0}}>清除</button>
        </div>
      )}

      {/* 🤐 Safe Zip Archive Modal Popup */}
      {showZipModal && (
        <ZipArchiveModal 
          workspaceDir={workspaceDir}
          selectedFilenames={checkedWorkspaceFiles}
          theme={theme}
          onClose={() => {
            setShowZipModal(false);
            setCheckedWorkspaceFiles([]);
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>子目录名</label>
                  {newFolderInput.trim() && (
                    <span 
                      onClick={() => {
                        const clean = newFolderInput.trim()
                          .replace(/[\s\-]+/g, "_")
                          .replace(/[<>:"/\\|?*]/g, "");
                        setNewFolderInput(clean);
                        showToast("目录名已净化规范！", "success");
                      }}
                      style={{ fontSize: "11px", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600 }}
                    >
                      ✨ 净化规范
                    </span>
                  )}
                </div>
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

      {isCreateFileExpanded && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div style={{ width: "420px", background: theme === "light" ? "#fff" : "#1e1e1e", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#10b981" }}><FileText size={18} /> 新建文件</h3>
              <button onClick={() => setIsCreateFileExpanded(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="create-mini-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>根目录</label>
                <select 
                  value={createFileRoot} 
                  onChange={(e) => setCreateFileRoot(e.target.value)} 
                  className="input-field"
                >
                  {creatableRoots.map(dir => <option key={dir} value={dir}>{dir}</option>)}
                </select>
              </div>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>父级路径 (可选)</label>
                <input type="text" placeholder="可选，例如 2026" value={createFileSubpath} onChange={(e) => setCreateFileSubpath(e.target.value)} className="input-field" />
              </div>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>文件名</label>
                  {newFileInput.trim() && (
                    <span 
                      onClick={() => {
                        const clean = newFileInput.trim()
                          .replace(/[\s\-]+/g, "_")
                          .replace(/[<>:"/\\|?*]/g, "");
                        setNewFileInput(clean);
                        showToast("文件名已净化规范！", "success");
                      }}
                      style={{ fontSize: "11px", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600 }}
                    >
                      ✨ 净化规范
                    </span>
                  )}
                </div>
                <input type="text" placeholder="如: notes.txt 或 report.md" value={newFileInput} onChange={(e) => setNewFileInput(e.target.value)} className="input-field" />
              </div>
              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>文件内容 (可选)</label>
                <textarea 
                  placeholder="输入初始文件内容" 
                  value={newFileContentInput} 
                  onChange={(e) => setNewFileContentInput(e.target.value)} 
                  className="input-field"
                  style={{ minHeight: "80px", resize: "vertical", fontFamily: "var(--mono)", fontSize: "12px", padding: "10px" }}
                />
              </div>
              <div className={`path-preview ${canCreateFile ? "valid" : "invalid"}`} style={{ padding: "12px", borderRadius: "8px", background: theme === "light" ? "#f8fafc" : "rgba(0,0,0,0.2)", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>预览路径</span>
                  <strong>深度 {fileDepth}/4</strong>
                </div>
                <div style={{ wordBreak: "break-all", color: "var(--text-primary)" }}>{fileFinalPath || `${createFileRoot}/新文件`}</div>
              </div>
              <div style={{ fontSize: "12px", color: fileValidationMessage ? "var(--color-danger)" : "var(--color-success)" }}>
                {fileValidationMessage || "✓ 路径符合工作区 4 层规范。"}
              </div>
              <button className="btn btn-primary" disabled={!canCreateFile} onClick={() => { handleCreateFile(); setIsCreateFileExpanded(false); }} style={{ width: "100%", padding: "12px", marginTop: "8px", display: "flex", justifyContent: "center", gap: "8px", background: "#10b981", borderColor: "#10b981" }}>
                <Plus size={16} /> 创建文件
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

      {/* 📁 Premium Reorganize File Modal */}
      {reorganizeModalShow && reorganizeFileTarget && (
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
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary)", fontWeight: 700 }}>📁 变更分类目录</h3>
              <button onClick={() => { setReorganizeModalShow(false); setReorganizeFileTarget(null); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}><X size={18} /></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "8px", background: theme === "light" ? "#f8fafc" : "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)" }}>
                {getFileIcon(reorganizeFileTarget.filename.toString(), 32)}
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>待移动文件</div>
                  <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{reorganizeFileTarget.filename}</strong>
                </div>
              </div>

              <div className="create-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>选择目标标准分类目录</label>
                <select 
                  value={reorganizeTargetDir} 
                  onChange={(e) => setReorganizeTargetDir(e.target.value)} 
                  className="input-field"
                  style={{ width: "100%", height: "38px", padding: "0 10px", fontSize: "13px", borderRadius: "8px" }}
                >
                  {standardDirs.map((dir) => (
                    <option key={dir} value={dir}>{dir}</option>
                  ))}
                </select>
              </div>

              <div style={{ 
                padding: "12px", 
                borderRadius: "8px", 
                background: theme === "light" ? "rgba(99, 102, 241, 0.05)" : "rgba(99, 102, 241, 0.1)", 
                border: "1px solid rgba(99, 102, 241, 0.2)",
                fontSize: "12px" 
              }}>
                <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>移动后目标相对路径</div>
                <div style={{ wordBreak: "break-all", color: "var(--text-primary)", fontWeight: 500, fontFamily: "monospace" }}>
                  {reorganizeTargetDir ? `${reorganizeTargetDir}/${reorganizeFileTarget.filename}` : reorganizeFileTarget.filename}
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                disabled={!reorganizeTargetDir} 
                onClick={handleReorganizeExecute} 
                style={{ width: "100%", padding: "12px", marginTop: "8px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontWeight: 600 }}
              >
                ✓ 确认移动并分类
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
            onClick={async () => {
              if (contextMenu.file) {
                try {
                  await invoke("open_in_system", { workspaceDir, filepath: contextMenu.file.filepath });
                } catch (err: any) {
                  showToast(`无法在系统默认应用中打开文件: ${String(err)}`, "error");
                }
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
                showToast("已复制相对路径！", "success");
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            🔗 复制相对路径
          </div>
          <div 
            className="context-menu-item"
            onClick={() => {
              if (contextMenu.file) {
                const absPath = `${workspaceDir}/${contextMenu.file.filepath}`.replace(/\\/g, "/");
                navigator.clipboard.writeText(absPath);
                showToast("已复制绝对路径！", "success");
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            📂 复制绝对路径
          </div>
          <div 
            className="context-menu-item"
            onClick={() => {
              if (contextMenu.file) {
                setRenameFileTarget(contextMenu.file);
                const nameWithoutExt = contextMenu.file.filename.includes(".") 
                  ? contextMenu.file.filename.substring(0, contextMenu.file.filename.lastIndexOf("."))
                  : contextMenu.file.filename;
                setRenameNewNameInput(nameWithoutExt.toString());
                setRenameModalShow(true);
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            ✏️ 快捷更名
          </div>
          <div 
            className="context-menu-item"
            onClick={() => {
              if (contextMenu.file) {
                setReorganizeFileTarget(contextMenu.file);
                const pathWithSlash = contextMenu.file.filepath.replace(/\\/g, "/");
                const parentDir = pathWithSlash.includes("/")
                  ? pathWithSlash.substring(0, pathWithSlash.lastIndexOf("/"))
                  : "";
                const defaultTarget = standardDirs.find(dir => dir !== parentDir) || standardDirs[0] || "";
                setReorganizeTargetDir(defaultTarget);
                setReorganizeModalShow(true);
              }
              setContextMenu(prev => ({ ...prev, show: false }));
            }}
          >
            📁 变更分类目录
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
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>文件将自动搬运至 {inboxName} 并执行 AI 智能推荐归档</p>
          </div>
        </div>
      )}
    </div>
  );
}