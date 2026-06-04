import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { X, FileText, Image as ImageIcon, Archive, ExternalLink } from "lucide-react";

interface PreviewPanelProps {
  workspaceDir: string;
  filepath: string;
  filename: string;
  theme?: "dark" | "jade" | "light";
  onClose?: () => void;
  layout?: "modal" | "inline";
}

const highlightCode = (rawText: string, fileExt: string, isLight: boolean) => {
  let escaped = rawText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const colors = isLight ? {
    keyword: "#a71d5d",
    string: "#183691",
    number: "#0086b3",
    comment: "#969896",
  } : {
    keyword: "#c678dd",
    string: "#98c379",
    number: "#d19a66",
    comment: "#5c6370",
  };

  const ext = fileExt.toLowerCase();
  const stringsPlaceholder: string[] = [];
  
  escaped = escaped.replace(/(["'`])((?:\\.|[^\\])*?)\1/g, (_, quote, strContent) => {
    const placeholder = `___STR_PLACEHOLDER_${stringsPlaceholder.length}___`;
    stringsPlaceholder.push(`<span style="color: ${colors.string}">${quote}${strContent}${quote}</span>`);
    return placeholder;
  });

  const commentsPlaceholder: string[] = [];
  if (ext === ".py" || ext === ".yaml" || ext === ".yml" || ext === ".sh" || ext === ".toml" || ext === ".ini" || ext === ".cfg") {
    escaped = escaped.replace(/(#.*)/g, (_, comment) => {
      const placeholder = `___COM_PLACEHOLDER_${commentsPlaceholder.length}___`;
      commentsPlaceholder.push(`<span style="color: ${colors.comment}; font-style: italic;">${comment}</span>`);
      return placeholder;
    });
  } else {
    escaped = escaped.replace(/(\/\/.*)/g, (_, comment) => {
      const placeholder = `___COM_PLACEHOLDER_${commentsPlaceholder.length}___`;
      commentsPlaceholder.push(`<span style="color: ${colors.comment}; font-style: italic;">${comment}</span>`);
      return placeholder;
    });
  }

  const keywordsList = /\b(const|let|var|function|return|import|export|from|class|extends|if|else|for|while|do|break|continue|switch|case|default|try|catch|finally|throw|new|this|typeof|instanceof|async|await|def|fn|pub|use|mod|struct|impl|enum|as|in|print|self|and|or|not|elif|pass|lambda|true|false|nil|null|undefined|void|public|private|protected|static|final|interface|implements|package|type|any|string|number|boolean|Record|Vec|String|Option|Result|int|float|double|char|auto|const_cast|reinterpret_cast|static_cast|dynamic_cast|nullptr)\b/g;
  escaped = escaped.replace(keywordsList, `<span style="color: ${colors.keyword}; font-weight: 600;">$1</span>`);
  escaped = escaped.replace(/\b(\d+)\b/g, `<span style="color: ${colors.number}">$1</span>`);

  commentsPlaceholder.forEach((replacement, idx) => {
    escaped = escaped.replace(`___COM_PLACEHOLDER_${idx}___`, replacement);
  });

  stringsPlaceholder.forEach((replacement, idx) => {
    escaped = escaped.replace(`___STR_PLACEHOLDER_${idx}___`, replacement);
  });

  return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
};

export default function PreviewPanel({ workspaceDir, filepath, filename, theme = "dark", onClose, layout = "modal" }: PreviewPanelProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset zoom & pan when switching files
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, [filepath]);

  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(z => Math.min(5, Math.max(0.5, z + zoomFactor)));
  };

  const fileExt = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"].includes(fileExt);
  const isPdf = fileExt === ".pdf";
  const isDocx = fileExt === ".docx";
  const isOldDoc = fileExt === ".doc";
  const isSpreadsheet = [".xls", ".xlsx"].includes(fileExt);
  const isPresentation = [".ppt", ".pptx"].includes(fileExt);
  const isBinary = [".zip", ".rar", ".7z", ".exe", ".dll", ".dmg", ".pkg", ".tar", ".gz"].includes(fileExt);

  // Absolute path of the file for local preview
  const absolutePath = `${workspaceDir}/${filepath}`.replace(/\//g, "\\");

  useEffect(() => {
    if (isImage || isPdf || isBinary) return;

    // .docx files: extract text via Rust backend
    if (isDocx) {
      const fetchDocx = async () => {
        setLoading(true);
        setError(null);
        try {
          const text: string = await invoke("read_docx_text", { workspaceDir, filepath });
          setContent(text);
        } catch (err: any) {
          console.error(err);
          setError(`读取 Word 文档失败: ${err}`);
        } finally {
          setLoading(false);
        }
      };
      fetchDocx();
      return;
    }

    // .doc, .xls, .ppt: skip — binary legacy formats
    if (isOldDoc || isSpreadsheet || isPresentation) return;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const text: string = await invoke("read_file_content", { workspaceDir, filepath });
        setContent(text);
      } catch (err: any) {
        console.error(err);
        setError(`读取文件失败: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [workspaceDir, filepath, isImage, isPdf, isDocx, isOldDoc, isSpreadsheet, isPresentation, isBinary]);



  const handleOpenInSystem = async () => {
    try {
      await invoke("open_in_system", { workspaceDir, filepath });
    } catch (err: any) {
      alert(`无法在系统中打开文件: ${err}`);
    }
  };

  // Premium simple markdown/code parser
  const renderFormattedContent = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "150px", color: "var(--text-secondary)" }}>
          <div className="spinner" style={{ marginRight: "10px" }} /> Loading file content...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ padding: "16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "var(--color-danger)", fontSize: "13px" }}>
          {error}
        </div>
      );
    }

    if (isImage) {
      const src = convertFileSrc(absolutePath);
      return (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          width: "100%", 
          height: "100%", 
          minHeight: layout === "modal" ? "58vh" : "220px", 
          padding: "10px",
          position: "relative",
          overflow: "hidden", 
          background: theme === "light" ? "rgba(0,0,0,0.01)" : "rgba(0,0,0,0.2)",
          borderRadius: "12px",
          border: "1px solid var(--border-light)"
        }}>
          {/* 🔍 Dynamic Glassmorphic Tooltip Controller */}
          <div style={{
            position: "absolute",
            top: "15px",
            right: "15px",
            zIndex: 100,
            display: "flex",
            gap: "4px",
            background: "rgba(10, 10, 15, 0.65)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "8px",
            padding: "3px"
          }}>
            <button 
              onClick={() => setZoom(z => Math.min(5, z + 0.25))}
              className="btn" 
              style={{ padding: "4px 8px", fontSize: "11px", background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}
              title="放大 (支持滚轮)"
            >
              ➕
            </button>
            <button 
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="btn" 
              style={{ padding: "4px 8px", fontSize: "11px", background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}
              title="缩小 (支持滚轮)"
            >
              ➖
            </button>
            <button 
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="btn" 
              style={{ padding: "4px 8px", fontSize: "11px", background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}
              title="重置"
            >
              🔄 重置
            </button>
            <span style={{ 
              fontSize: "11px", 
              color: "rgba(255,255,255,0.8)", 
              display: "flex", 
              alignItems: "center", 
              padding: "0 8px",
              fontFamily: "monospace",
              borderLeft: "1px solid rgba(255,255,255,0.15)"
            }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <img
            src={src}
            alt={filename}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onWheel={handleWheel}
            style={{
              maxWidth: "100%",
              maxHeight: layout === "modal" ? "58vh" : "280px",
              borderRadius: "8px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
              objectFit: "contain",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: isDragging ? "grabbing" : "grab",
              transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              userSelect: "none",
              pointerEvents: "auto"
            }}
          />
        </div>
      );
    }

    if (isPdf) {
      const src = convertFileSrc(absolutePath);
      return (
        <div style={{ width: "100%", height: layout === "modal" ? "62vh" : "320px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-light)" }}>
          <iframe
            src={src}
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
            title={filename}
          />
        </div>
      );
    }

    if (isDocx) {
      // .docx text content preview
      if (loading) {
        return (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "150px", color: "var(--text-secondary)" }}>
            <div className="spinner" style={{ marginRight: "10px" }} /> 正在解析 Word 文档...
          </div>
        );
      }
      if (error) {
        return (
          <div style={{ padding: "16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "var(--color-danger)", fontSize: "13px" }}>
            {error}
          </div>
        );
      }
      const isLightTheme = theme === "light";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{
            background: isLightTheme ? "#fefce8" : "rgba(251, 191, 36, 0.08)",
            border: `1px solid ${isLightTheme ? "rgba(180, 83, 9, 0.2)" : "rgba(251, 191, 36, 0.18)"}`,
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "11px",
            color: isLightTheme ? "#92400e" : "var(--color-warning)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span>仅显示文本内容，格式与图片可能未完整保留。</span>
            <button
              className="btn"
              onClick={handleOpenInSystem}
              style={{ marginLeft: "auto", padding: "4px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
            >
              <ExternalLink size={12} />
              用 Word 打开
            </button>
          </div>
          <pre style={{
            background: isLightTheme ? "#f8fafc" : "rgba(0,0,0,0.2)",
            padding: "16px",
            borderRadius: "10px",
            border: `1px solid ${isLightTheme ? "rgba(0,0,0,0.08)" : "var(--border-light)"}`,
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: "1.7",
            margin: 0,
            maxHeight: "58vh",
            overflowY: "auto"
          }}>
            {content || "(文档无文本内容)"}
          </pre>
        </div>
      );
    }

    if (isOldDoc || isSpreadsheet || isPresentation || isBinary) {
      const isLightTheme = theme === "light";
      const label = isOldDoc ? "旧版 Word 文档 (.doc)" : isSpreadsheet ? "Excel 表格" : isPresentation ? "PowerPoint 演示文稿" : "压缩包或二进制文件";
      const desc = isOldDoc
        ? "旧版 .doc 格式为二进制复合文档，暂不支持文本提取。请在 Word 中打开此文件。"
        : isSpreadsheet
        ? "Excel 表格暂不支持直接在应用内预览。请在 Excel 中打开此文件。"
        : isPresentation
        ? "PPT 演示文稿暂不支持直接在应用内预览。请在 PowerPoint 中打开此文件。"
        : "二进制与压缩文件不支持在应用内解析。请使用系统默认工具打开此文件。";
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 24px",
            background: isLightTheme ? "rgba(0, 0, 0, 0.02)" : "rgba(255, 255, 255, 0.01)",
            borderRadius: "12px",
            border: "1px dashed var(--border-light)",
            textAlign: "center",
            marginTop: "10px"
          }}
        >
          {isOldDoc || isSpreadsheet || isPresentation ? (
            <FileText size={48} style={{ color: "var(--color-primary)", marginBottom: "16px" }} />
          ) : (
            <Archive size={48} style={{ color: "var(--color-primary)", marginBottom: "16px" }} />
          )}
          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            {label}
          </h4>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5", maxWidth: "260px", marginBottom: "20px" }}>
            {desc}
          </p>
          <button
            className="btn btn-primary"
            onClick={handleOpenInSystem}
            style={{ padding: "8px 16px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ExternalLink size={14} />
            <span>在系统默认程序中打开</span>
          </button>
        </div>
      );
    }

    // Markdown simple parse
    if (fileExt === ".md") {
      const lines = content.split("\n");
      let insideCodeBlock = false;
      let codeBlockContent: string[] = [];
      const isLightTheme = theme === "light";

      return (
        <div className="markdown-body" style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6", textAlign: "left" }}>
          {lines.map((line, idx) => {
            const trimmed = line.trim();

            // Code blocks
            if (trimmed.startsWith("```")) {
              if (insideCodeBlock) {
                insideCodeBlock = false;
                const code = codeBlockContent.join("\n");
                codeBlockContent = [];
                return (
                  <pre key={idx} style={{ background: isLightTheme ? "#f8fafc" : "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", border: isLightTheme ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--border-light)", fontFamily: "var(--mono)", fontSize: "12px", overflowX: "auto", margin: "12px 0", color: isLightTheme ? "#334155" : "#abb2bf" }}>
                    {highlightCode(code, ".js", isLightTheme)}
                  </pre>
                );
              } else {
                insideCodeBlock = true;
                return null;
              }
            }

            if (insideCodeBlock) {
              codeBlockContent.push(line);
              return null;
            }

            // Headings
            if (trimmed.startsWith("# ")) {
              return <h1 key={idx} style={{ fontSize: "20px", fontWeight: 700, borderBottom: "1px solid var(--border-light)", paddingBottom: "6px", margin: "18px 0 10px 0" }}>{trimmed.slice(2)}</h1>;
            }
            if (trimmed.startsWith("## ")) {
              return <h2 key={idx} style={{ fontSize: "17px", fontWeight: 600, margin: "16px 0 8px 0" }}>{trimmed.slice(3)}</h2>;
            }
            if (trimmed.startsWith("### ")) {
              return <h3 key={idx} style={{ fontSize: "15px", fontWeight: 600, margin: "14px 0 6px 0", color: "var(--color-primary)" }}>{trimmed.slice(4)}</h3>;
            }

            // Bullet lists
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
              return (
                <li key={idx} style={{ marginLeft: "20px", marginBottom: "4px", listStyleType: "disc" }}>
                  {trimmed.slice(2)}
                </li>
              );
            }

            // Numbered lists
            if (/^\d+\.\s/.test(trimmed)) {
              const dotIdx = trimmed.indexOf(".");
              return (
                <li key={idx} style={{ marginLeft: "20px", marginBottom: "4px", listStyleType: "decimal" }}>
                  {trimmed.slice(dotIdx + 2)}
                </li>
              );
            }

            // Quotes
            if (trimmed.startsWith("> ")) {
              return (
                <blockquote key={idx} style={{ borderLeft: "4px solid var(--color-primary)", paddingLeft: "12px", color: "var(--text-muted)", margin: "10px 0", fontStyle: "italic", background: isLightTheme ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.01)" }}>
                  {trimmed.slice(2)}
                </blockquote>
              );
            }

            // Horizontal line
            if (trimmed === "---" || trimmed === "***") {
              return <hr key={idx} style={{ border: "none", borderTop: "1px solid var(--border-light)", margin: "16px 0" }} />;
            }

            // Normal paragraphs
            return line === "" ? <div key={idx} style={{ height: "8px" }} /> : <p key={idx} style={{ marginBottom: "8px" }}>{line}</p>;
          })}
          {insideCodeBlock && codeBlockContent.length > 0 && (
            <pre style={{ background: isLightTheme ? "#f8fafc" : "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px", border: isLightTheme ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--border-light)", fontFamily: "var(--mono)", fontSize: "12px", overflowX: "auto", margin: "12px 0", color: isLightTheme ? "#334155" : "#abb2bf" }}>
              {highlightCode(codeBlockContent.join("\n"), ".js", isLightTheme)}
            </pre>
          )}
        </div>
      );
    }

    // Code & JSON syntax presentation
    const isCode = [".js", ".ts", ".tsx", ".jsx", ".py", ".rs", ".cpp", ".c", ".h", ".java", ".html", ".css", ".json", ".sql", ".sh", ".yaml", ".yml"].includes(fileExt);
    const isLightTheme = theme === "light";

    return (
      <pre
        style={{
          background: isLightTheme ? "#f8fafc" : "rgba(0,0,0,0.2)",
          padding: "16px",
          borderRadius: "10px",
          border: isLightTheme ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--border-light)",
          fontFamily: "var(--mono)",
          fontSize: "13px",
          color: isLightTheme ? "#334155" : "#abb2bf",
          overflowX: "auto",
          textAlign: "left",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          margin: 0,
          maxHeight: layout === "modal" ? "58vh" : "260px",
        }}
      >
        {isCode ? highlightCode(content || "", fileExt, isLightTheme) : <code>{content || "(空文件)"}</code>}
      </pre>
    );
  };

  const panelContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
      {/* Title Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          {isImage ? <ImageIcon size={16} className="text-primary" /> : <FileText size={16} className="text-primary" />}
          <span style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filename}
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={handleOpenInSystem}
            className="btn"
            style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.03)" }}
            title="用系统默认软件打开"
          >
            <ExternalLink size={13} />
            <span>打开</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="btn"
              style={{ padding: "4px", background: "rgba(255,255,255,0.03)", border: "none" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Rendering Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {renderFormattedContent()}
      </div>
    </div>
  );



  // Floating modal vs inline card layout
  if (layout === "modal") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
        {panelContent}
      </div>
    );
  }

  // Inline card mode
  return (
    <div
      className="cyber-card"
      style={{
        padding: "16px",
        marginTop: "16px",
        background: "rgba(255,255,255,0.015)",
        borderColor: "rgba(99, 102, 241, 0.15)",
      }}
    >
      {panelContent}
    </div>
  );
}
