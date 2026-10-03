# Talkframe

[简体中文](README.md) · **English**

## Turn text into a video that plays live on your Mac.

Talkframe turns a document or an idea into an animated video, drawn frame by frame on your Mac. Describe what you want, or import a PDF, Word or Markdown document, and let your chosen AI agent write the storyboard. Open the work to play it live, then export an MP4 when you are happy with it.

**Creating, watching and editing are free. MP4 export is a Pro feature, with your first export free.**

## From an idea to a video

1. **Describe what you want to make.** Write with Codex, Claude Code or an API of your choice, or start with an existing storyboard.
2. **Play it, then refine it.** Watch the complete work, seek to any point, change colours, toggle narration and adjust pacing. You can also ask your agent to rewrite a scene.
3. **Take the finished video with you.** Export an MP4 locally for explanations, sharing or presentations.

## What you can do

- **Start with a template or create from scratch.** Copy a template and add your content, or have your agent write React / TSX scene code to change layouts, motion and colours.
- **Make narration a choice.** Combine speech, music and captions as the work needs, or tell the story through visuals and music.
- **Let your agent drive production.** Connect to Talkframe over MCP to find templates, write storyboards, revise scenes and return a playback link. Export after reviewing the result.
- **Keep speech synthesis and rendering local.** Your work stays on your computer. If you choose cloud writing or speech, the relevant text goes to that service.

## Free and Pro

| Free | Pro |
| --- | --- |
| Unlimited creation, templates, narration, music, playback and editing | Unlimited MP4 exports, with 4K, batch production and your own branded outro |
| Your first MP4 export is free: 1080p with a Made with Talkframe outro. A successful export starts a 7-day Pro trial | After the trial, further MP4 exports require Pro. Playback and editing remain free |

The current target is Apple Silicon Macs. A public download is not yet available; a Windows release is planned. Follow this repository for release updates, or share questions and suggestions in [Issues](https://github.com/talkframe/capabilities/issues).

## What is in this public repository

The rendering engine and desktop app are not in this repository. It currently retains early public creative resources and a standalone promo-film tool:

| Path | Contents |
| --- | --- |
| [capabilities/](capabilities/) | The early capability catalog and examples, including L1 declarative definitions |
| [templates/](templates/) | Early narrative templates and style resources |
| [contracts/](contracts/) | Early storyboard, capability and transition contracts; `@talkframe/contracts@0.1.0` belongs to the old version |
| [skills/](skills/) | Early agent workflow guides |
| [community/](community/) | The early community index |
| [tools/beat-sync-promo/](tools/beat-sync-promo/) | A standalone beat-synced promo tool: one HTML page, a measured beat grid, frame-by-frame rendering and sub-frame motion blur |

**Compatibility:** The current app uses TSX scene code and live playback. L1 capability packs and some older MCP interfaces have been removed. The early resources above do not define the current app's interfaces; use the MCP runtime guidance and skills bundled with your installed version. Updated scene templates, runtime typings and sample storyboards are being prepared and have not yet been published here.

The standalone `beat-sync-promo` tool does not need the Talkframe engine. It uses Node, Python / numpy, ffmpeg and a Chromium browser; see its [README](tools/beat-sync-promo/README.md).

## Contributing and licensing

Questions, suggestions and improvements are welcome through [Issues](https://github.com/talkframe/capabilities/issues) and [Pull requests](https://github.com/talkframe/capabilities/pulls). See [CONTRIBUTING.md](CONTRIBUTING.md) for the early resources' contribution guidelines, and confirm the version and directory your change applies to.

- Contracts, tooling and CI: [MIT](LICENSE-MIT).
- Capability packs, templates, examples and media: [CC BY 4.0](LICENSE-CC-BY-4.0). Follow any license declaration in the relevant directory or file.
- Only submit content you have the right to share publicly. An author signature establishes integrity and continuity of that key; it does not establish originality, permission or factual correctness.
