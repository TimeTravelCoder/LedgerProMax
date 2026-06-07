# 📋 更新日志 — Ledger Pro Max

所有重要版本变更均记录于此，遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

---

## [v3.2.0] — 2026-06-07

### 🛡️ 安全性与稳定性加固 (DeepSeek 代码审查修复)

- **数据库连接池缓存** — 使用 `lazy_static` 缓存 `rusqlite::Connection`，并实现支持 Deref/DerefMut 的 `CachedConnection`，提升 SQLite 读写吞吐并消除文件连接锁冲突。
- **防止 SQL 注入** — 重构数据库更新接口 `mark_as_backed_up`，移除动态字符串拼接，全部改用预处理静态 SQL 参数化绑定。
- **文件归档安全逃脱锁** — 针对重命名自增循环设定 `counter > 10000` 保护，彻底规避极端环境下死循环导致线程锁死及 CPU 跑满。
- **灾备配置备份** — 反序列化损坏的 `.config.json` 时，自动备份损坏版本为 `.config.json.bak` 再回退默认配置，保护用户历史数据。
- **深度递归监控** — 升级多目录文件监控器为 `Recursive` 深度递归监视，完美感知监控目录下深层子文件夹的文件落地。
- **前端去硬编码与前置校验** — 彻底清除 React 状态中默认的 `Ming` 用户硬编码路径，改为后端在启动时动态加载系统主目录；保存配置前对输入路径增加绝对路径合法性校验与空值提示拦截器。
- **GitHub 自动化 CI** — 新建 `.github/workflows/ci.yml`，在 push 或 PR 时对前端 Linter、TypeScript 类型、Rust 单元测试及 Clippy 规范自动运行。

---

## [v3.1.1] — 2026-06-07

### 🎨 界面优化与更新修复

- **合并冗余板块** — 将“关于”合并至控制面板设置子页，将“智能查重”内化合并至工作空间顶部选项卡，侧边栏精简为 5 大主板块。
- **界面比例拓宽** — 移除设置页与关于页最大宽度限制，将路径配置网格调整为跨列满幅，视觉更加舒展开阔。
- **修复更新器 404 故障** — 修复 GitHub/CI 在上传含有空格的安装包名称时会被替换为点号导致本地检测到更新但下载报 404 的问题。
- **重置过滤逻辑优化** — 修复清空工作空间多维过滤时错误重置左侧所选目录节点的 Bug。

---

## [v3.0.0] — 2026-06-07

### 🏗️ 架构重构

- **模块化页面架构** — 将原 4000+ 行单文件 `App.tsx` 拆分为 6 个独立页面组件：
  - `DashboardPage.tsx` · `InboxPage.tsx` · `WorkspacePage.tsx`
  - `BackupPage.tsx` · `SettingsPage.tsx` · `AboutPage.tsx`
- 新增 `src/types/index.ts` 统一类型定义
- 新增 `src/utils/fileUtils.tsx` 工具函数模块

### 🔄 CI/CD 完整构建

- **Tag 触发发布** — 仅在推送版本标签（`v*.*.*`）时触发构建，普通 push 不编译
- **自动签名** — GitHub Actions 自动使用私钥对安装包签名，生成 `.sig` 文件
- **自动更新端点** — 每次发布自动生成 `updater.json`，本地 app 启动时自动检测更新
- **双格式安装包** — 同时生成 MSI（WiX）和 EXE（NSIS）
- 更换签名密钥对为无密码版本，解决 CI 自动化兼容问题

### 📄 文档建设

- 新增《开发流程教程》全流程开发文档
- 新增《发布操作手册》发版指南

---

## [v2.2.1] — 2026-06-04

### 🐛 Bug 修复

- **收集箱** — 修复收集箱名称与所选初始目录模板规格动态绑定问题，解决特定模板下无法正常收集的 Bug
- **自动更新** — 修复 updater 端点 URL 格式问题，签名文件正确关联

### ⚙️ 构建配置

- 启用 `createUpdaterArtifacts` 自动生成签名产物
- CI 配置更新，支持签名密钥注入

---

## [v2.2.0] — 2026-06-04

### ✨ 新功能

- **收集箱** — 一键收集支持跨卷移动（修复 NTFS 跨盘符移动失败问题）
- **收集箱** — 静默失败改为 Toast 通知，所有操作结果可见
- **收集箱** — 防重复点击保护，避免批量操作时多次触发

### 🐛 Bug 修复

- 全板块静默失败修复 — 所有后台错误现均有前端反馈
- 按钮防护 — 关键操作期间禁用按钮，防止并发冲突
- 修复工作空间搜索全表扫描性能问题

---

## [v2.1.0] — 2026-06

### ✨ 新功能

- **自动更新器** — 集成 Tauri updater 插件，支持静默自动更新
- **CI 签名构建** — GitHub Actions 自动签名 MSI/EXE

---

## [v2.0.0] — 2026-06

### 🏗️ 重构

- 控制面板重构为子页面选项卡架构（路径 / 标签 / 规则 三子页）
- 智能收集箱 UI 全面优化
- 工作空间详情面板重设计
- 智能查重面板 UI 优化

---

## [v1.2.0] — 2026-05

### ✨ 新功能

- **3-2-1 备份拓扑图** — 可视化展示三份副本的存储状态
- **备份对比 Diff** — 并排对比两个备份版本的文件差异
- **闪电归档** — 快速 ZIP 打包并移至归档区
- **备份完整性校验** — SHA-256 验证所有备份文件

---

## [v1.1.0] — 2026-05

### ✨ 新功能

- 跨平台 GitHub Actions 工作流
- Windows / macOS 双平台支持

### 🐛 Bug 修复

- 修复 APFS / NTFS 上仅大小写变化的重命名失败问题

---

## [v1.0.0] — 2026-05

### 🎉 首个正式版本

- 智能收集箱（文件导入 / 规则匹配 / AI 标签）
- 分类工作空间（12 个标准目录 / 多维筛选 / 预览）
- 3-2-1 备份引擎（增量备份 / SHA-256 校验）
- 智能查重（文件名 / 大小 / 哈希三种模式）
- 控制面板（路径 / 标签 / 规则配置）
- SQLite 本地数据库
- 双主题（赛博暗黑 / 极简明亮）

---

[v3.2.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v3.2.0
[v3.1.1]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v3.1.1
[v3.0.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v3.0.0
[v2.2.1]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v2.2.1
[v2.2.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v2.2.0
[v2.1.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v2.1.0
[v2.0.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v2.0.0
[v1.2.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v1.2.0
[v1.1.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v1.1.0
[v1.0.0]: https://github.com/TimeTravelCoder/LedgerProMax/releases/tag/v1.0.0
