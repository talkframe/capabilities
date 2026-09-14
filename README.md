# Talkframe 文影 · Capabilities

**Talkframe（文影）** turns documents into narrated, animated videos, rendered locally on your Mac or Windows machine. This public repository holds everything that is *data*, not engine code:

- **Contracts** — the storyboard, capability, template and transition schemas (`@talkframe/contracts`, MIT)
- **Capabilities** — declarative (L1) and asset-based (L2) capability packs the engine can render
- **Templates & profiles** — narrative recipes and style profiles
- **Agent skills** — how an external agent (Claude Code, Codex, Cursor …) drives Talkframe over MCP
- **Community index & CI** — the acceptance battery every contributed pack must pass

The rendering engine, code-implemented capabilities and desktop app live in the private `talkframe-core` repository. Anyone can read, fork and contribute here; you need the Talkframe app to render.

文影把文档变成有旁白、有动画的视频，配音与渲染都在本机完成。本仓库只放**数据**，不放引擎代码：契约 Schema、L1 声明式与 L2 素材型能力包、题材模板与风格档、外部 agent 的驾驭说明、社区索引与验收电池。引擎、代码实现的能力与桌面 App 在私有仓库 `talkframe-core`。任何人都可以阅读、fork 与贡献；渲染需要 Talkframe App。

## Status / 状态

Pre-release. The contract is being finalised against thirteen architecture experiments; the first capability packs and the `@talkframe/contracts` package will be published here once the core repository completes its split (task T2.7).

预发布阶段。契约正按 13 个架构实验的结论定稿；核心库完成拆分（T2.7）后，首批能力包与 `@talkframe/contracts` 会在此发布。

## Licensing / 许可

- Contracts, tooling and CI: **MIT** (`LICENSE-MIT`)
- Capability packs, templates, examples and media: **CC BY 4.0** (`LICENSE-CC-BY-4.0`)

Contributions must carry one of these licenses so that verified packs can be absorbed into the app with attribution. Signing a pack with your author key proves integrity and continuity of that key, not originality or correctness.

贡献必须采用上述许可之一，已验证的能力才能被署名吸收进 App。作者密钥签名只证明完整性与持钥连续性，不证明原创或正确。
