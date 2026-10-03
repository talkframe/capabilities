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

This repository offers open creative resources and a standalone promo-film tool:

| Path | Contents |
| --- | --- |
| [capabilities/](capabilities/) | Visual capability resources and examples |
| [templates/](templates/) | Narrative templates and style resources |
| [contracts/](contracts/) | Format references for storyboards, visual capabilities and transitions |
| [skills/](skills/) | Agent workflow references |
| [community/](community/) | The community index |
| [tools/beat-sync-promo/](tools/beat-sync-promo/) | A standalone beat-synced promo tool: one HTML page, a measured beat grid, frame-by-frame rendering and sub-frame motion blur |

The standalone `beat-sync-promo` tool does not need the Talkframe engine. It uses Node, Python / numpy, ffmpeg and a Chromium browser; see its [README](tools/beat-sync-promo/README.md).

## Contributing and licensing

Questions, suggestions and improvements are welcome through [Issues](https://github.com/talkframe/capabilities/issues) and [Pull requests](https://github.com/talkframe/capabilities/pulls). See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

- Contracts, tooling and CI: [MIT](LICENSE-MIT).
- Capability packs, templates, examples and media: [CC BY 4.0](LICENSE-CC-BY-4.0). Follow any license declaration in the relevant directory or file.
- Only submit content you have the right to share publicly.
