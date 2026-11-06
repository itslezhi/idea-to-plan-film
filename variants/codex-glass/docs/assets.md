# macOS 与 Codex 原生图标素材

这版样片使用本机已安装应用中的真实图标，未使用生成式图像或手绘图标替代。原始 `.icns` 为只读来源；输出为 512×512 PNG。图标以贴图形式出现在 macOS 产品界面参考场景中。

## 素材清单

| 输出文件 | 应用 | 本机原始来源 |
|---|---|---|
| [finder.png](../assets/icons/finder.png) | Finder | `/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns` |
| [messages.png](../assets/icons/messages.png) | Messages | `/System/Applications/Messages.app/Contents/Resources/AppIcon.icns` |
| [photos.png](../assets/icons/photos.png) | Photos | `/System/Applications/Photos.app/Contents/Resources/AppIcon.icns` |
| [terminal.png](../assets/icons/terminal.png) | Terminal | `/System/Applications/Utilities/Terminal.app/Contents/Resources/Terminal.icns` |
| [notes.png](../assets/icons/notes.png) | Notes | `/System/Applications/Notes.app/Contents/Resources/AppIcon.icns` |
| [safari.png](../assets/icons/safari.png) | Safari | `/Applications/Safari.app/Contents/Resources/AppIcon.icns` |
| [music.png](../assets/icons/music.png) | Music | `/System/Applications/Music.app/Contents/Resources/AppIcon.icns` |
| [system-settings.png](../assets/icons/system-settings.png) | System Settings | `/System/Applications/System Settings.app/Contents/Resources/SystemSettings.icns` |
| [codex.png](../assets/icons/codex.png) | Codex | `/Applications/ChatGPT.app/Contents/Resources/app.icns` |

所有输出的来源、像素尺寸、文件大小与 SHA-256 记录在 [sources.json](../assets/icons/sources.json)。统一预览见 [icons-preview.jpg](../assets/icons/icons-preview.jpg)。

## Codex 轮廓数据

[codex-outline.json](../assets/icons/codex-outline.json) 为从 `codex.png` 蓝色云形外边界提取的 256 个 `[x,y]` 点，按数学坐标逆时针排列，可用于 three.js `Shape`/`ExtrudeGeometry`。数据是直接的点数组，不包含额外对象包装。

轮廓以原图完整 512×512 画布的 `(256,256)` 为原点，使用 `x = pixelX / 512 - 0.5`、`y = 0.5 - pixelY / 512`，没有裁切、重新居中或按物体包围盒缩放。平面贴图 UV 可对应 `u = x + 0.5`、`v = y + 0.5`。

提取方法为：蓝色像素饱和度大于 0.16、色差大于 0.10、蓝通道高于红通道 0.025；从图心沿 256 个角度以 0.2px 步进寻找每条射线最远的有效蓝色像素，从而忽略白色 `>_` 镂空；再对每个半径的前后各 3 个邻居做均值平滑，减少栅格锯齿。此阈值排除外围浅色辉光。轮廓数据仍属于对原始品牌图形的派生描述，不纳入项目 MIT 授权。

## Codex 图标的识别

本机安装的宿主应用显示名为 `ChatGPT.app`，其 `Info.plist` 中 `CFBundleIdentifier` 为 `com.openai.codex`。资源中存在三种图标：

- `app.icns`：蓝紫色云形轮廓、白色 `>_` 符号；本项目选择它作为 Codex 图标。
- `electron.icns`：ChatGPT 结形标志，是当前应用注册图标。
- `icon-chatgpt.icns`：ChatGPT 结形标志。

本项目没有将后两者误称为 Codex 图标。`app.icns` 原始图像自带不透明白色画布，输出保留原样；使用时可将其放在白色或浅色图标牌上。其他八款图标输出均保留原始透明度。

## 抽取方法

使用 macOS 自带的 `sips` 从原生图标资源解码并缩放，命令形式为：

```sh
/usr/bin/sips -s format png -z 512 512 "/path/to/AppIcon.icns" --out "/path/to/icon.png"
```

此过程不修改系统或应用包，不读取用户账号、凭据、聊天或浏览器数据。无需额外安装图标库。

## 权利与项目许可证

- Finder、Messages、Photos、Terminal、Notes、Safari、Music、System Settings 的名称和图标属于 Apple Inc. 或相应权利人。
- Codex、OpenAI 名称及相应图标属于 OpenAI 或相应权利人。
- 这些图标作为被展示产品的视觉参考单独列明，**不属于本项目原创素材，不纳入本项目 MIT 授权**。抽取过程不会产生对这些图标的独立授权。
- 本项目的 MIT 许可证适用于原创代码、原创动画编排和明确标为原创的声音等内容；依赖与品牌素材仍受各自条款约束。
- 本项目不暗示 Apple 或 OpenAI 对该视频背书、赞助或参与制作。
