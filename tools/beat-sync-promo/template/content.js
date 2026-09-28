// Everything the viewer reads. Edit this file (or copy content.zh.js over it); the timeline
// and the pacing lint read the same values. No full stops on screen.
window.CONTENT = {
  accent: '#C9F65A',
  hook: [{pre: 'One ', word: 'doc'}, 'One click', 'One film'],
  ui: {
    product: 'Acme Studio', uiAction: 'New video', dropLabel: 'Document', file: 'field-notes.md', dropHint: 'Read on device',
    fieldLabel: 'Audience', typed: 'Kids', voiceLabel: 'Voice', voices: ['Warm', 'Clear', 'Calm'],
    note: 'Script by cloud AI · voice and render on device', button: 'Generate',
  },
  key: {line1: 'Every line', pre: 'lands ', accent: 'on cue', post: ''},
  panel: {frontLabel: 'Source', quote: ['A river', 'blocks the road'], backLabel: 'Film', big: '2:25', sub: '6 scenes · 26 captions'},
  // replace with numbers you can verify; see docs/METHOD.md "content rules"
  stats: [{n: '21', c: 'scene templates'}, {n: '20', c: 'licensed tracks'}, {n: '100%', c: 'rendered on device', accent: true}],
  logo: {name: 'Acme', sub: 'Studio', tagline: 'Documents into films that talk'},
  // placeholder mark on a 100-unit grid: three caption bars and one accent dot
  mark: {bars: [[16, 22, 68], [16, 44, 50], [16, 66, 32]], stroke: 12, dot: {cx: 60, cy: 72, r: 7.5}, bounds: {x: 16, y: 22, w: 68, h: 57.5}},
};
