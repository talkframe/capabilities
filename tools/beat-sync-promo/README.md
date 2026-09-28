# beat-sync-promo

Minimal, beat-locked product promo films rendered from one HTML page. Every cut, click and reveal is
placed on a beat grid measured from the song's own kick drum. Motion blur is real: three sub-frames
per 60 fps frame, blended. Swap the song and the whole film re-times itself.

[中文说明](#中文说明) · [Method](docs/METHOD.md) · [方法](docs/METHOD.zh.md)

This tool lives at `tools/beat-sync-promo` in [talkframe/capabilities](https://github.com/talkframe/capabilities); run every command below from this directory. 本工具位于 talkframe/capabilities 的 `tools/beat-sync-promo`，以下命令都在这个目录里运行。

```sh
npm install                       # Playwright; uses your installed Chrome, else: npx playwright install chromium
npm run demo                      # synthetic song + synthetic clips -> build/promo.mp4 (no downloads)
```

Requirements: Node 20+, Python 3 with numpy, ffmpeg 6+.

## Make your own

```sh
python3 tools/prepare_music.py your-song.mp3 --target 25   # tempo, drop, kick-fitted grid -> build/grid.json
tools/extract_clips.sh clips.txt                           # your footage -> 30 fps JPEG sequences (see clips.example.txt)
$EDITOR template/content.js                                # every on-screen word, the accent colour, the mark
node tools/render.mjs lint                                 # pacing advice: cuts >= 1 bar, swaps >= 2 beats, readable text
node tools/render.mjs probe build/probe 2 4 8 12 16 20     # stills to look at before the full render
node tools/render.mjs full                                 # 3 sub-frames x 60 fps -> build/subframes
tools/finish.sh                                            # music excerpt + SFX, -14 LUFS, tmix, H.264 -> build/promo.mp4
```

### What re-times automatically when you change the song

- Tempo, beat phase and drop are measured. The excerpt is cut so the drop lands on bar 3 beat 1.
- Every event in `template/index.html` is written as `bt(bar, beat)`, and the SFX cue sheet is
  exported from the same timeline (`render.mjs cues`), so picture and sound move together.
- Film length follows the grid: 12 bars plus a tail. At 122 BPM that is 25 s; at 150 BPM it is
  21.7 s; at 100 BPM it is 29.7 s. `prepare_music.py` warns when the length misses `--target`.
- SFX are capped under the local music level, so a quiet intro ducks them automatically.

What it does not do: change the storyboard. The template has twelve bars of fixed shots. A song far
from 120-130 BPM changes the length rather than the structure, and the pacing lint tells you when
text gets too little time. Songs without a clear drop need `--drop SECONDS`.

## Layout

| Path | What |
|---|---|
| `template/index.html` | the film: a pure function `renderAt(t, ft)`, pacing manifest, SFX cue sheet |
| `template/content.js` | everything the viewer reads (`content.zh.js` is a Chinese example) |
| `tools/prepare_music.py` | tempo, drop and kick-fitted beat grid |
| `tools/render.mjs` | lint / cues / probe / full render with Playwright |
| `tools/sfx.py` | synthesized SFX aligned by measured peak |
| `tools/finish.sh` | audio excerpt, loudness, sub-frame blend, encode |
| `tools/make_test_song.py`, `tools/make_test_clips.sh` | synthetic stand-ins for trying the pipeline |
| `docs/METHOD.md` | the rules behind it and the pitfalls we hit |

## Licences

Code, docs and the synthesized sounds: MIT (see [LICENSE](LICENSE)). The placeholder "Acme" mark is
part of the template. See [NOTICE.md](NOTICE.md) for what is **not** included: no music, no footage,
and no Talkframe brand assets.

---

## 中文说明

用一个 HTML 页面渲染出极简、卡节拍的产品宣传片。每个剪辑、点击和揭示都放在从歌曲底鼓实测出来的节拍网格上。每帧取 3 个子帧混合，得到真实的运动模糊。换一首歌，整片自动重新对拍。

- `npm run demo`：用合成的测试歌和测试画面完整跑一遍，不需要下载任何素材。
- 换歌：运行 `python3 tools/prepare_music.py 你的歌.mp3 --target 25`。速度、拍子相位和 drop 位置都会自动测出，截取时让 drop 落在第 3 小节第 1 拍。画面和音效共用同一份时间轴，会一起重新对拍。
- 片长跟着网格走：12 小节加一段结尾。122 BPM 时是 25 秒，150 BPM 时是 21.7 秒，100 BPM 时是 29.7 秒；偏离 `--target` 时会给出提示。
- 分镜结构不会自动改。速度差很多的歌会改变片长，而不是改变结构；节奏检查会指出哪些文字停留时间不够。
- 文案、强调色和占位标志都在 `template/content.js` 里改。对外发布只用你自己拥有的真实素材和已授权的音乐。

规则和踩过的坑见 [docs/METHOD.zh.md](docs/METHOD.zh.md)。
