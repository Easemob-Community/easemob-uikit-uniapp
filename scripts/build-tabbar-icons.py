#!/usr/bin/env python3
"""build-tabbar-icons.py — 从 em-icons 字体生成原生 tabBar PNG（与 em-icon 同字形）。

为什么需要 PNG：微信小程序 / uni-app x 的原生 tabBar iconPath 只接受图片，
不支持 iconfont。这是 em-icon 字体策略的唯一例外；组件内图标仍统一用 em-icon。
PNG 直接取 `em-icons.ttf` 的字形轮廓，而字体本身由 `scripts/build-icons.py`
从 vue `icons-v2` 同源 SVG 构建，因此 tabBar 与组件图标同源同形。

用法（仓库根目录）:
  .venv-icons/bin/python scripts/build-tabbar-icons.py
  .venv-icons/bin/python scripts/build-tabbar-icons.py --out demo/static/tabbar

产物: 81×81 透明 PNG，24 设计画布映射到 60×60 居中，颜色与 pages.json tabBar 的
color/selectedColor 对齐（默认 #919BA1 / #009EFF）。改图标时改 ICONS 表后重跑；
若 em-icons.ttf 重新构建，也建议重跑本脚本保持 PNG 同步。
"""
import argparse
import re
import sys
from pathlib import Path

import skia

REPO_ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = REPO_ROOT / 'uni_modules/easemob-uikit-uni/components/em-icon'
DEFAULT_TTF = ICON_DIR / 'em-icons.ttf'
DEFAULT_TS = ICON_DIR / 'em-icons.ts'
DEFAULT_OUT = REPO_ROOT / 'demo/static/tabbar'

SIZE = 81       # 微信推荐 81×81
CONTENT = 60    # 24 设计画布映射到 60×60，四周留 10.5
UPM = 1024      # em-icons 的 unitsPerEm（build-icons.py 固定值）
COLOR_NORMAL = '#919BA1'
COLOR_SELECTED = '#009EFF'

# (输出文件名, em-icons 规范键, 颜色)
ICONS = [
    ('conversation.png', 'bubble-rect', COLOR_NORMAL),
    ('conversation-active.png', 'bubble-rect-filled', COLOR_SELECTED),
    ('contact.png', 'person-double', COLOR_NORMAL),
    ('contact-active.png', 'person-double-filled', COLOR_SELECTED),
    ('mine.png', 'person-single', COLOR_NORMAL),
    ('mine-active.png', 'person-single-filled', COLOR_SELECTED),
]


def parse_ts_map(text: str) -> dict[str, int]:
    pairs = re.findall(r"'([\w.-]+)':\s*'\\u([0-9a-fA-F]{4,6})'", text)
    return {name: int(code, 16) for name, code in pairs}


def parse_color(hex_color: str) -> int:
    value = hex_color.lstrip('#')
    r, g, b = int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)
    return skia.ColorSetARGB(255, r, g, b)


def render(typeface: skia.Typeface, codepoint: int, out: Path, color: str) -> None:
    font = skia.Font(typeface, UPM)
    glyph = font.textToGlyphs(chr(codepoint))[0]
    path = font.getPath(glyph)
    surface = skia.Surface(SIZE, SIZE)
    canvas = surface.getCanvas()
    canvas.clear(skia.ColorTRANSPARENT)
    # 字体路径 y 轴以基线为 0、向上为负；基线放到底部、正向缩放即与 SVG 同向
    scale = CONTENT / float(UPM)
    pad = (SIZE - CONTENT) / 2.0
    canvas.translate(pad, pad + CONTENT)
    canvas.scale(scale, scale)
    paint = skia.Paint(AntiAlias=True, Color=parse_color(color))
    canvas.drawPath(path, paint)
    out.parent.mkdir(parents=True, exist_ok=True)
    surface.makeImageSnapshot().save(str(out), skia.kPNG)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--ttf', type=Path, default=DEFAULT_TTF)
    ap.add_argument('--ts', type=Path, default=DEFAULT_TS)
    ap.add_argument('--out', type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    if not args.ttf.exists() or not args.ts.exists():
        print(f'FAIL 缺少 em-icons 字体/映射: {args.ttf} / {args.ts}')
        return 1
    mapping = parse_ts_map(args.ts.read_text())
    typeface = skia.Typeface.MakeFromFile(str(args.ttf))
    if typeface is None:
        print(f'FAIL 无法解析字体: {args.ttf}')
        return 1

    for name, icon, color in ICONS:
        if icon not in mapping:
            print(f'FAIL em-icons.ts 缺少规范键: {icon}')
            return 1
        render(typeface, mapping[icon], args.out / name, color)
        print(f'  {name:<28} <- {icon}  {color}')
    print(f'OK  {len(ICONS)} 个 tabBar 图标 -> {args.out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
