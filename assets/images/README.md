# 图标文件说明

## 应用图标

为了让Electron应用能够正常构建，您需要添加以下图标文件：

### Windows 图标
- `icon.ico` - Windows 应用图标

### macOS 图标
- `icon.icns` - macOS 应用图标

### Linux 图标
- 可以使用 PNG 格式的图标，放在此目录中

## 推荐尺寸

- Windows `.ico` 文件：至少包含 16x16, 32x32, 48x48, 64x64, 128x128, 256x256 像素的图标
- macOS `.icns` 文件：按照 Apple 的图标规范创建
- Linux 图标：至少提供 512x512 像素的 PNG 图标

## 如何创建图标

1. **在线工具**：使用在线图标转换工具将 PNG 转换为 ICO 和 ICNS 格式
2. **专业软件**：使用 Adobe Illustrator, Sketch 等软件创建图标
3. **开源工具**：使用 GIMP, Inkscape 等开源软件创建图标

## 注意事项

- 图标文件必须放在此目录中，并且文件名必须与 `package.json` 中配置的一致
- 图标应该清晰、简洁，能够代表花生网文平台的品牌形象
- 建议使用与平台 LOGO 一致的设计风格
