import { version } from "../../../package.json";
import { ExternalLink, RefreshCw } from "lucide-react";

interface AboutPageProps {
  theme: "dark" | "light";
  workspaceDir: string;
  isCheckingUpdate: boolean;
  updateStatus: string;
  updateErrorDetail: string;
  updateProgress: number | null;
  handleCheckForUpdates: (force: boolean) => void;
}

const repository = "https://github.com/TimeTravelCoder/LedgerProMax";

export default function AboutPage({ isCheckingUpdate, updateStatus, updateErrorDetail, updateProgress, handleCheckForUpdates }: AboutPageProps) {
  const isDevelopment = import.meta.env.DEV;

  return (
    <div className="about-page">
      <section className="settings-section about-summary" aria-label="应用信息">
        <img src="/favicon.svg" alt="" width="64" height="64" />
        <div>
          <h2>Ledger Pro Max</h2>
          <p>让文件整理更简单。</p>
          <div className="about-badges">
            <span className="about-version">v{version}</span>
            {isDevelopment && <span>开发构建</span>}
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="about-updates-title">
        <div className="settings-section__title">
          <h4 id="about-updates-title">版本与更新</h4>
          <span>{isDevelopment ? "开发构建仅检查更新，请前往发布页面下载安装。" : "发现新版本后，可确认下载并安装。"}</span>
        </div>
        <div className="about-actions">
          <button className="btn btn-primary" onClick={() => handleCheckForUpdates(true)} disabled={isCheckingUpdate}>
            <RefreshCw size={16} aria-hidden="true" />
            {isCheckingUpdate ? "处理中…" : "检查更新"}
          </button>
          <a className="btn" href={`${repository}/releases`} target="_blank" rel="noreferrer">
            更新记录 <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a className="btn" href={repository} target="_blank" rel="noreferrer">
            项目主页 <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
        {updateStatus && <p className="about-description" role="status" aria-live="polite">{updateStatus}</p>}
        {updateProgress !== null && <progress className="update-progress" value={updateProgress} max={100} aria-label="更新下载进度" />}
        {updateErrorDetail && <details className="update-error-details"><summary>查看错误详情</summary><pre>{updateErrorDetail}</pre></details>}
      </section>
    </div>
  );
}
