# Talkframe 文影

**简体中文** · [English](README.en.md)

## 一段文字，现场成片。

文影把文档或想法变成动画视频，画面在你的 Mac 上逐帧画出来。写一句想法，或导入 PDF、Word、Markdown 文档，让你选择的 AI agent 编成分镜；打开作品就能播放，满意后再导出 MP4。

**看、玩、改都免费。导出 MP4 是 Pro 功能，第一支免费。**

## 从想法到视频

1. **说出你想做什么。** 用 Codex、Claude Code 或自己选择的 API 编稿，也可以带着已有分镜开始。
2. **先播放，再打磨。** 现场看完整作品，拖到任意时间点预览，换配色、开关配音、调节奏；也可以让 agent 改写某一幕。
3. **满意后带走成片。** 在本机导出 MP4，用于讲解、分享或展示。

## 你可以做什么

- **用模板起步，也能从零创作。** 复制模板、换上自己的内容，或让 agent 直接写 React / TSX 幕代码，改布局、动效和配色。
- **让旁白成为选择。** 配音、配乐和字幕按作品需要搭配，也可以用画面和音乐讲故事。
- **让 agent 驾驭制作。** 通过 MCP 连接文影，查模板、写分镜、改画面、返回播放链接，确认效果后再导出。
- **在本机完成配音和渲染。** 作品保存在你的电脑。使用云端编稿或配音时，相应文本会交给你选择的服务。

## 免费与 Pro

| 免费 | Pro |
| --- | --- |
| 创作、模板、配音、配乐、播放和修改，不限次数 | MP4 导出不限次数，支持 4K、批量出片和自有品牌片尾 |
| 第一支 MP4 免费导出：1080p，带 Made with Talkframe 片尾；成功后开启 7 天 Pro 试用 | 试用结束后，继续导出 MP4 需要 Pro；播放和修改始终免费 |

目前面向 Apple 芯片的 Mac；正式下载尚未开放，Windows 发行计划中。发布动态见本仓库，问题与建议欢迎提交 [Issue](https://github.com/talkframe/capabilities/issues)。

## 这个公开仓库里有什么

这里提供开放的创作资料，以及一个可独立使用的宣传片工具：

| 路径 | 内容 |
| --- | --- |
| [capabilities/](capabilities/) | 画面能力资料与示例 |
| [templates/](templates/) | 题材模板与风格资料 |
| [contracts/](contracts/) | 分镜、画面能力与转场的格式说明 |
| [skills/](skills/) | agent 工作流参考 |
| [community/](community/) | 社区索引 |
| [tools/beat-sync-promo/](tools/beat-sync-promo/) | 独立的卡点宣传片工具：单个 HTML 页面、实测节拍网格、逐帧渲染与子帧运动模糊 |

独立的 `beat-sync-promo` 工具无需文影引擎，使用 Node、Python / numpy、ffmpeg 和 Chromium 浏览器；用法见其 [README](tools/beat-sync-promo/README.md)。

## 贡献与许可

欢迎通过 [Issues](https://github.com/talkframe/capabilities/issues) 和 [Pull requests](https://github.com/talkframe/capabilities/pulls) 提出问题、建议或改进。贡献约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

- 契约、工具与 CI：[MIT](LICENSE-MIT)。
- 能力包、模板、示例与媒体：[CC BY 4.0](LICENSE-CC-BY-4.0)；具体文件以所在目录的许可声明为准。
- 仅提交你有权公开分享的内容。
