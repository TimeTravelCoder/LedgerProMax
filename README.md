<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="96" alt="Ledger Pro Max Logo"/>

# 👑 Ledger Pro Max

**专为高强度知识工作者设计的文件生命周期管理系统**

[![Release](https://img.shields.io/github/v/release/TimeTravelCoder/LedgerProMax?style=flat-square&color=gold&label=最新版本)](https://github.com/TimeTravelCoder/LedgerProMax/releases/latest)
[![Platform](https://img.shields.io/badge/平台-Windows%2010%2F11-blue?style=flat-square&logo=windows)](https://github.com/TimeTravelCoder/LedgerProMax/releases/latest)
[![License](https://img.shields.io/badge/许可证-MIT-green?style=flat-square)](LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/TimeTravelCoder/LedgerProMax/build.yml?style=flat-square&label=自动构建)](https://github.com/TimeTravelCoder/LedgerProMax/actions)

[📦 下载安装](#-快速安装) · [✨ 功能介绍](#-核心功能) · [🛠️ 开发指南](#️-开发者指南) · [📋 更新日志](CHANGELOG.md)

</div>

---

## 📖 产品简介

Ledger Pro Max 是一款基于 **Tauri v2 + Rust + React** 构建的本地桌面应用，将文件**自动收集 → AI 智能归档 → 多维检索 → 查重清理 → 3-2-1 备份**整合为一个连贯的工作流。

它不是云盘，不是网盘，是运行在你电脑上的**本地文件指挥台**，所有数据完全私有。

---

## 📦 快速安装

### 方式一：下载安装包（推荐）

前往 [Releases 页面](https://github.com/TimeTravelCoder/LedgerProMax/releases/latest) 下载：

| 文件 | 说明 |
|------|------|
| `*_x64-setup.exe` | **推荐** · NSIS 安装向导 |
| `*_x64_zh-CN.msi` | WiX MSI 安装程序 |

### 方式二：自动更新

已安装旧版本？启动软件后 **3 秒内自动检测新版本**，弹出提示后一键升级，无需手动下载。

---

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
预置 12 个标准目录，覆盖全场景：

| 目录 | 用途 |
|------|------|
| `00_收集箱` | 待整理文件临时存放 |
| `01_课程学习` | 课件、讲义、课程笔记 |
| `02_课题研究` | 研究资料、实验数据 |
| `03_项目管理` | 项目文档、源码仓库 |
| `04_代码仓库` | 脚本、代码片段 |
| `05_学术论文` | 论文 PDF、参考文献 |
| `06_知识笔记` | 个人知识库、读书笔记 |
| `07_常用资源` | 素材、模板、工具 |
| `08_演示汇报` | PPT、演讲稿 |
| `09_个人简历` | 简历、证书扫描件 |
| `10_归档区` | 已完成项目 ZIP 保险箱 |
| `99_临时缓冲` | 临时文件中转 |

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

### 🔍 智能查重（Duplicate Finder）
三种精度模式：
- **文件名查重** — 忽略大小写匹配
- **文件大小查重** — 按体积分组
- **SHA-256 精确查重** — 内容级别去重，零误报

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
├── .github/workflows/build.yml     # CI/CD · Tag 触发 · 自动发布
├── README.md                       # 本文件
├── CHANGELOG.md                    # 版本更新日志
├── 开发流程教程.md                  # 完整开发流程
└── 发布操作手册.md                  # 发版操作指南
```

---

## 🛠️ 开发者指南

### 环境要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | >= 22 |
| Rust | >= 1.80 (stable) |
| 操作系统 | Windows 10/11 |

### 快速开始

```bash
# 克隆项目
git clone https://github.com/TimeTravelCoder/LedgerProMax.git
cd LedgerProMax
git checkout ProMax

# 安装依赖
npm install

# 启动开发模式（前端热更新 + Tauri 桌面窗口）
npm run dev
```

### 分支说明

| 分支 | 定位 |
|------|------|
| `ProMax` | 主分支 · Windows 正式发布 |
| `MAC` | macOS 平台适配 |
| `MAC_Fix` | macOS 修复 |
| `Win_Fix` | Windows 修复迭代 |

### 发版流程

详见 [发布操作手册.md](发布操作手册.md)，核心是：

```bash
# 修改四处版本号后：
git tag v3.x.x
git push origin v3.x.x   # 触发 GitHub Actions 自动编译发布
```

---

## 🔒 安全设计

- **工作区沙箱** — 所有文件操作限制在 workspace 内，路径穿越自动拦截
- **删除保护** — 禁止删除根目录，空路径 / `.` / `..` 自动拒绝
- **备份防循环** — 检测目标是否位于工作区内，防无限递归
- **哈希完整性** — SHA-256 备份校验，确保数据一致
- **目录深度限制** — 最大 4 级，防结构失控
- **本地优先** — 所有数据存储在本地，不上传任何文件到云端

---

## 📋 文档索引

| 文档 | 内容 |
|------|------|
| [CHANGELOG.md](CHANGELOG.md) | 版本更新历史 |
| [用户使用手册.md](用户使用手册.md) | 软件操作指南（面向普通用户）|
| [开发流程教程.md](开发流程教程.md) | 完整开发工作流（面向开发者）|
| [发布操作手册.md](发布操作手册.md) | 版本发布操作步骤 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |

---

## 📄 License

MIT © 2026 [TimeTravelCoder](https://github.com/TimeTravelCoder)
