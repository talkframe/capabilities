#!/usr/bin/env python3
"""Write build/clips.js with the frame count of every clip, so render(t) clamps instead of asking for missing files."""
import json, os
d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'build', 'clips')
counts = {c: len([f for f in os.listdir(os.path.join(d, c)) if f.endswith('.jpg')]) for c in sorted(os.listdir(d)) if os.path.isdir(os.path.join(d, c))}
open(os.path.join(os.path.dirname(d), 'clips.js'), 'w').write('window.CLIP_COUNTS=' + json.dumps(counts) + ';\n')
print('clips.js:', counts)
