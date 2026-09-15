# Talkframe 文影 · Capabilities

**Talkframe（文影）** turns documents into narrated, animated videos, rendered locally on your Mac or Windows machine. This public repository holds everything that is *data*, not engine code:

- **Contracts** — the storyboard, capability, template and transition schemas (`@talkframe/contracts`, MIT)
- **Capabilities** — declarative (L1) and asset-based (L2) capability packs the engine can render
- **Templates & profiles** — narrative recipes and style profiles
- **Agent skills** — how an external agent (Claude Code, Codex, Cursor …) drives Talkframe over MCP
- **Community index & CI** — the acceptance battery every contributed pack must pass

The rendering engine, code-implemented capabilities and desktop app live in the private `talkframe/core` repository. Anyone can read, fork and contribute here; you need the Talkframe app to render.

文影把文档变成有旁白、有动画的视频，配音与渲染都在本机完成。本仓库只放**数据**，不放引擎代码：契约 Schema、L1 声明式与 L2 素材型能力包、题材模板与风格档、外部 agent 的驾驭说明、社区索引与验收电池。引擎、代码实现的能力与桌面 App 在私有仓库 `talkframe/core`。任何人都可以阅读、fork 与贡献；渲染需要 Talkframe App。

## Status / 状态

The initial data snapshot contains 13 capability entries, including five L1 declarative definitions, nine templates and two agent skills. Code-implemented capabilities expose inert metadata only. The skills drive an installed Talkframe app or core checkout; this public repository does not contain the app, rendering scripts or engine components.

首批数据快照包含 13 支能力，其中五支带 L1 声明式定义，另有九份模板和两份 agent 技能。代码实现的能力只公开不可执行的元数据。技能用于连接已安装的 Talkframe App 或核心项目；本仓库不含 App、渲染脚本或引擎组件。

`@talkframe/contracts@0.1.0` is published on npm; the validation workflow installs it directly.

`@talkframe/contracts@0.1.0` 已发布到 npm，验证工作流直接安装该包。

## Licensing / 许可

- Contracts, tooling and CI: **MIT** (`LICENSE-MIT`)
- Capability packs, templates, examples and media: **CC BY 4.0** (`LICENSE-CC-BY-4.0`)

Contributions must carry one of these licenses so that verified packs can be absorbed into the app with attribution. Signing a pack with your author key proves integrity and continuity of that key, not originality or correctness.

贡献必须采用上述许可之一，已验证的能力才能被署名吸收进 App。作者密钥签名只证明完整性与持钥连续性，不证明原创或正确。
