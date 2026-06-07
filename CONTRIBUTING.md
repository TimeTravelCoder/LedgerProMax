# 🤝 贡献指南 — Ledger Pro Max

感谢你对 Ledger Pro Max 的关注！本文档说明如何参与项目贡献。

---

## 📋 贡献方式

- 🐛 **提交 Bug 报告** — 发现问题请在 [Issues](https://github.com/TimeTravelCoder/LedgerProMax/issues) 提交
- 💡 **功能建议** — 有好想法欢迎开 Issue 讨论
- 🔧 **代码贡献** — Fork 仓库，开发完成后提交 Pull Request
- 📖 **文档完善** — 修正错误、补充说明

---

## 🚀 开发环境搭建

### 必需工具

```bash
# Windows
winget install OpenJS.NodeJS.LTS       # Node.js 22+
winget install Rustlang.Rustup         # Rust stable
winget install GitHub.cli              # GitHub CLI
winget install Microsoft.VisualStudio.2022.BuildTools  # C++ 编译工具链

# 安装完成后
rustup default stable
```

### 克隆并启动

```bash
git clone https://github.com/TimeTravelCoder/LedgerProMax.git
cd LedgerProMax
git checkout ProMax
npm install
npm run dev    # 启动开发模式
```

---

## 🌿 分支规范

| 分支 | 用途 |
|------|------|
| `ProMax` | 主分支，只接受稳定代码 |
| `feature/xxx` | 新功能开发 |
| `fix/xxx` | Bug 修复 |

**操作流程：**

```bash
# 1. 从 ProMax 创建功能分支
git checkout -b feature/我的新功能 ProMax

# 2. 开发并提交
git add -A
git commit -m "feat: 添加XXX功能"

# 3. 推送并提交 PR
git push origin feature/我的新功能
# 然后在 GitHub 上提交 Pull Request 到 ProMax
```

---

## 📝 Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
类型: 简短描述（不超过 50 字）

可选的详细说明（换行后写）
```

| 类型 | 场景 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（不改变功能）|
| `style` | 格式调整 |
| `docs` | 文档更新 |
| `chore` | 构建 / 工具 / 依赖 |
| `ci` | CI/CD 配置 |
| `perf` | 性能优化 |

---

## ✅ 提交 PR 前检查清单

```
[ ] TypeScript 零错误：npx tsc --noEmit
[ ] 功能在开发模式下测试通过
[ ] 新功能已更新对应文档
[ ] Commit 信息遵循规范
[ ] 未包含敏感信息（密钥、密码等）
```

---

## 🐛 提交 Bug 报告

请包含以下信息：

1. **软件版本**（关于页面查看）
2. **操作系统**（Windows 10 / Windows 11）
3. **复现步骤**（具体操作顺序）
4. **期望行为** vs **实际行为**
5. **截图或录屏**（如有）

---

## 📄 License

贡献的代码将以 MIT 许可证发布。
