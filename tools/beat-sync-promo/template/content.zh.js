// 中文示例：cp template/content.zh.js template/content.js 后重新渲染。屏幕文字不带句号。
window.CONTENT = {
  accent: '#C9F65A',
  hook: [{pre: '一篇', word: '文档'}, '一次点击', '一支成片'],
  ui: {
    product: 'Acme Studio', uiAction: '新建视频', dropLabel: '文档', file: '田野笔记.md', dropHint: '本机读取',
    fieldLabel: '讲给谁听', typed: '小学生', voiceLabel: '声音', voices: ['温暖男声', '温和女声', '沉稳播报'],
    note: '编稿用云端 AI · 配音与渲染在本机', button: '生成视频',
  },
  key: {line1: '每一句', pre: '都', accent: '对上', post: '画面'},
  panel: {frontLabel: '原文', quote: ['一条小河', '拦住了路'], backLabel: '成片', big: '2:25', sub: '6 幕分镜 · 26 句字幕'},
  stats: [{n: '21', c: '套画面模板'}, {n: '20', c: '首可商用配乐'}, {n: '100%', c: '配音与渲染在本机', accent: true}],
  logo: {name: 'Acme', sub: '工作室', tagline: '把文档变成会说话的视频'},
  mark: {bars: [[16, 22, 68], [16, 44, 50], [16, 66, 32]], stroke: 12, dot: {cx: 60, cy: 72, r: 7.5}, bounds: {x: 16, y: 22, w: 68, h: 57.5}},
};
