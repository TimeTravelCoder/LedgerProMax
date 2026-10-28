<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="96" alt="Ledger Pro Max Logo"/>

# 👑 Ledger Pro Max

**专为高强度知识工作者设计的文件生命周期管理系统**

[![Release](https://img.shields.io/github/v/release/TimeTravelCoder/LedgerProMax?style=flat-square&color=gold&label=最新版本)](https://github.com/TimeTravelCoder/LedgerProMax/releases/latest)
[![Platform](https://img.shields.io/badge/平台-Windows%2010%2F11-blue?style=flat-square&logo=windows)](https://github.com/TimeTravelCoder/LedgerProMax/releases/latest)
[![License](https://img.shields.io/badge/许可证-MIT-green?style=flat-square)](#license)
[![CI](https://img.shields.io/github/actions/workflow/status/TimeTravelCoder/LedgerProMax/ci.yml?branch=ProMax&style=flat-square&label=CI)](https://github.com/TimeTravelCoder/LedgerProMax/actions/workflows/ci.yml)
[![Build](https://img.shields.io/github/actions/workflow/status/TimeTravelCoder/LedgerProMax/build.yml?style=flat-square&label=发布构建)](https://github.com/TimeTravelCoder/LedgerProMax/actions/workflows/build.yml)

[📦 下载安装](#installation) · [✨ 功能介绍](#features) · [🛠️ 开发指南](#development) · [🤖 AI 更新](#ai-updates) · [📋 文档索引](#documentation)

</div>

---

## 📖 产品简介

Ledger Pro Max 是一款基于 **Tauri v2 + Rust + React** 构建的本地桌面应用，将文件**自动收集 → AI 智能归档 → 多维检索 → 查重清理 → 3-2-1 备份**整合为一个连贯的工作流。

它不是云盘，不是网盘，是运行在你电脑上的**本地文件指挥台**，所有数据完全私有。

---

<a id="installation"></a>

## 📦 快速安装

### 方式一：下载安装包（推荐）

前往 [Releases 页面](https://github.com/TimeTravelCoder/LedgerProMax/releases/latest) 下载：

| 文件 | 说明 |
|------|------|
| `*_x64-setup.exe` | **推荐** · NSIS 安装向导 |
| `*_x64_zh-CN.msi` | WiX MSI 安装程序 |

### 方式二：自动更新

已安装旧版本？启动软件后约 **3 秒开始检查新版本**，弹出提示后一键升级，无需手动下载。

---

<a id="features"></a>

## ✨ 核心功能

### 🧠 数据看板（Dashboard）
实时全景指挥台：
- **信号网格** — 收集箱待处理数、AI 归档覆盖率、3-2-1 备份评分、文件总量
- **标签热度分布** — 可交互横向条形图，点击直接跳转筛选
- **整理趋势图** — 近 7 天 SVG 贝塞尔曲线，悬停查看每日数据
- **桌面健康度** — 监控桌面文件数，超标实时预警

### 📥 智能收集箱（Inbox）
文件进入系统的第一道门：
- **拖拽导入** — 从外部直接拖拽文件落入收集箱
- **目录监控** — 监听下载目录，新文件自动弹窗通知，一键导入
- **桌面一键清理** — 扫描并批量迁移桌面文件
- **AI 标签推荐** — 基于文件名语义分析，自动推荐最匹配的标签
- **智能规则匹配** — 按扩展名 + 关键词自动建议归档目录
- **命名模板** — 支持 `{date}_{topic}_{version}_{status}` 等变量替换

### 📂 分类工作空间（Workspace）
提供中文/英文以及完整/精简/基础工作区预设。默认中文完整预设包含以下 12 个目录：

| 目录 | 用途 |
|------|------|
| `00收集箱` | 待整理文件临时存放 |
| `01课程学习` | 课件、讲义、课程笔记 |
| `02课题研究` | 研究资料、实验数据 |
| `03项目管理` | 项目文档、源码仓库 |
| `04代码仓库` | 脚本、代码片段 |
| `05学术论文` | 论文 PDF、参考文献 |
| `06知识笔记` | 个人知识库、读书笔记 |
| `07常用资源` | 素材、模板、工具 |
| `08演示汇报` | PPT、演讲稿 |
| `09个人简历` | 简历、证书扫描件 |
| `10归档区` | 已完成项目 ZIP 保险箱 |
| `99临时缓冲` | 临时文件中转 |

**工作空间核心能力：**
- 拼音首字母搜索（输入 `bg` 匹配 `报告.pdf`）
- 多维筛选（分类 × 标签 × 状态 × 扩展名）
- 列表 / 网格双视图
- 内嵌文件预览（UTF-8 / GBK 自动编码检测）
- 元数据编辑（标签、描述、重命名）
- ZIP 多文件归档打包 + 完整性校验

### 🛡️ 3-2-1 备份管家（Backup）
遵循国际通行备份规范：
- **3** 份数据副本（原件 + 本地备份 + 异地备份）
- **2** 种存储介质（内置磁盘 + 外置硬盘/云盘）
- **1** 份异地存储（OneDrive / NAS 同步目录）

功能亮点：
- 增量备份（仅复制有变化的文件）
- SHA-256 哈希完整性校验
- 备份历史完整记录（时间、文件数、字节数、状态）
- 介质在线检测

备份会对所有文件副本执行 SHA-256 校验；大小和修改时间相同但内容损坏的副本也会重新复制。目标目录同时保存 `.docman.db` 的 SQLite 一致性快照，以保留标签、备注和快照生成前的备份历史。

恢复时先退出应用，将备份目录内的业务文件和隐藏文件 `.docman.db` 一并复制到一个新的空工作区，再启动应用并选择该目录。不要覆盖正在使用的工作区数据库。仅复制业务文件无法恢复标签和备注。ZIP 归档遇到同名压缩包会停止，请更换名称后重试；已有压缩包和待归档原件均保留。

### 🔍 智能查重（Duplicate Finder）
三种精度模式：
- **文件名查重** — 忽略大小写匹配
- **文件大小查重** — 按体积分组
- **SHA-256 精确查重** — 按文件内容哈希识别重复

### ⚙️ 控制面板（Settings）
- 路径管理（工作区 / 监控目录 / 磁盘备份 / 云备份）
- 三级标签体系（主标签 / 副标签 / 状态标签）
- 自动分类规则（关键词 + 扩展名 → 目标目录 + 规则实时测试）
- 命名模板自定义
- 双主题切换（赛博暗黑 / 极简明亮）

---

## 🏗️ 技术架构

```
用户操作 → React UI → invoke() → Tauri IPC → Rust 命令 → 文件系统/SQLite
                                                         ↓
                                             Event 推送 → React UI 更新
```

| 层级 | 技术选型 |
|------|---------|
| 桌面框架 | [Tauri v2](https://v2.tauri.app/) · Rust 后端 |
| 前端 | React 19 · TypeScript · Vite 8 |
| UI 图标 | Lucide React |
| 数据库 | SQLite (rusqlite, bundled) |
| 文件监控 | notify (Rust) |
| 压缩归档 | zip (Rust, deflate-miniz) |
| 编码处理 | encoding_rs（GBK/UTF-8 自动检测）|
| 哈希校验 | SHA-256 (sha2) |
| 时间处理 | chrono |
| Windows 集成 | winreg（注册表读取桌面路径）|

---

## 🗂️ 项目结构

```
LedgerProMax/
├── src/                            # 前端 React 源码
│   ├── App.tsx                     # 主入口 · 全局状态 · 事件路由
│   ├── index.css                   # 全局样式 · CSS 变量 · 主题系统
│   ├── components/
│   │   ├── pages/                  # 各功能页面（模块化架构）
│   │   │   ├── DashboardPage.tsx   # 数据看板
│   │   │   ├── InboxPage.tsx       # 智能收集箱
│   │   │   ├── WorkspacePage.tsx   # 分类工作空间
│   │   │   ├── BackupPage.tsx      # 3-2-1 备份管理
│   │   │   ├── SettingsPage.tsx    # 控制面板
│   │   │   └── AboutPage.tsx       # 关于 & 自动更新
│   │   ├── DuplicateFinder.tsx     # 智能查重
│   │   ├── PreviewPanel.tsx        # 文件预览面板
│   │   └── ZipArchiveModal.tsx     # ZIP 归档弹窗
│   ├── types/index.ts              # 全局 TypeScript 类型
│   └── utils/fileUtils.tsx         # 工具函数 · 文件图标
│
├── src-tauri/                      # Rust 后端
│   ├── src/
│   │   ├── lib.rs                  # Tauri 命令注册 & 入口
│   │   ├── db.rs                   # SQLite 数据库
│   │   ├── file_manager.rs         # 文件操作 & 工作区管理
│   │   ├── backup.rs               # 3-2-1 备份引擎
│   │   ├── watcher.rs              # 文件系统监控
│   │   ├── config_manager.rs       # 配置持久化
│   │   └── semantic.rs             # 语义标签推荐
│   ├── tauri.conf.json             # Tauri 配置 & 更新器
│   └── Cargo.toml                  # Rust 依赖
│
├── .github/workflows/
│   ├── ci.yml                      # push / PR 质量检查
│   └── build.yml                   # 版本 Tag 触发 · Windows 发布
├── scripts/                       # 版本同步、发布产物校验与测试
├── AGENTS.md                      # AI 助手读取入口
├── AI更新操作指南.md               # AI 更新、验证与 GitHub 操作约定
├── README.md                       # 本文件
├── CHANGELOG.md                    # 版本更新日志
├── 开发流程教程.md                  # 完整开发流程
└── 发布操作手册.md                  # 发版操作指南
```

---

<a id="development"></a>

## 🛠️ 开发者指南

### 环境要求

| 工具 | 要求 |
|------|------|
| Node.js | 22.12+，推荐受支持的 LTS；CI 使用 Node.js 22 |
| Rust | stable，安装 Clippy 组件 |
| Windows 编译工具 | Visual Studio Build Tools 的 C++ 桌面工作负载及 Windows SDK |
| 桌面运行时 | Microsoft Edge WebView2 Runtime |
| 正式支持平台 | Windows 10/11 x64 |

GitHub CLI 用于 PR 与发布管理，普通开发不需要签名私钥。macOS/Linux 适配需独立验证，不能以浏览器页面能显示作为桌面功能通过的依据。

### 快速开始

```bash
git clone https://github.com/TimeTravelCoder/LedgerProMax.git
cd LedgerProMax
git switch ProMax
npm ci
npm run dev:desktop
```

已有项目检出直接使用。`npm run dev:desktop` 启动 Tauri 桌面窗口、Vite 热更新和 Rust 编译；只开发页面布局时可用 `npm run dev`，普通浏览器没有 Tauri IPC，文件操作、备份和自动更新需要在桌面环境验证。

### 常用命令

所有命令在仓库根目录执行，安装 Rust 工具链后运行 `rustup component add clippy`。

| 命令 | 用途 |
|------|------|
| `npm ci` | 按锁文件安装前端依赖 |
| `npm run dev:desktop` | 启动完整桌面开发环境 |
| `npm run dev` | 启动前端开发服务器 |
| `npm run typecheck` | 检查 TypeScript 项目引用 |
| `npm run build` | TypeScript 检查与前端生产构建 |
| `npm run lint` | 前端静态检查 |
| `npm run version:check` | 核对应用版本、清单与锁文件一致性 |
| `npm run test:workflow` | 测试版本同步和发布产物校验工具 |
| `cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings` | Rust 静态检查 |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | 运行已有 Rust 测试 |

根 TypeScript 配置采用项目引用，不用 `npx tsc --noEmit` 替代全项目检查。具体开发与验收要求见 [开发流程教程](开发流程教程.md)。

### 分支与日常更新

`ProMax` 是长期主线。每个独立任务从最新主线创建短期分支，已有任务分支继续使用：

```bash
git switch ProMax
git pull --ff-only origin ProMax
git switch -c fix/backup-error
```

工作区须先保持干净或妥善保留已有修改。完成修改、验证和提交后推送任务分支，创建面向 `ProMax` 的 PR；最新 CI 通过并满足审阅要求后合并，再清理已完成任务分支。

| 分支类型 | 用途 |
|----------|------|
| `ProMax` | 长期主线与正式版本基线 |
| `feature/*` | 独立功能开发，完成后合并 |
| `fix/*` | 问题修复，完成后合并 |
| `docs/*` | 文档更新，完成后合并 |
| `codex/*` | AI 协助的任务分支，完成后合并 |
| `Win_Fix` | 历史改动迁移参考，不作为新任务起点 |

旧 `MAC` 和 `MAC_Fix` 分支已归档为 `archive/mac-2026-10-14` 和 `archive/mac-fix-2026-10-14` 标签。历史分支有用的改动应逐项迁移，不能因为较旧就丢弃。

### CI 与版本发布

- `ci.yml`：对 `ProMax` / `main` 的 push 和 PR 执行版本检查、发布工具测试、lint、前端构建、Clippy 与 Rust 测试。
- `build.yml`：由 `vX.Y.Z` 标签触发 Windows NSIS/MSI 构建、更新签名和 Release 发布；手动运行也必须选择版本标签，拒绝覆盖已有 Release。

日常合并代码不等于发布新版本。准备发布时先同步版本、更新 CHANGELOG，完成验证和版本 PR。下面的版本号仅作示例：

```bash
npm run version:sync -- 3.2.4
npm run version:check -- --tag v3.2.4
```

版本工具同步清单与锁文件的应用版本，关于页自动读取 `package.json`。标签、签名、Release 附件与旧版本升级验收统一按 [发布操作手册](发布操作手册.md) 执行。构建成功不能代替 Windows 安装与升级测试。

---

<a id="ai-updates"></a>

## 🤖 使用 AI 协助更新

助手先读取 [AGENTS.md](AGENTS.md) 和 [AI更新操作指南](AI更新操作指南.md)，再按任务读取开发与发布文档。指南规定分支选择、验证、提交、PR、合并和发布步骤，并要求分别报告实际完成状态。

可以直接使用以下请求：

> 先读取 AGENTS.md 和 AI更新操作指南.md，帮我修复【具体问题】，完成相关验证。

需要同步 GitHub 和创建 PR 时：

> 按 AI更新操作指南.md 更新【具体内容】，验证后提交并推送任务分支，创建面向 ProMax 的 PR，先不要合并。

需要合并或发布时明确说明目标 PR 或版本。保存云环境配置、推送代码、合并主线和发布应用是不同操作，分别确认结果。更多请求模板见 [AI更新操作指南](AI更新操作指南.md#10-用户可直接复用的请求)。

---

## 🔒 安全设计

- **工作区沙箱** — 所有文件操作限制在 workspace 内，路径穿越自动拦截
- **删除保护** — 禁止删除根目录，空路径 / `.` / `..` 自动拒绝
- **备份防循环** — 检测目标是否位于工作区内，防无限递归
- **哈希完整性** — SHA-256 备份校验，确保数据一致
- **目录深度限制** — 最大 4 级，防结构失控
- **本地优先** — 所有数据存储在本地，不上传任何文件到云端

---

<a id="documentation"></a>

## 📋 文档索引

| 文档 | 内容 |
|------|------|
| [AGENTS.md](AGENTS.md) | AI 助手进入仓库时的读取入口 |
| [AI更新操作指南.md](AI更新操作指南.md) | 后续让 AI 更新、验证、推送、合并与发布的操作约定 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新历史 |
| [用户使用手册.md](用户使用手册.md) | 软件操作指南（面向普通用户）|
| [开发流程教程.md](开发流程教程.md) | 完整开发工作流（面向开发者）|
| [发布操作手册.md](发布操作手册.md) | 版本发布操作步骤 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |

---

<a id="license"></a>

## 📄 License

项目声明使用 MIT 许可证，© 2026 [TimeTravelCoder](https://github.com/TimeTravelCoder)。当前仓库尚缺独立 LICENSE 文件，需由维护者确认版权信息后补充。
