import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import LiquidGlass from "./liquid-glass/LiquidGlass";
import { Archive, X, CheckCircle2, AlertCircle, FileText } from "lucide-react";

interface ZipArchiveModalProps {
  workspaceDir: string;
  selectedFilenames: string[]; // Relative paths selected from workspace list
  theme?: "dark" | "jade" | "light";
  onClose: () => void;
  onSuccess: () => void;
  addLog: (msg: string) => void;
}

export default function ZipArchiveModal({
  workspaceDir,
  selectedFilenames,
  theme = "dark",
  onClose,
  onSuccess,
  addLog,
}: ZipArchiveModalProps) {
  const [zipName, setZipName] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "compressing" | "completed" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Generate default ZIP name: Archive_YYYYMMDD.zip
    const today = new Date().toISOString().substring(0, 10).replace(/-/g, "");
    setZipName(`归档_${today}.zip`);
  }, []);

  useEffect(() => {
    if (status === "completed") {
      setProgress(100);
    } else if (status === "idle" || status === "error") {
      setProgress(0);
    } else if (status === "compressing") {
      setProgress(10);
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 92) {
            clearInterval(timer);
            return 92;
          }
          const increment = Math.floor(Math.random() * 6) + 2; // Random 2% - 7%
          return Math.min(prev + increment, 92);
        });
      }, 250);
      return () => clearInterval(timer);
    }
  }, [status]);

  const handleArchive = async () => {
    if (!zipName.trim()) {
      setErrorMessage("请输入归档压缩包的文件名！");
      setStatus("error");
      return;
    }

    let cleanZipName = zipName.trim();
    if (!cleanZipName.toLowerCase().endsWith(".zip")) {
      cleanZipName += ".zip";
    }

    setStatus("compressing");
    setProgress(0);
    setErrorMessage("");

    addLog(`开始将 ${selectedFilenames.length} 个文件打包归档至: 10归档区/${cleanZipName}`);

    try {
      const actualZipName: string = await invoke("archive_to_zip", {
        workspaceDir,
        filenames: selectedFilenames,
        zipName: cleanZipName,
      });

      setStatus("completed");
      setProgress(100);
      addLog(`归档打包成功！生成归档：${actualZipName}`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.toString());
      setStatus("error");
      addLog(`[错误] 归档打包失败: ${err}`);
    }
  };

  const isWorking = status === "compressing";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme === "light" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.6)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div style={{ width: "90%", maxWidth: "480px", position: "relative" }}>
        <LiquidGlass overLight={theme === "light"} cornerRadius={20} padding="28px" elasticity={0.2} displacementScale={80}>
          <div style={{ width: "90vw", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--color-primary)" }}>
                <Archive size={20} />
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>安全打包归档保险箱</h3>
              </div>
              {!isWorking && (
                <button
                  onClick={onClose}
                  style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "4px" }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {status === "completed" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0", textAlign: "center", gap: "12px" }}>
                <div style={{ background: "var(--color-success-glow)", padding: "12px", borderRadius: "50%", color: "var(--color-success)" }}>
                  <CheckCircle2 size={40} />
                </div>
                <h4 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>归档打包 & 双重校验成功！</h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>所有源物理文件均已安全转移清除。</p>
              </div>
            ) : (
              <>
                {/* File list preview */}
                <div style={{ background: theme === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>待打包的文件 ({selectedFilenames.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
                    {selectedFilenames.map((name, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-primary)" }}>
                        <FileText size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Input ZIP name */}
                {!isWorking && (
                  <div>
                    <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>压缩包文件名 (.zip)</label>
                    <input
                      type="text"
                      value={zipName}
                      disabled={isWorking}
                      onChange={(e) => setZipName(e.target.value)}
                      placeholder="如: archive.zip"
                      className="input-field"
                    />
                  </div>
                )}

                {/* Progress bar micro-animation */}
                {status !== "idle" && status !== "error" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
                      <span>
                        {status === "compressing" && "正在压缩打包并校验完整性..."}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    {/* Glass fluid progress bar container */}
                    <div style={{ height: "6px", background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden", position: "relative" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${progress}%`,
                          background: "linear-gradient(90deg, var(--color-primary) 0%, #a855f7 100%)",
                          borderRadius: "3px",
                          transition: "width 0.3s ease-out",
                          boxShadow: "0 0 10px var(--color-primary-glow)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {status === "error" && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", padding: "12px", borderRadius: "8px", color: "#f87171", fontSize: "12px" }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <div>{errorMessage}</div>
                  </div>
                )}

                {/* Action buttons */}
                {!isWorking && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                    <button onClick={onClose} className="btn" style={{ flex: 1, justifyContent: "center" }}>
                      取消
                    </button>
                    <button onClick={handleArchive} className="btn btn-primary" style={{ flex: 2, justifyContent: "center" }}>
                      🔒 安全归档并清理源
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
}
