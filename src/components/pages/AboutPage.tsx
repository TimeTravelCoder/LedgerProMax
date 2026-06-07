

interface AboutPageProps {
  theme: "dark" | "light";
  workspaceDir: string;
  isCheckingUpdate: boolean;
  handleCheckForUpdates: (force: boolean) => void;
}

export default function AboutPage({
  theme,
  workspaceDir,
  isCheckingUpdate,
  handleCheckForUpdates
}: AboutPageProps) {
  return (
    <div style={{overflowY: "auto", flex: 1, paddingRight: "6px", paddingBottom: "40px", maxWidth: "100%", margin: "0 auto", width: "100%"}}>

      {/* Hero — centered, bold */}
      <div style={{textAlign: "center", padding: "48px 20px 28px"}}>
        <div style={{
          background: "linear-gradient(135deg, #6366f1 0%, #a855f7 40%, #22d3ee 100%)",
          width: "80px", height: "80px", borderRadius: "20px",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: "28px", fontWeight: 900, color: "#fff",
          boxShadow: "0 16px 40px rgba(99, 102, 241, 0.35), 0 0 80px rgba(99, 102, 241, 0.12)",
          marginBottom: "24px"
        }}>PM</div>
        <h1 style={{fontFamily: "var(--font-display)", fontSize: "32px", fontWeight: 800, marginBottom: "6px", letterSpacing: "-0.5px"}}>Ledger Pro Max</h1>
        <p style={{color: "var(--text-secondary)", fontSize: "15px", marginBottom: "12px", lineHeight: 1.6}}>
          本地桌面文档资产管理控制台<br/>收集 · 整理 · 标签 · 查重 · 备份 — 一条龙工作流
        </p>
        <div style={{display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", alignItems: "center"}}>
          <span style={{padding: "5px 14px", borderRadius: "99px", background: "var(--color-primary)", color: "#fff", fontSize: "12px", fontWeight: 700}}>v3.2.0</span>
          <span style={{padding: "5px 14px", borderRadius: "99px", border: "1px solid var(--border-light)", fontSize: "12px", color: "var(--text-secondary)"}}>Windows 旗舰发布版</span>
          <button 
            onClick={() => handleCheckForUpdates(true)} 
            disabled={isCheckingUpdate}
            style={{
              padding: "4px 14px", 
              borderRadius: "99px", 
              border: "1px solid var(--color-primary)", 
              background: "rgba(99, 102, 241, 0.08)",
              color: "var(--color-primary)", 
              fontSize: "12px", 
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-primary)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(99, 102, 241, 0.08)";
              e.currentTarget.style.color = "var(--color-primary)";
            }}
          >
            🔄 {isCheckingUpdate ? "正在检查..." : "检查更新"}
          </button>
        </div>
      </div>

      {/* Branch lineage — inspired by Ledger Max README */}
      <div className="cyber-card" style={{marginBottom: "20px"}}>
        <h3 className="card-title" style={{fontSize: "16px"}}>🧭 分支演进</h3>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px"}}>
          {[
            ["📁", "master", "基础开源版", "var(--text-secondary)"],
            ["🧩", "Plus", "工作区增强版", "#f59e0b"],
            ["🛡️", "pro", "安全事务版", "#10b981"],
            ["👑", "Max", "Windows 旗舰版", "#6366f1"],
            ["🍎", "Max_Mac", "macOS DMG", "#ec4899"],
          ].map(([icon, branch, desc, color]) => (
            <div key={branch} style={{padding: "12px", borderRadius: "10px", border: "1px solid var(--border-light)", background: "rgba(255,255,255,0.015)", textAlign: "center"}}>
              <div style={{fontSize: "20px", marginBottom: "4px"}}>{icon}</div>
              <div style={{fontSize: "13px", fontWeight: 700, color}}>{branch}</div>
              <div style={{fontSize: "10px", color: "var(--text-muted)", marginTop: "2px"}}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop: "14px", padding: "12px", borderRadius: "8px", background: theme === "light" ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, textAlign: "center"}}>
          👑 <strong style={{color: "var(--color-primary)"}}>Pro Max</strong> 继承 Max 全部旗舰特性，以 <strong style={{color: "var(--color-primary)"}}>Tauri v2 + React + Rust</strong> 重写，带来原生性能与跨平台能力。
        </div>
      </div>

      {/* Feature highlights — badge grid */}
      <div style={{marginBottom: "20px"}}>
        <h3 className="card-title" style={{fontSize: "16px", marginBottom: "12px"}}>✨ 旗舰能力</h3>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px"}}>
          {[
            ["📥", "智能收集箱", "拖拽投递、命名模板、标签与备注"],
            ["📡", "多目录监听", "新文件落地即时提醒整理"],
            ["🏷️", "AI 标签推荐", "语义分析自动匹配标签"],
            ["🗂️", "分类工作空间", "12 个标准目录 + 拼音搜索"],
            ["👁️", "文件预览", "文本/Markdown/图片/PDF/Word"],
            ["🔒", "安全归档", "ZIP 打包 + SHA-256 校验"],
            ["💾", "3-2-1 备份", "本地/外置/云端三层保护"],
            ["🔍", "智能查重", "文件名/大小/哈希三模式"],
            ["🎨", "双主题", "赛博暗黑 + 极简明亮"],
            ["⌨️", "键盘快捷键", "Ctrl+1~5 快速切换板块"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{padding: "14px", borderRadius: "10px", border: "1px solid var(--border-light)", background: "rgba(255,255,255,0.015)", display: "flex", gap: "12px", alignItems: "flex-start"}}>
              <span style={{fontSize: "20px", flexShrink: 0}}>{icon}</span>
              <div>
                <div style={{fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px"}}>{title}</div>
                <div style={{fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4}}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack + System Info — side by side */}
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px"}}>
        <div className="cyber-card">
          <h3 className="card-title" style={{fontSize: "16px"}}>⚙️ 技术栈</h3>
          <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
            {[
              ["桌面框架", "Tauri v2 (Rust)"],
              ["前端", "React 19 + TypeScript"],
              ["构建工具", "Vite 8"],
              ["数据库", "SQLite (rusqlite)"],
              ["文件监控", "notify (Rust)"],
              ["图标", "Lucide React"],
            ].map(([k, v]) => (
              <div key={k} style={{display: "flex", justifyContent: "space-between", fontSize: "13px"}}>
                <span style={{color: "var(--text-muted)"}}>{k}</span>
                <span style={{color: "var(--text-primary)", fontWeight: 500}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="cyber-card">
          <h3 className="card-title" style={{fontSize: "16px"}}>🖥️ 系统诊断</h3>
          <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
            {[
              ["工作区", workspaceDir],
              ["平台", "Windows 10/11 x64"],
              ["许可证", "MIT"],
              ["构建日期", "2026-06-07"],
              ["数据库", "SQLite (bundled)"],
              ["版本", "v3.2.0"],
            ].map(([k, v]) => (
              <div key={k} style={{display: "flex", justifyContent: "space-between", fontSize: "13px"}}>
                <span style={{color: "var(--text-muted)"}}>{k}</span>
                <span style={{color: "var(--text-primary)", fontWeight: 500, wordBreak: "break-all", maxWidth: "60%", textAlign: "right"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open source credits */}
      <div className="cyber-card" style={{marginBottom: "20px"}}>
        <h3 className="card-title" style={{fontSize: "16px"}}>🙏 开源致谢</h3>
        <div style={{display: "flex", flexWrap: "wrap", gap: "6px"}}>
          {["tauri", "react", "vite", "rusqlite", "notify", "zip-rs", "walkdir", "chrono", "sha2", "regex", "encoding-rs", "serde", "lucide-react", "typescript"].map(d => (
            <span key={d} style={{padding: "4px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.025)", border: "1px solid var(--border-light)", fontSize: "11px", color: "var(--text-secondary)", fontFamily: "monospace"}}>{d}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{textAlign: "center", padding: "8px 0 40px", fontSize: "13px", color: "var(--text-muted)"}}>
        <a href="https://github.com/TimeTravelCoder/LedgerProMax" target="_blank" rel="noreferrer" style={{color: "var(--color-primary)", textDecoration: "none", fontWeight: 600}}>github.com/TimeTravelCoder/LedgerProMax</a>
        <span style={{margin: "0 12px"}}>·</span>
        <span>Built for knowledge workers</span>
      </div>
    </div>
  );
}
