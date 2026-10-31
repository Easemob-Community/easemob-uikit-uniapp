#!/usr/bin/env python3
"""把截图原图压缩成站点用的 WebP。

由 scripts/sync-shots.mjs 调用：从 stdin 读 JSON 计划，逐张缩放/压缩后写出，
并把结果（宽高、字节数）以 JSON 打到 stdout。不直接对外使用。
"""
import json
import os
import sys

from PIL import Image

MAX_WIDTH = 750
QUALITY = 82


def main() -> int:
    plan = json.load(sys.stdin)
    results = []
    for item in plan:
        source = item['source']
        dest = item['dest']
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with Image.open(source) as image:
            image = image.convert('RGB')
            width = min(MAX_WIDTH, image.width)
            height = round(image.height * width / image.width)
            if width != image.width:
                image = image.resize((width, height), Image.LANCZOS)
            else:
                height = image.height
            image.save(dest, 'WEBP', quality=QUALITY, method=6)
        results.append({
            'ref': item['ref'],
            'width': width,
            'height': height,
            'bytes': os.path.getsize(dest),
        })
    json.dump(results, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
