import React, { useState } from "react";
import { 
  Inbox, 
  FolderOpen, 
  ShieldCheck, 
  FileText, 
  HardDrive, 
  Layers, 
  Sparkles 
} from "lucide-react";
import type { FileRecord } from "../../types";
import { formatSize } from "../../utils/fileUtils";
import { invoke } from "@tauri-apps/api/core";

interface DashboardPageProps {
  setActiveTab: (tab: "dashboard" | "inbox" | "workspace" | "backup" | "settings" | "duplicates" | "about") => void;
  theme: "dark" | "light";
  allWorkspaceFiles: FileRecord[];
  inboxFiles: FileRecord[];
  backupDiskDir: string;
  backupCloudDir: string;
  desktopSummary: { normal_files: number; folders: number; shortcuts: number; temporary_files: number };
  handleCleanDesktop: () => void;
  setSelectedWorkspaceFile: (file: FileRecord | null) => void;
  setSelectedTagsFilter: (tags: string[]) => void;
  workspaceDir: string;
  showToast: (msg: string, type: "success" | "warning" | "error" | "info") => void;
}

type SignalStyle = React.CSSProperties & {
  "--signal-accent": string;
};

export default function DashboardPage({
  setActiveTab,
  theme,
  allWorkspaceFiles,
  inboxFiles,
  backupDiskDir,
  backupCloudDir,
  desktopSummary,
  handleCleanDesktop,
  setSelectedWorkspaceFile,
  setSelectedTagsFilter,
  workspaceDir,
  showToast
}: DashboardPageProps) {
  const [hoveredWeeklyIndex, setHoveredWeeklyIndex] = useState<number | null>(null);
  const [weeklyTooltipPos, setWeeklyTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // --- STATS CALCULATIONS ---
  const totalFiles = allWorkspaceFiles.length;
  const totalBytes = allWorkspaceFiles.reduce((sum, f) => sum + Number(f.file_size || 0), 0);
  const formattedSize = totalBytes > 1024 * 1024 * 1024 
    ? (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + " GB" 
    : (totalBytes / (1024 * 1024)).toFixed(2) + " MB";
  const unorganizedCount = inboxFiles.length;

  const uniqueTagsList = Array.from(new Set(allWorkspaceFiles.flatMap(f => f.tags || [])));
  const tagsCount = uniqueTagsList.length;

  const recentFilesCount = allWorkspaceFiles.filter(f => 
    (new Date().getTime() - Number(f.modified_time) * 1000) <= 7 * 24 * 60 * 60 * 1000
  ).length;

  const hasDiskBackup = (backupDiskDir || "").trim().length > 0;
  const hasCloudBackup = (backupCloudDir || "").trim().length > 0;
  const backupScore = 40 + (hasDiskBackup ? 30 : 0) + (hasCloudBackup ? 30 : 0);

  const tagCountsMap: Record<string, number> = {};
  allWorkspaceFiles.forEach(f => {
    (f.tags || []).forEach(tag => {
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

  const topRecentFiles = [...allWorkspaceFiles]
    .sort((a, b) => Number(b.modified_time) - Number(a.modified_time))
    .slice(0, 5);

  const getWeeklyActivity = (filesList: FileRecord[]) => {
    const list = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() / 1000;
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime() / 1000;
      const count = filesList.filter(f => {
        const fileTime = Number(f.modified_time);
        return fileTime >= dayStart && fileTime <= dayEnd;
      }).length;
      list.push({ label, count });
    }
    return list;
  };

  const weeklyTrendData = getWeeklyActivity(allWorkspaceFiles);
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
  const taggedFilesCount = allWorkspaceFiles.filter(f => String(f.tags || "").trim().length > 0).length;
  const archiveCoverage = totalFiles > 0 ? Math.round((taggedFilesCount / totalFiles) * 100) : 0;

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
                            onClick={async () => {
                              try {
                                await invoke("open_in_system", { workspaceDir, filepath: file.filepath });
                              } catch (err: any) {
                                showToast(`无法在系统默认应用中打开文件: ${String(err)}`, "error");
                              }
                            }}
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
  );
}
