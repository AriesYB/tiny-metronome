# 节拍器 · Open Metronome

免费、开源、零依赖的在线节拍器，用 Web Audio API 独立实现，所有代码与音色均为原创，可离线使用。

A free, open-source, zero-dependency online metronome, independently implemented with the Web Audio API. Works offline.

## 功能 / Features

- **BPM 20–300**：数字输入、滑块、± 按钮（长按加速）、点击测速（Tap Tempo）
- **拍号**：分子 1–16，分母 2/4/8/16 自由组合（2/4、3/4、4/4、6/8、7/8、12/8……）
- **节奏分割**：四分 ♩ / 八分 ♪♪ / 三连音 ♪♪♪ / 十六分 ♬
- **逐拍重音**：点击节拍圆点即可开启/关闭任意一拍的重音
- **4 种合成音色**：响板 / 电子音 / 底鼓 / 边嚓（无音频文件，全部实时合成）
- **音量调节**、**定时停止**（1–30 分钟，练习好帮手）
- **摆锤视觉**：与音频采样时钟严格同步，砝码位置随速度变化（还原机械节拍器）
- **速度术语**：Grave 庄板 → Prestissimo 最急板 实时显示
- **中英双语界面**、**深色/浅色主题**（跟随系统）、设置自动保存
- 响应式布局，手机/平板/桌面均可使用；标签页切到后台依然保持精准

## 键盘快捷键 / Shortcuts

| 按键 | 功能 |
| --- | --- |
| `空格` | 播放 / 停止 |
| `↑` `↓`（或 `←` `→`） | BPM ±1 |
| `Shift + ↑/↓` | BPM ±5 |
| `T` | 点击测速 |

## 使用 / Usage

无需安装、无需构建。任选其一：

1. **直接打开**：双击 `index.html` 即可运行。
2. **本地服务**：`python -m http.server 8080`，然后访问 `http://localhost:8080`。
3. **部署**：把整个目录上传到任意静态托管（GitHub Pages / Vercel / Netlify / 对象存储），没有构建步骤。

> 注：部分浏览器要求用户先与页面交互才允许播放声音——点击播放按钮即可。

## 技术要点 / How it works

- 采用 Web Audio API 的 **lookahead 调度模式**（参考 *A Tale of Two Clocks*）：`setInterval` 每 25ms 醒来，按 **音频硬件时钟**（`AudioContext.currentTime`）提前约 0.12s 精确排定音符，因此节奏精度不受主线程卡顿影响。
- 标签页切到后台时定时器会被浏览器限流，引擎会自动加大 lookahead（约 1.6s）保证不断拍。
- 所有音色（响板/电子/底鼓/边嚓）用振荡器 + 噪声缓冲 + 包络实时合成，零采样、零外部资源。
- 摆锤角度 = `A·cos(π·beatFloat)`，`beatFloat` 由音频时钟连续推导，与声音严格同相。

## 目录结构 / Structure

```
├── index.html        # 页面结构
├── css/style.css     # 样式（浅色/深色主题）
├── js/metronome.js   # 音频引擎（调度器 + 合成音色）
├── js/app.js         # UI 交互 / i18n / 持久化
├── LICENSE           # MIT
└── README.md
```

## 开发计划 / Roadmap

- [ ] PWA（安装到桌面、完整离线）
- [ ] 训练模式：渐快（accelerando）、数拍进入（count-in）
- [ ] 自定义每拍独立音量 / 音高
- [ ] 更多音色与重音组合预设

## License

[MIT](./LICENSE) — 可自由使用、修改与二次开源。

