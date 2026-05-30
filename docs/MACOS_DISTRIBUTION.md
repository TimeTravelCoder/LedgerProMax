# macOS 分发指南 — Ledger Pro Max

## 前置条件

- **Apple Developer 账号**（$99/年）——仅用于分发到 App Store 之外
- **Xcode Command Line Tools**：`xcode-select --install`
- **App 专用密码**（用于公证）：从 [appleid.apple.com](https://appleid.apple.com) 生成

## 1. 构建 DMG

### 单架构构建

```bash
# Apple Silicon (M1/M2/M3)
npm run tauri build -- --target aarch64-apple-darwin

# Intel Mac
npm run tauri build -- --target x86_64-apple-darwin
```

### Universal Binary（推荐——同时支持 Intel 和 Apple Silicon）

```bash
npm run tauri build -- --target universal-apple-darwin
```

DMG 输出至：`src-tauri/target/universal-apple-darwin/release/bundle/dmg/`

## 2. 代码签名

编辑 `src-tauri/tauri.conf.json`：

```json
"macOS": {
  "minimumSystemVersion": "12.0",
  "signingIdentity": "Apple Development: Your Name (TEAMID)",
  "dmg": { ... }
}
```

**签名身份类型：**
| 环境 | 身份 |
|------|------|
| 本地开发测试 | `null`（无签名，或使用 `-` 进行 ad-hoc 签名）|
| 开发分发 | `Apple Development: Your Name (TEAMID)` |
| App Store 分发 | `Apple Distribution: Your Name (TEAMID)` |
| Developer ID（App Store 外分发）| `Developer ID Application: Your Name (TEAMID)` |

### 验证签名

```bash
codesign -dvvv "src-tauri/target/universal-apple-darwin/release/bundle/macos/Ledger Pro Max.app"
```

## 3. 公证（Gatekeeper）

对于 App Store 外的分发，需进行公证。

### 3.1 存储 App 专用密码到钥匙串

```bash
xcrun notarytool store-credentials "NOTARY_PROFILE"
  --apple-id "your@email.com"
  --team-id "TEAMID"
  --password "app-specific-password"
```

### 3.2 提交公证

```bash
xcrun notarytool submit "src-tauri/target/universal-apple-darwin/release/bundle/dmg/Ledger Pro Max_1.0.0_universal.dmg"
  --keychain-profile "NOTARY_PROFILE"
  --wait
```

### 3.3 装订票据到 DMG

```bash
xcrun stapler staple "src-tauri/target/universal-apple-darwin/release/bundle/dmg/Ledger Pro Max_1.0.0_universal.dmg"
```

### 3.4 验证公证

```bash
spctl -a -vvv -t install "src-tauri/target/universal-apple-darwin/release/bundle/dmg/Ledger Pro Max_1.0.0_universal.dmg"
```

## 4. Hardened Runtime 权利配置

如需启用 Hardened Runtime（公证所必需），创建 `src-tauri/entitlements.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

## 5. 信息属性列表（Info.plist）自定义

Tauri 会自动生成 Info.plist。如需自定义，添加至 `src-tauri/Info.plist`。

## 6. macOS 特定注意事项

### 文件系统
- **APFS**（默认）：不区分大小写，但保留大小写。支持 `:` 作为文件名的一部分（与 HFS+ 不同）。
- **资源分支**：macOS 会生成 `._` 前缀文件。应用会自动将其从扫描结果中过滤。
- **系统文件**：`.DS_Store` 和 `.localized` 也会被过滤。

### 应用行为
- **窗口关闭**：默认情况下，关闭最后一个窗口后应用退出。若需匹配 macOS 惯例（应用保持运行），可在 Tauri 配置中进行调整。
- **流量灯按钮**：标题栏使用原生流量灯按钮（关闭/最小化/全屏）。

### 目录路径
| 目的 | 路径 |
|------|------|
| 配置 | `~/Library/Application Support/Ledger/` |
| 默认工作空间 | `~/Library/Application Support/Ledger/Workspace/` |
| 桌面 | `~/Desktop/` |
| 下载 | `~/Downloads/` |

### 已知局限性
- **FSEvents 延迟**：文件系统监控存在 1-3 秒的固有延迟。这是 macOS 的正常行为，非应用缺陷。
- **备份目标路径**：macOS 上外部驱动器挂载于 `/Volumes/`。应用通过路径判断连接状态，而非盘符（Windows 概念）。
