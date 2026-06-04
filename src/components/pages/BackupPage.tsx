
import { 
  HardDrive, 
  Cloud, 
  AlertTriangle 
} from "lucide-react";
import type { BackupHistoryRecord } from "../../types";
import { formatSize } from "../../utils/fileUtils";

interface BackupPageProps {
  theme: "dark" | "light";
  backupDiskDir: string;
  backupCloudDir: string;
  backupHistory: BackupHistoryRecord[];
  backupLog: string[];
  isBackingUp: boolean;
  handleRunBackup: (type: "disk" | "cloud") => void;
  backupScore: number;
  workspaceDir: string;
}

export default function BackupPage({
  theme,
  backupDiskDir,
  backupCloudDir,
  backupHistory,
  backupLog,
  isBackingUp,
  handleRunBackup,
  backupScore,
  workspaceDir
}: BackupPageProps) {
  const hasSuccessfulDiskBackup = backupHistory.some(h => h.backup_type === "disk" && h.status === "success");
  const hasSuccessfulCloudBackup = backupHistory.some(h => h.backup_type === "cloud" && h.status === "success");

  // Calculate node status
  const diskState = !backupDiskDir.trim() 
    ? "unconfigured" 
    : (!hasSuccessfulDiskBackup ? "configured_no_backup" : "protected");
  
  const cloudState = !backupCloudDir.trim() 
    ? "unconfigured" 
    : (!hasSuccessfulCloudBackup ? "configured_no_backup" : "protected");

  return (
    <div style={{display: "flex", flexDirection: "column", gap: "20px", height: "100%", width: "100%"}}>
      
      {/* 🎨 CSS Styles with Animations for the Storage Map */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flowLine {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes pulseSlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}} />

      {/* 🆕 3-2-1 异地容灾存储概览 (Storage Map) */}
      <div style={{
        background: theme === "light" 
          ? "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)" 
          : "linear-gradient(135deg, rgba(17, 24, 39, 0.6) 0%, rgba(31, 41, 55, 0.4) 100%)",
        border: "1px solid var(--border-light)",
        borderRadius: "16px",
        padding: "20px",
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        gap: "24px",
        alignItems: "center",
        boxShadow: theme === "light" ? "0 4px 20px rgba(0,0,0,0.03)" : "0 4px 30px rgba(0,0,0,0.2)",
        backdropFilter: "blur(12px)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Decorative background glow */}
        <div style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "250px",
          height: "250px",
          borderRadius: "50%",
          background: backupScore === 100 
            ? "rgba(16, 185, 129, 0.08)" 
            : (backupScore >= 70 ? "rgba(245, 158, 11, 0.08)" : "rgba(239, 68, 68, 0.08)"),
          filter: "blur(60px)",
          pointerEvents: "none"
        }} />

        {/* Left Column: Protection Level Shield Indicator */}
        <div style={{
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          textAlign: "center",
          borderRight: "1px solid var(--border-light)",
          paddingRight: "24px"
        }}>
          {/* Ring score container */}
          <div style={{
            position: "relative",
            width: "100px",
            height: "100px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: theme === "light" ? "#f1f5f9" : "rgba(255,255,255,0.02)",
            border: `4px solid ${
              backupScore === 100 
                ? "rgba(16, 185, 129, 0.2)" 
                : (backupScore >= 70 ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)")
            }`,
            boxShadow: backupScore === 100 
              ? "0 0 20px rgba(16, 185, 129, 0.15)" 
              : (backupScore >= 70 ? "0 0 20px rgba(245, 158, 11, 0.15)" : "0 0 20px rgba(239, 68, 68, 0.15)"),
            marginBottom: "12px",
            transition: "all 0.3s ease"
          }}>
            <div style={{
              fontSize: "32px",
              animation: "pulseSlow 3s infinite ease-in-out"
            }}>
              {backupScore === 100 ? "🛡️" : (backupScore >= 70 ? "⚠️" : "🚨")}
            </div>
            <div style={{
              position: "absolute",
              bottom: "-8px",
              background: backupScore === 100 
                ? "#10b981" 
                : (backupScore >= 70 ? "#f59e0b" : "#ef4444"),
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "99px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
            }}>
              {backupScore}% 安全指数
            </div>
          </div>

          <h4 style={{fontSize: "15px", fontWeight: 700, margin: "6px 0 4px 0"}}>
            {backupScore === 100 ? "3-2-1 黄金备份防线" : (backupScore >= 70 ? "双介质容灾防御" : "极高丢失风险")}
          </h4>
          <p style={{fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4", margin: 0}}>
            {backupScore === 100 
              ? "符合3-2-1异地多活备份黄金法则。已配置双介质冗余与云端同步防御。" 
              : (backupScore >= 70 
                ? "已具备基础本地备份，但缺少异地云存储保护，一旦本地遭受不可抗力将有丢失风险。" 
                : "仅有本地工作区运行，无任何额外备份保护。请尽快配置外部硬盘与私有云盘。")}
          </p>
        </div>

        {/* Right Column: Node Topology Map */}
        <div style={{
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          position: "relative",
          width: "100%",
          height: "100%"
        }}>
          {/* SVG Connector Lines */}
          <svg style={{
            position: "absolute",
            top: "50%",
            left: "12%",
            width: "76%",
            height: "40px",
            transform: "translateY(-50%)",
            zIndex: 1,
            pointerEvents: "none"
          }}>
            {/* Line 1: Local -> Disk */}
            <path 
              d="M 10,20 L 190,20" 
              fill="none" 
              stroke={diskState === "protected" ? "#10b981" : (diskState === "configured_no_backup" ? "#f59e0b" : "#ef4444")}
              strokeWidth="3"
              strokeDasharray={diskState === "unconfigured" ? "6,6" : "none"}
              style={{
                animation: diskState !== "unconfigured" ? "flowLine 2s linear infinite" : "none",
                opacity: diskState === "unconfigured" ? 0.3 : 1,
                transition: "stroke 0.3s ease"
              }}
            />
            {/* Line 2: Local -> Cloud */}
            <path 
              d="M 210,20 L 390,20" 
              fill="none" 
              stroke={cloudState === "protected" ? "#10b981" : (cloudState === "configured_no_backup" ? "#f59e0b" : "#ef4444")}
              strokeWidth="3"
              strokeDasharray={cloudState === "unconfigured" ? "6,6" : "none"}
              style={{
                animation: cloudState !== "unconfigured" ? "flowLine 2s linear infinite" : "none",
                opacity: cloudState === "unconfigured" ? 0.3 : 1,
                transition: "stroke 0.3s ease"
              }}
            />
          </svg>

          {/* Node 1: Local Workspace */}
          <div style={{
            width: "150px",
            background: theme === "light" ? "#fff" : "rgba(20, 24, 33, 0.8)",
            border: "2px solid #3b82f6",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            zIndex: 2,
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.15)",
            minHeight: "115px",
            justifyContent: "space-between"
          }}>
            <div style={{fontSize: "24px", marginBottom: "4px"}}>💻</div>
            <div style={{fontSize: "12px", fontWeight: 700}}>本地工作区</div>
            <span style={{
              fontSize: "9px",
              color: "#3b82f6",
              background: "rgba(59, 130, 246, 0.1)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: 600
            }}>
              活动数据源
            </span>
            <div style={{
              fontSize: "10px", 
              color: "var(--text-muted)", 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap", 
              width: "100%",
              marginTop: "4px"
            }} title={workspaceDir}>
              {workspaceDir}
            </div>
          </div>

          {/* Node 2: Disk Backup */}
          <div style={{
            width: "150px",
            background: theme === "light" ? "#fff" : "rgba(20, 24, 33, 0.8)",
            border: `2px solid ${
              diskState === "protected" 
                ? "#10b981" 
                : (diskState === "configured_no_backup" ? "#f59e0b" : "var(--border-light)")
            }`,
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            zIndex: 2,
            boxShadow: diskState === "protected" 
              ? "0 4px 12px rgba(16, 185, 129, 0.15)" 
              : (diskState === "configured_no_backup" ? "0 4px 12px rgba(245, 158, 11, 0.15)" : "none"),
            minHeight: "115px",
            justifyContent: "space-between",
            opacity: diskState === "unconfigured" ? 0.6 : 1,
            transition: "all 0.3s ease"
          }}>
            <div style={{fontSize: "24px", marginBottom: "4px"}}>💾</div>
            <div style={{fontSize: "12px", fontWeight: 700}}>外部硬盘镜像</div>
            
            {diskState === "protected" && (
              <span style={{
                fontSize: "9px",
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.1)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600
              }}>
                🛡️ 受保护
              </span>
            )}
            {diskState === "configured_no_backup" && (
              <span style={{
                fontSize: "9px",
                color: "#f59e0b",
                background: "rgba(245, 158, 11, 0.1)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600
              }}>
                ⏳ 待同步
              </span>
            )}
            {diskState === "unconfigured" && (
              <span style={{
                fontSize: "9px",
                color: "var(--text-muted)",
                background: "rgba(0,0,0,0.05)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600
              }}>
                未启用
              </span>
            )}

            <div style={{
              fontSize: "10px", 
              color: "var(--text-muted)", 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap", 
              width: "100%",
              marginTop: "4px"
            }} title={backupDiskDir || "未配置路径"}>
              {backupDiskDir || "未配置备份路径"}
            </div>
          </div>

          {/* Node 3: Cloud Backup */}
          <div style={{
            width: "150px",
            background: theme === "light" ? "#fff" : "rgba(20, 24, 33, 0.8)",
            border: `2px solid ${
              cloudState === "protected" 
                ? "#10b981" 
                : (cloudState === "configured_no_backup" ? "#f59e0b" : "var(--border-light)")
            }`,
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            zIndex: 2,
            boxShadow: cloudState === "protected" 
              ? "0 4px 12px rgba(16, 185, 129, 0.15)" 
              : (cloudState === "configured_no_backup" ? "0 4px 12px rgba(245, 158, 11, 0.15)" : "none"),
            minHeight: "115px",
            justifyContent: "space-between",
            opacity: cloudState === "unconfigured" ? 0.6 : 1,
            transition: "all 0.3s ease"
          }}>
            <div style={{fontSize: "24px", marginBottom: "4px"}}>☁️</div>
            <div style={{fontSize: "12px", fontWeight: 700}}>私有云端归档</div>
            
            {cloudState === "protected" && (
              <span style={{
                fontSize: "9px",
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.1)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600
              }}>
                🛡️ 受保护
              </span>
            )}
            {cloudState === "configured_no_backup" && (
              <span style={{
                fontSize: "9px",
                color: "#f59e0b",
                background: "rgba(245, 158, 11, 0.1)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600
              }}>
                ⏳ 待同步
              </span>
            )}
            {cloudState === "unconfigured" && (
              <span style={{
                fontSize: "9px",
                color: "var(--text-muted)",
                background: "rgba(0,0,0,0.05)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600
              }}>
                未启用
              </span>
            )}

            <div style={{
              fontSize: "10px", 
              color: "var(--text-muted)", 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap", 
              width: "100%",
              marginTop: "4px"
            }} title={backupCloudDir || "未配置路径"}>
              {backupCloudDir || "未配置备份路径"}
            </div>
          </div>

        </div>
      </div>

      {/* Sub columns container */}
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flex: 1, minHeight: 0}}>
        {/* Left Column: Backup Executions */}
        <div style={{display: "flex", flexDirection: "column", gap: "20px", minHeight: 0}}>
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px"}}>
            {/* Disk Backup card */}
            <div style={{display: "flex", flexDirection: "column", gap: "16px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "24px", transition: "border-color 0.15s ease"}}>
              <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                <div style={{background: "var(--color-primary-glow)", padding: "8px", borderRadius: "8px", color: "var(--color-primary)"}}>
                  <HardDrive size={22} />
                </div>
                <h3 style={{fontSize: "15px", fontWeight: 600}}>外部存储介质备份</h3>
              </div>
              <p style={{fontSize: "12px", color: "var(--text-secondary)"}}>将工作空间所有数据安全镜像备份到移动硬盘或本地闪存卡中。</p>
              <button className="btn btn-primary" onClick={() => handleRunBackup("disk")} disabled={isBackingUp} style={{width: "100%", justifyContent: "center", opacity: isBackingUp ? 0.6 : 1}}>
                开始增量备份
              </button>
            </div>

            {/* Cloud Backup card */}
            <div style={{display: "flex", flexDirection: "column", gap: "16px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "24px", transition: "border-color 0.15s ease"}}>
              <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                <div style={{background: "var(--color-success-glow)", padding: "8px", borderRadius: "8px", color: "var(--color-success)"}}>
                  <Cloud size={22} />
                </div>
                <h3 style={{fontSize: "15px", fontWeight: 600}}>私有云盘异地备份</h3>
              </div>
              <p style={{fontSize: "12px", color: "var(--text-secondary)"}}>同步数据至百度云/坚果云/OneDrive等挂载盘完成异地多活备份。</p>
              <button className="btn" onClick={() => handleRunBackup("cloud")} disabled={isBackingUp} style={{width: "100%", justifyContent: "center", borderColor: "var(--color-success)", color: "var(--color-success)", opacity: isBackingUp ? 0.6 : 1}}>
                {isBackingUp ? "⏳ 备份中..." : "开始云盘备份"}
              </button>
            </div>
          </div>

          {/* Active backup terminal console */}
          <div style={{flex: 1, display: "flex", flexDirection: "column", gap: "12px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "24px", minHeight: 0}}>
            <h4 style={{fontSize: "13px", fontWeight: 600, flexShrink: 0}}>💻 实时备份监控控制台</h4>
            <div style={{
              flex: 1,
              minHeight: 0,
              background: "#0a0b10",
              borderRadius: "10px",
              padding: "16px",
              fontFamily: "var(--mono)",
              fontSize: "12px",
              color: "#10b981",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column"
            }}>
              {backupLog.length === 0 ? (
                <span style={{color: "#4b5563"}}>等待备份任务启动...</span>
              ) : (
                [...backupLog].reverse().map((log, idx) => (
                  <div key={idx} style={{marginBottom: "4px"}}>{log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Backup History */}
        <div style={{display: "flex", flexDirection: "column", gap: "20px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-light)", borderRadius: "16px", padding: "24px", minHeight: 0}}>
          <h3 className="card-title" style={{flexShrink: 0}}>📜 备份历史记录列表</h3>

          <div style={{display: "flex", flexDirection: "column", gap: "12px", flex: 1, minHeight: 0, overflowY: "auto"}}>
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
                    <div style={{display: "flex", alignItems: "center", gap: "6px"}}>
                      {item.status === "success" && (
                        <span style={{
                          fontSize: "10px",
                          color: "#10b981",
                          background: "rgba(16, 185, 129, 0.1)",
                          border: "1px solid rgba(16, 185, 129, 0.2)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          fontWeight: 500,
                          boxShadow: "0 0 8px rgba(16, 185, 129, 0.15)"
                        }}>
                          🛡️ 完整校验一致
                        </span>
                      )}
                      <span className={`badge ${item.status === "success" ? "badge-success" : "badge-danger"}`} style={{fontSize: "9px"}}>
                        {item.status}
                      </span>
                    </div>
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

    </div>
  );
}
