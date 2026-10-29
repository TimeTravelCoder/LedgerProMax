
import type { FileRecord } from "../types";

export { standardDirPresets, standardDirsZhFull } from "./workspaceTemplates";

export function processFileRecord(f: any): FileRecord {
  let parsedTags: string[] = [];
  if (f.tags) {
    if (Array.isArray(f.tags)) {
      parsedTags = f.tags;
    } else {
      parsedTags = String(f.tags).split(",").map((t: string) => t.trim()).filter(Boolean);
    }
  }
  return {
    ...f,
    filepath: String(f.filepath || ""),
    filename: String(f.filename || ""),
    description: String(f.description || ""),
    tags: parsedTags
  };
}

export const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFileIcon = (filename: string, size = 32) => {
  const dotIndex = filename.lastIndexOf(".");
  const ext = dotIndex >= 0 ? filename.substring(dotIndex).toLowerCase() : "";
  
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
