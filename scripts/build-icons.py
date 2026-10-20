#!/usr/bin/env python3
"""build-icons.py — 从 vue 版 uikit 图标库构建 em-icons 字体与映射表（正式版图标替换流程）。

用法（在仓库根目录）:
  .venv-icons/bin/python scripts/build-icons.py                 # 构建并覆盖 em-icons.ttf / em-icons.ts
  .venv-icons/bin/python scripts/build-icons.py --dry-run      # 只校验与打印报告，不写出

依赖: .venv-icons（fonttools / svgpathtools / skia-python），创建见仓库 README 或:
  python3.12 -m venv .venv-icons && .venv-icons/bin/pip install fonttools svgpathtools skia-python

流程:
  1. 扫描 vue 版 icons-v2 目录（线性 = 根目录，面性 = filled/ 子目录，映射名加 -filled 后缀）
  2. 解析 SVG：纯 path + 极少量 rect；描边图标（stroke=currentColor）经 skia 膨胀为填充轮廓
  3. 画布归一：非 24x24 viewBox 等比缩放并居中
  4. 三次贝塞尔转二次（TrueType glyf），私用区码点从 U+E000 顺序分配
  5. 输出 em-icons.ttf + em-icons.ts（含旧版 uni-icons 命名别名，存量业务零改动）

注意: 改完 em-icons.ttf 必须同步递增 em-icon.css 的字体族名版本号（mp 端按族名持久缓存）。
"""
import argparse
import math
import re
import sys
from pathlib import Path

import skia
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from svgpathtools import CubicBezier, Line, QuadraticBezier, Arc, parse_path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ICONS = REPO_ROOT.parent / 'easemob-uikit-vue/packages/uikit-core/src/assets/icons-v2'
EM_ICON_DIR = REPO_ROOT / 'uni_modules/easemob-uikit-uni/components/em-icon'
GRID = 24.0
UPM = 1024  # 与 uniicons 基座一致（Merger 要求同 UPM；该基座 mp 端验证可用）
SCALE = UPM / GRID
CODEPOINT_START = 0xE000
BASE_FONT = Path(__file__).resolve().parent / 'assets' / 'uniicons-base.ttf'

ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')

# ---- 旧版 uni-icons 命名 → vue 版规范命名别名表（存量业务/外部接入者兼容）----
# 语义弱匹配的映射收集到 REVIEW 清单打印出来人工复核。
ALIASES = {
    'arrow-down': 'arrow-down', 'arrow-left': 'arrow-left',
    'arrow-right': 'arrow-right', 'arrow-up': 'arrow-up',
    'auth': 'shield-checked', 'auth-filled': 'shield-checked-filled',
    'back': 'arrow-left',
    'bars': 'list',
    'bell-slash': 'bell-slash',
    'bottom': 'arrow-down-line',
    'calendar': 'circle-clock', 'calendar-filled': 'circle-clock-filled',
    'camera': 'camera', 'camera-filled': 'camera-filled',
    'cart': 'rects', 'cart-filled': 'rects-filled',
    'chat': 'bubble-rect', 'chat-filled': 'bubble-rect-filled',
    'chatboxes': 'bubble-rect-2', 'chatboxes-filled': 'bubble-rect-filled',
    'chatbubble': 'bubble-circle', 'chatbubble-filled': 'bubble-circle-filled',
    'checkbox': 'rect', 'checkbox-filled': 'rect-checked-filled',
    'checkmarkempty': 'check-single',
    'circle': 'circle-empty', 'circle-filled': 'circle-fill',
    'clear': 'xmark-light', 'close': 'xmark-bold', 'closeempty': 'xmark-light',
    'cloud-download': 'arrow-down-tray', 'cloud-download-filled': 'arrow-down-tray',
    'cloud-upload': 'arrow-up-tray', 'cloud-upload-filled': 'arrow-up-tray',
    'color': 'circle-3bars', 'color-filled': 'circle-fill',
    'compose': 'rect-pencil',
    'contact': 'person-card', 'contact-filled': 'person-single-filled',
    'down': 'chevron-down',
    'download': 'arrow-down-tray', 'download-filled': 'arrow-down-tray',
    'email': 'envelope', 'email-filled': 'envelope',
    'eye': 'eye', 'eye-filled': 'eye-filled',
    'eye-slash': 'eye-slash', 'eye-slash-filled': 'eye-slash-filled',
    'fire': 'flower', 'fire-filled': 'flower-filled',
    'flag': 'pin-fill',
    'folder-add': 'folder', 'folder-add-filled': 'folder-filled',
    'font': 'rect-hanzinalpha',
    'forward': 'arrow-rgt-uturn',
    'gear': 'nut', 'gear-filled': 'nut-filled',
    'gift': 'flower', 'gift-filled': 'flower-filled',
    'hand-down': 'arrow-down', 'hand-up': 'arrow-up',
    'headphones': 'mic',
    'heart': 'flower', 'heart-filled': 'flower-filled',
    'help': 'circle-bang', 'help-filled': 'circle-bang-filled',
    'home': 'rect', 'home-filled': 'rect-fill',
    'image': 'rect-img', 'image-filled': 'rect-img-filled',
    'images': 'rects', 'images-filled': 'rects-filled',
    'info': 'circle-bang', 'info-filled': 'circle-bang-filled',
    'left': 'chevron-left',
    'link': 'paperclip',
    'list': 'list',
    'location': 'loc', 'location-filled': 'loc-filled',
    'locked': 'lock-closed', 'locked-filled': 'lock-closed-filled',
    'loop': 'ringarrow-cw',
    'mail-open': 'envelope-2', 'mail-open-filled': 'envelope-2',
    'map': 'globe', 'map-filled': 'globe-filled',
    'map-pin': 'pin', 'map-pin-ellipse': 'pin',
    'medal': 'crown', 'medal-filled': 'crown-filled',
    'mic': 'mic', 'mic-filled': 'mic-fill',
    'micoff': 'mic-slash', 'micoff-filled': 'mic-slash-filled',
    'minus': 'minus', 'minus-filled': 'circle-minus-filled',
    'more': 'circle-ellipsis', 'more-filled': 'circle-ellipsis-filled',
    'navigate': 'plane', 'navigate-filled': 'plane-filled',
    'notification': 'bell', 'notification-filled': 'bell-filled',
    'paperclip': 'paperclip',
    'paperplane': 'plane', 'paperplane-filled': 'plane-filled',
    'person': 'person-single', 'person-filled': 'person-single-filled',
    'personadd': 'person-plus', 'personadd-filled': 'person-plus-filled',
    'personadd-filled-copy': 'person-plus-filled',
    'phone': 'phone', 'phone-filled': 'phone-filled',
    'pin': 'pin',
    'plus': 'plus', 'plus-filled': 'circle-plus-filled', 'plusempty': 'plus',
    'pulldown': 'chevron-down',
    'pyq': 'bubble-circle', 'qq': 'bubble-circle',
    'redo': 'arrow-rgt-uturn',
    'refresh': 'ringarrow-cw', 'refreshempty': 'ringarrow-cw',
    'reload': 'ringarrow-cw',
    'right': 'chevron-right',
    'scan': 'rect-idphoto',
    'search': 'search',
    'settings': 'nut', 'settings-filled': 'nut-filled',
    'shop': 'rect', 'shop-filled': 'rect-fill',
    'smallcircle': 'circle-fill', 'smallcircle-filled': 'circle-fill',
    'sound': 'speaker-wave', 'sound-filled': 'speaker-wave-filled',
    'spinner-cycle': 'loading-arc-normal',
    'staff': 'person-list', 'staff-filled': 'person-list-filled',
    'star': 'status-star', 'star-filled': 'circle-star-filled', 'starhalf': 'status-star',
    'top': 'arrow-up-line',
    'trash': 'trash', 'trash-filled': 'trash-filled',
    'tune': 'rect-3bars',
    'undo': 'arrow-lft-uturn',
    'up': 'chevron-up',
    'upload': 'arrow-up-tray', 'upload-filled': 'arrow-up-tray',
    'videocam': 'video', 'videocam-filled': 'video-filled',
    'vip': 'crown', 'vip-filled': 'crown-filled',
    'wallet': 'rect', 'wallet-filled': 'rect-fill',
    'weibo': 'bubble-circle', 'weixin': 'bubble-circle',
}

# 语义弱匹配（占位级映射），构建报告里单独列出请人工复核
WEAK = {'cart', 'cart-filled', 'color', 'color-filled', 'fire', 'fire-filled', 'flag',
        'gift', 'gift-filled', 'headphones', 'heart', 'heart-filled', 'home', 'home-filled',
        'images', 'images-filled', 'link', 'map', 'map-pin', 'map-pin-ellipse', 'pyq', 'qq',
        'scan', 'shop', 'shop-filled', 'tune', 'wallet', 'wallet-filled', 'weibo', 'weixin',
        'chatboxes-filled', 'checkbox', 'star', 'starhalf', 'mail-open', 'mail-open-filled'}


def parse_attrs(tag: str) -> dict:
    return dict(ATTR_RE.findall(tag))


def canonical_name(rel: Path) -> str:
    parts = rel.with_suffix('').parts
    filled = parts[0] == 'filled'
    body = parts[1:] if filled else parts
    return '-'.join(p.replace('_', '-') for p in body) + ('-filled' if filled else '')


def load_shapes(svg_text: str):
    """解析 SVG 为形状列表: (kind, attrs)；kind = 'path' | 'rect'。白色背景 rect 跳过。"""
    open_m = re.search(r'<svg\b[^>]*>', svg_text)
    root = parse_attrs(open_m.group(0))
    body = svg_text[open_m.end():svg_text.rindex('</svg>')]
    shapes = []
    for m in re.finditer(r'<(path|rect)\b([^>]*?)/?>', body):
        kind, attr_text = m.group(1), m.group(2)
        attrs = parse_attrs(attr_text)
        if kind == 'rect' and attrs.get('fill') == 'white':
            continue  # 背景底（如 dspntd.svg）
        shapes.append((kind, {**root, **attrs}))
    return root, shapes


def rect_to_segments(attrs: dict):
    x, y = float(attrs['x']), float(attrs['y'])
    w, h = float(attrs['width']), float(attrs['height'])
    rx = float(attrs.get('rx') or 0)
    if rx <= 0:
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        return [([('m', pts[0])] + [('l', p) for p in pts[1:]] + [('c', None)])]
    k = 0.5522847498 * rx
    seq = []
    seq.append(('m', (x + rx, y)))
    seq.append(('l', (x + w - rx, y)))
    seq.append(('z', ((x + w - rx, y), (x + w, y + rx), (x + w - rx + k, y), (x + w, y + rx - k), (x + w, y + rx))))
    seq.append(('l', (x + w, y + h - rx)))
    seq.append(('z', ((x + w, y + h - rx), (x + w - rx, y + h), (x + w, y + h - rx + k), (x + w - rx, y + h - rx + k), (x + w - rx, y + h))))
    seq.append(('l', (x + rx, y + h)))
    seq.append(('z', ((x + rx, y + h), (x, y + h - rx), (x + rx - k, y + h), (x + k, y + h - rx + k), (x, y + h - rx))))
    seq.append(('l', (x, y + rx)))
    seq.append(('z', ((x, y + rx), (x + rx, y), (x - k + rx, y + rx - k), (x + k, y), (x + rx, y))))
    seq.append(('c', None))
    return [seq]


def path_to_segments(d: str, flatten_arc_tol=0.05):
    """svgpathtools Path → 命令列表 [[('m',p), ('l',p), ('q',(c1,end)), ('z',(c1,c2,end)), ('c',None)], ...]（SVG 坐标）。"""
    contours, cur = [], None
    for seg in parse_path(d):
        start = (seg.start.real, seg.start.imag)
        if cur is None or abs(complex(*cur['last']) - seg.start) > 1e-6:
            if cur:
                contours.append(cur['cmds'])
            cur = {'last': start, 'cmds': [('m', start)]}
        if isinstance(seg, Line):
            cur['cmds'].append(('l', (seg.end.real, seg.end.imag)))
        elif isinstance(seg, QuadraticBezier):
            cur['cmds'].append(('q', ((seg.control.real, seg.control.imag),
                                      (seg.end.real, seg.end.imag))))
        elif isinstance(seg, CubicBezier):
            cur['cmds'].append(('z', ((seg.control1.real, seg.control1.imag),
                                      (seg.control2.real, seg.control2.imag),
                                      (seg.end.real, seg.end.imag))))
        elif isinstance(seg, Arc):
            # 采样折线（Arc 仅零星出现在圆角；stroke 图标转曲前平直化无视觉损失）
            n = max(4, int(seg.length() / flatten_arc_tol))
            for i in range(1, n + 1):
                p = seg.point(i / n)
                cur['cmds'].append(('l', (p.real, p.imag)))
        else:
            raise ValueError(f'未支持的线段类型: {type(seg)}')
        cur['last'] = (seg.end.real, seg.end.imag)
    if cur:
        contours.append(cur['cmds'])
    return contours


def skia_path_from_contours(contours):
    p = skia.Path()
    for cmds in contours:
        for cmd, pts in cmds:
            if cmd == 'm':
                p.moveTo(*pts)
            elif cmd == 'l':
                p.lineTo(*pts)
            elif cmd == 'q':
                p.quadTo(*pts[0], *pts[1])
            elif cmd == 'z':
                p.cubicTo(*pts[0], *pts[1], *pts[2])
            elif cmd == 'c':
                p.close()
    return p


def skia_path_to_contours(path: skia.Path):
    """skia 轮廓 → 命令列表；conic（带权重有理二次）精确转三次。"""
    contours, cur = [], None
    it = skia.Path.Iter(path, False)
    while True:
        verb, pts = it.next()
        if verb == skia.Path.kDone_Verb:
            break
        if verb == skia.Path.kMove_Verb:
            if cur:
                contours.append(cur)
            cur = [('m', (pts[0].x(), pts[0].y()))]
        elif verb == skia.Path.kLine_Verb:
            cur.append(('l', (pts[0].x(), pts[0].y())))
        elif verb == skia.Path.kQuad_Verb:
            cur.append(('q', ((pts[0].x(), pts[0].y()), (pts[1].x(), pts[1].y()))))
        elif verb == skia.Path.kConic_Verb:
            w = it.conicWeight()
            pc, prev = cur[-1]
            x0, y0 = prev if pc in ('m', 'l') else (prev[1] if pc == 'q' else prev[2])
            bx, by = pts[0].x(), pts[0].y()
            cx, cy = pts[1].x(), pts[1].y()
            k = 2.0 * w / 3.0
            cur.append(('z', ((x0 + k * (bx - x0), y0 + k * (by - y0)),
                              (cx + k * (bx - cx), cy + k * (by - cy)),
                              (cx, cy))))
        elif verb == skia.Path.kCubic_Verb:
            cur.append(('z', ((pts[0].x(), pts[0].y()),
                              (pts[1].x(), pts[1].y()),
                              (pts[2].x(), pts[2].y()))))
        elif verb == skia.Path.kClose_Verb:
            cur.append(('c', None))
    if cur:
        contours.append(cur)
    return contours


def stroke_to_fill(contours, width: float, cap: str, join: str):
    paint = skia.Paint()
    paint.setStyle(skia.Paint.kStroke_Style)
    paint.setStrokeWidth(width)
    paint.setStrokeCap(skia.Paint.kRound_Cap if cap == 'round' else skia.Paint.kButt_Cap)
    paint.setStrokeJoin(skia.Paint.kRound_Join if join == 'round' else skia.Paint.kMiter_Join)
    src = skia_path_from_contours(contours)
    dst = skia.Path()
    if not paint.getFillPath(src, dst):
        raise ValueError('skia 描边转轮廓失败')
    return skia_path_to_contours(dst)


def make_mapper(vb: str):
    _pre, nums = vb.split('0 0') if vb.startswith('0 0') else vb.rsplit('0 0', 1)
    # viewBox="0 0 w h"
    m = re.match(r'\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*$', vb)
    w, h = float(m.group(1)), float(m.group(2))
    s = GRID / max(w, h)
    ox, oy = (GRID - w * s) / 2.0, (GRID - h * s) / 2.0

    def to_font(pt):
        x, y = pt
        # 取整：相邻点折叠会产生零长线段，微信 mp 字体引擎会因此拒收整包字体（实测）
        return (round((x * s + ox) * SCALE), round((GRID - (y * s + oy)) * SCALE))

    return to_font


def draw_glyph(contours, to_font):
    tt_pen = TTGlyphPen(None)
    pen = Cu2QuPen(tt_pen, max_err=1.0, reverse_direction=True)
    for cmds in contours:
        # 跳过退化子路径（move 后直接 close 的空轮廓）
        if len(cmds) < 2:
            continue
        started = False
        last = None
        for cmd, pts in cmds:
            if cmd == 'm':
                if started:
                    pen.closePath()
                pt = to_font(pts)
                pen.moveTo(pt)
                started = True
                last = pt
            elif cmd == 'l':
                pt = to_font(pts)
                if pt == last:
                    continue  # 相邻重复点跳过（mp 兼容性，见 to_font 注释）
                pen.lineTo(pt)
                last = pt
            elif cmd == 'q':
                pen.qCurveTo(to_font(pts[0]), to_font(pts[1]))
                last = to_font(pts[1])
            elif cmd == 'z':
                pen.curveTo(to_font(pts[0]), to_font(pts[1]), to_font(pts[2]))
                last = to_font(pts[2])
            elif cmd == 'c':
                pen.closePath()
                started = False
        if started:
            pen.closePath()
    return tt_pen.glyph()


def raster_contours(contours, scale=8):
    """栅格化命令列表（SVG 坐标），返回像素 >0 的坐标集合，用于转曲质量对比。"""
    size = int(GRID * scale)
    surface = skia.Surface(size, size)
    canvas = surface.getCanvas()
    canvas.clear(skia.ColorWHITE)
    paint = skia.Paint()
    canvas.scale(scale, scale)
    canvas.drawPath(skia_path_from_contours(contours), paint)
    img = surface.makeImageSnapshot()
    info = img.imageInfo()
    row_bytes = info.minRowBytes()
    buf = bytearray(info.computeByteSize(row_bytes))
    if not img.readPixels(info, buf, row_bytes, 0, 0):
        raise RuntimeError('readPixels 失败')
    pts = set()
    for yy in range(info.height()):
        for xx in range(info.width()):
            if buf[yy * row_bytes + xx * 4 + 3] > 127:
                pts.add((xx, yy))
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--icons', type=Path, default=DEFAULT_ICONS)
    ap.add_argument('--out', type=Path, default=EM_ICON_DIR)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    svgs = sorted(args.icons.rglob('*.svg'))
    entries = [(canonical_name(p.relative_to(args.icons)), p) for p in svgs]
    names = [n for n, _ in entries]
    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        sys.exit(f'规范命名冲突: {dupes}')
    missing = {old: new for old, new in ALIASES.items() if new not in names}
    if missing:
        sys.exit(f'别名目标不存在: {missing}')

    report, stroke_report, codepoints = [], [], {}
    glyphs, metrics = {}, {}
    for i, (name, path) in enumerate(entries):
        root, shapes = load_shapes(path.read_text())
        to_font = make_mapper(root['viewBox'])
        all_contours = []
        for kind, attrs in shapes:
            if kind == 'rect':
                contours = rect_to_segments(attrs)
            else:
                contours = path_to_segments(attrs['d'])
            if attrs.get('stroke') and attrs.get('stroke') != 'none':
                w = float(attrs.get('stroke-width') or root.get('stroke-width') or 1)
                cap = attrs.get('stroke-linecap') or root.get('stroke-linecap') or 'butt'
                join = attrs.get('stroke-linejoin') or root.get('stroke-linejoin') or 'miter'
                before = raster_contours(contours)
                contours = stroke_to_fill(contours, w, cap, join)
                after = raster_contours(contours)
                inter = len(before & after)
                iou = inter / max(1, len(before | after))
                stroke_report.append((str(path.relative_to(args.icons)), round(iou, 4)))
                if iou < 0.95:
                    report.append(f'  [warn] 描边转曲相似度偏低({iou}): {path.name}')
            all_contours.extend(contours)
        glyph = draw_glyph(all_contours, to_font)
        if not glyph.numberOfContours:
            report.append(f'  [warn] 空字形: {name}')
        glyphs[name] = glyph
        codepoints[name] = CODEPOINT_START + i

    order = ['.notdef'] + names
    glyphs['.notdef'] = TTGlyphPen(None).glyph()
    cmap = {cp: n for n, cp in codepoints.items()}
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    # mp 字体加载器只认 (3,1) 子表：旧 uniicons 字体仅一个 (3,1) subtable 且可用，
    # FontBuilder 额外生成的 (0,3) subtable 会导致 mp 解析整包字体失败（实测 Failed to load font）
    fb.font['cmap'].tables = [t for t in fb.font['cmap'].tables
                              if (t.platformID, t.platEncID) == (3, 1)]
    fb.setupGlyf(glyphs)
    for name, glyph in glyphs.items():
        glyph.recalcBounds(fb.font['glyf'])
        metrics[name] = (UPM, glyph.xMin if glyph.xMin is not None else 0)
    # 参考统计（基座字体本身也含 on-on 重复点且 mp 正常，仅作异常轮廓提示，不拦截）
    dup_on_on = 0
    for name in names:
        coords, ends, flags = glyphs[name].getCoordinates(fb.font['glyf'])
        pts = [(int(x), int(y)) for x, y in coords]
        fl = [int(f) for f in flags]
        start = 0
        for end in ends:
            for i in range(start, end + 1):
                j = i + 1 if i < end else start
                if pts[i] == pts[j] and (fl[i] & 1) and (fl[j] & 1):
                    dup_on_on += 1
            start = end + 1
    if dup_on_on > 100:
        report.append(f'  [warn] on-on 相邻重复点偏多: {dup_on_on} 处')
    metrics['.notdef'] = (UPM, 0)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=UPM, descent=0)
    fb.setupNameTable({
        'familyName': 'em-icons', 'styleName': 'Regular',
        'uniqueFontIdentifier': 'em-icons', 'fullName': 'em-icons',
        'psName': 'em-icons', 'version': 'Version 1.0',
    })
    fb.setupOS2()
    fb.setupPost()
    fb.setupMaxp()

    # 注意：此裸字体不会直接发布——下方 Merger 合并时元数据以 uniicons 基座为准。

    # ---- 关键：FontBuilder 裸字体被微信 mp 拒收（Failed to load font，net::OK；
    # Chromium/FreeType 均正常，逐字段对齐/uniicons Merger 合并仍无效），最终有效路径
    # 与 patch-icons.py 完全一致：先 subset 归一化 glyf 二进制编码，再 Merger 合并进
    # uniicons 基座（scripts/assets/uniicons-base.ttf，mp 验证可用）。
    import io
    import tempfile
    from fontTools import subset as ft_subset
    from fontTools.merge import Merger
    from fontTools.ttLib import TTFont as _TTFont

    buf = io.BytesIO()
    fb.save(buf)
    if not BASE_FONT.exists():
        sys.exit(f'缺 Merger 基座字体: {BASE_FONT}（mp 验证过的 uniicons，勿随意更换）')

    # ① subset 全量归一化（对齐 patch-icons.py 选项：重算 bounds、剥 layout/name）
    buf.seek(0)
    src_font = _TTFont(buf)
    opts = ft_subset.Options()
    opts.layout_features = []
    opts.name_IDs = []
    opts.notdef_outline = False
    opts.recalc_bounds = True
    opts.recalc_average_width = True
    opts.drop_tables += ['FFTM', 'GDEF', 'GSUB', 'GPOS']
    ss = ft_subset.Subsetter(opts)
    ss.populate(glyphs=list(order))
    ss.subset(src_font)
    with tempfile.NamedTemporaryFile(suffix='.ttf', delete=False) as tmp:
        src_font.save(tmp.name)
        tmp_path = tmp.name

    # ② Merger 合并：基座元数据 + 归一化后的新字形
    merged = Merger().merge([str(BASE_FONT), tmp_path])
    merged['hhea'].ascent = UPM
    merged['hhea'].descent = 0
    merged['hhea'].lineGap = 0
    os2 = merged['OS/2']
    os2.fsType = 0
    os2.sTypoAscender = UPM
    os2.sTypoDescender = 0
    os2.sTypoLineGap = 0
    os2.usWinAscent = UPM
    os2.usWinDescent = 0
    out = io.BytesIO()
    merged.save(out)
    out.seek(0)

    # ---- 自检：重载校验 cmap / 码点 / 嵌入位 ----
    check = TTFont(out)
    best = check.getBestCmap()
    missing = [cp for cp in cmap if cp not in best]
    assert not missing, f'合并后码点丢失: {[hex(c) for c in missing][:5]}'
    assert check['OS/2'].fsType == 0, f'fsType 必须为 0，实际 {check["OS/2"].fsType}'
    empty = 0
    go = check.getGlyphOrder()
    for gname in go[1:]:
        if check['glyf'][gname].numberOfContours == 0:
            empty += 1
    if empty > 1:
        report.append(f'  [warn] 空字形 {empty} 个（含 .notdef 属正常）')
    Path(tmp_path).unlink(missing_ok=True)

    print(f'图标数: {len(names)}（线性 {sum(1 for n in names if not n.endswith("-filled"))} / '
          f'面性 {sum(1 for n in names if n.endswith("-filled"))}），码点 U+{CODEPOINT_START:04X}–'
          f'U+{CODEPOINT_START + len(names) - 1:04X}，ttf {out.tell() // 1024}KB'
          f'（uniicons 基座 + Merger 合并）')
    print('描边转曲相似度（1.0 = 完全一致）:')
    for label, iou in stroke_report:
        print(f'  {iou}  {label}')
    weak = [f'{k}→{ALIASES[k]}' for k in sorted(WEAK) if k in ALIASES]
    print(f'语义弱匹配别名 {len(weak)} 项（占位映射，建议人工复核）:')
    for w in weak:
        print(f'  {w}')
    for line in report:
        print(line)

    if args.dry_run:
        print('--dry-run：未写出文件')
        return

    ttf_path = args.out / 'em-icons.ttf'
    ttf_path.write_bytes(out.getvalue())

    # ---- em-icon.css：data URI 内联字体 + 族名自动升版 ----
    # 根因（2026-10-16 实测）：微信 mp 渲染层无法加载 wxss 以「文件路径」引用的字体
    # （Failed to load font, net::OK，文件已成功下发但解码失败；base64 data URI 则正常）。
    # 旧字体 31KB 恰低于 vite 内联阈值被自动 base64，故一直正常；新字体 85KB 被写成文件
    # 引用才暴露。因此这里强制 data URI 内联，不受构建阈值影响；并同步递增族名版本
    # （mp 按族名持久缓存，data URI 内容变了但族名不变也不会重载）。
    import base64
    css_path = args.out / 'em-icon.css'
    css = css_path.read_text()
    fam_m = re.search(r"font-family:\s*'(em-icons-v\d+)'", css)
    if not fam_m:
        sys.exit('em-icon.css 中未找到 em-icons-vN 族名，无法自动升版')
    new_family = f'em-icons-v{int(fam_m.group(1).rsplit("v", 1)[1]) + 1}'
    b64 = base64.b64encode(out.getvalue()).decode()
    css = re.sub(r"@font-face\s*\{[^}]*\}",
                 f"@font-face {{\n  font-family: '{new_family}';\n"
                 f"  src: url(data:font/ttf;base64,{b64});\n}}",
                 css, count=1)
    css = re.sub(r"'em-icons-v\d+'", f"'{new_family}'", css)
    css_path.write_text(css)
    print(f'em-icon.css 已内联字体并升版 {fam_m.group(1)} → {new_family}')

    lines = ['// 图标名 → unicode 码点映射。本文件由 scripts/build-icons.py 生成，请勿手改。',
             '// 字形来源：vue 版 uikit 图标库（packages/uikit-core/src/assets/icons-v2，含线性/面性双风格）；',
             '// 码点为私用区顺序分配，增删图标后重跑 build-icons.py 全量重新生成。',
             '// 注意：em-icons.ttf 内容任何变更都会由 build-icons.py 自动内联进 em-icon.css 并递增族名版本号，请勿手改 css 字体段。',
             'export const EmIcons = {']
    for name in names:
        lines.append(f"  '{name}': '\\u{codepoints[name]:04x}',")
    lines.append('')
    lines.append('  // ---- 旧版 uni-icons 命名别名（兼容存量业务与外部接入者，新代码请用上面的规范名）----')
    alias_written = 0
    for old in sorted(ALIASES):
        if old in codepoints:
            continue  # 与规范名同键（如 mic/trash/search），无需别名
        lines.append(f"  '{old}': '\\u{codepoints[ALIASES[old]]:04x}',")
        alias_written += 1
    lines.append('} as const')
    lines.append('')
    lines.append('export type EmIconName = keyof typeof EmIcons')
    (args.out / 'em-icons.ts').write_text('\n'.join(lines) + '\n')
    print(f'已写出: {ttf_path}')
    print(f'已写出: {args.out / "em-icons.ts"}')


if __name__ == '__main__':
    main()
