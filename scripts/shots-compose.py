#!/usr/bin/env python3
"""把多张真机截图拼成一张等高对照图（不写任何文字）。

由 scripts/sync-shots.mjs 调用：从 stdin 读 JSON 计划：
  [{"name": "...", "dest": "...", "height": 1400, "gap": 24, "shots": ["<abs>", ...]}]
结果（宽高、字节数）以 JSON 打到 stdout。
"""
import json
import os
import sys

from PIL import Image

QUALITY = 82
BACKGROUND = (255, 255, 255)


def main() -> int:
    plan = json.load(sys.stdin)
    results = []
    for item in plan:
        height = item['height']
        gap = item['gap']
        panels = []
        for path in item['shots']:
            with Image.open(path) as image:
                image = image.convert('RGB')
                width = round(image.width * height / image.height)
                panels.append(image.resize((width, height), Image.LANCZOS))
        total_width = sum(panel.width for panel in panels) + gap * (len(panels) - 1)
        canvas = Image.new('RGB', (total_width, height), BACKGROUND)
        x = 0
        for panel in panels:
            canvas.paste(panel, (x, 0))
            x += panel.width + gap
        os.makedirs(os.path.dirname(item['dest']), exist_ok=True)
        canvas.save(item['dest'], 'WEBP', quality=QUALITY, method=6)
        results.append({
            'name': item['name'],
            'width': canvas.width,
            'height': canvas.height,
            'bytes': os.path.getsize(item['dest']),
        })
    json.dump(results, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
