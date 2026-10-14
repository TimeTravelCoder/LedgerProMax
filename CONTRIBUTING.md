# 贡献指南

主开发分支为 `ProMax`，当前发布目标为 Windows。架构和首次上手见 [README](README.md)，具体步骤见 [开发流程教程](开发流程教程.md)，发布由 [发布操作手册](发布操作手册.md) 管理。

## 开发与提交

1. 从最新 `ProMax` 创建 `feature/...`、`fix/...` 或 `docs/...` 分支。
2. 使用 `npm ci` 安装依赖；桌面开发用 `npm run dev:desktop`。`npm run dev` 仅适合前端页面开发。
3. 为涉及文件操作、数据库、备份等行为的修改补充有意义的测试，使用临时数据验证。
4. 运行下面的检查，审阅差异后提交相关文件，创建面向 `ProMax` 的 PR。

```powershell
npm run version:check
npm run test:workflow
npm run lint
npm run build
cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

只检查 TypeScript 时用 `npm run typecheck`。检查必须逐条成功，不能以最后一条命令成功代替全部成功。功能修改还需在 Windows Tauri 桌面窗口验收相关行为。

PR 描述包含修改原因、最终行为和验证结果；CI 成功并完成审阅后合并。签名私钥只用于发布，贡献者无需持有或上传。依赖变更提交锁文件，普通开发不要删除锁文件。

版本修改使用 `npm run version:sync -- X.Y.Z`，关于页版本自动读取，不需要手工改文本。

## 提交规范

使用 `feat: ...`、`fix: ...`、`docs: ...`、`refactor: ...`、`test: ...`、`chore: ...` 或 `ci: ...`，描述具体变化。

## 问题反馈

提供应用版本、操作系统、复现步骤、预期与实际行为，必要时附经脱敏的日志或截图。不要上传私钥、个人资料或真实备份文件。

## 许可证

项目 README 声明 MIT；当前仓库尚缺少 LICENSE 文件，应由维护者确认版权信息后补充。
