#!/usr/bin/env python3
"""verify-icons.py — em-icons 字体/映射/内联一致性自检（mp 端「图标全不显示」的分诊工具）。

用法（仓库根目录，任选）:
  .venv-icons/bin/python scripts/verify-icons.py            # 只查，退出码 0/1
  .venv-icons/bin/python scripts/verify-icons.py --verbose  # 打印每个告警的字形明细

查什么（按 mp 端真实故障模式排序）:
  A. 字体本体      ttf 可解析、UPM、字形数、是否存在空字形（numberOfContours==0）
  B. 映射一致      em-icons.ts ↔ cmap 双向覆盖（多/缺）、码点重复
  C. 内联一致      em-icon.css 的 base64 与 em-icons.ttf 的 md5 是否同一份
                   —— 不同步 = 码点位移后整片 blank（最常见的那条）
  D. 族名          css 里 @font-face 族名版本号（mp 按族名持久缓存，改 ttf 必须升版）
  E. 体积          css/wxss 内联后大小（小程序单文件有实际上限）
  F. 几何异常      字形越界 / advance=0 / yMin<0（text 盒子固定宽高时会裁切）
"""
import argparse
import base64
import hashlib
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

REPO_ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = REPO_ROOT / 'uni_modules/easemob-uikit-uni/components/em-icon'
TTF = ICON_DIR / 'em-icons.ttf'
TS = ICON_DIR / 'em-icons.ts'
CSS = ICON_DIR / 'em-icon.css'

# 小程序 wxss 体积警戒线（experience 值：内联后 200KB 起就要盯着）
CSS_WARN_BYTES = 200 * 1024

PRIVATE_START, PRIVATE_END = 0xE000, 0xF8FF


def md5(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()


def parse_ts_map(text: str) -> dict[str, int]:
    pairs = re.findall(r"'([\w.-]+)':\s*'\\u([0-9a-fA-F]{4,6})'", text)
    return {name: int(code, 16) for name, code in pairs}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--verbose', action='store_true')
    args = ap.parse_args()

    problems: list[str] = []   # 致命：一定导致不显示
    warns: list[str] = []      # 可疑：可能不显示/裁切/后续踩雷
    info: list[str] = []

    for p in (TTF, TS, CSS):
        if not p.exists():
            problems.append(f'缺文件: {p.relative_to(REPO_ROOT)}')
    if problems:
        print('\n'.join('FAIL ' + p for p in problems))
        return 1

    ttf_bytes = TTF.read_bytes()
    font = TTFont(TTF)
    glyf, hmtx = font['glyf'], font['hmtx']
    cmap = font.getBestCmap() or {}
    info.append(f'ttf  {len(ttf_bytes)/1024:.1f}KB  md5={md5(ttf_bytes)[:12]}  '
                f'UPM={font["head"].unitsPerEm}  glyphs={font["maxp"].numGlyphs}  cmap={len(cmap)}')

    # ---- A. 本体 / 空字形 ----
    empty = [n for n in cmap.values() if glyf[n].numberOfContours == 0]
    if empty:
        problems.append(f'空字形 {len(empty)} 个（这些码点渲染成空白）: {empty[:8]}')

    # ---- B. ts ↔ cmap ----
    ts_map = parse_ts_map(TS.read_text())
    ts_cps = set(ts_map.values())
    if not ts_map:
        problems.append('em-icons.ts 未解析出任何映射（文件格式变更或为空）')
    missing_in_font = sorted(c for c in ts_cps if c not in cmap)
    unmapped_in_ts = sorted(c for c in cmap if c not in ts_cps and PRIVATE_START <= c <= PRIVATE_END)
    if missing_in_font:
        problems.append(f'ts 里有 {len(missing_in_font)} 个码点字体中不存在 '
                        f'(U+{missing_in_font[0]:04X} …): 映射与字体不是同一次构建')
    if unmapped_in_ts:
        warns.append(f'字体里 {len(unmapped_in_ts)} 个私用区码点未在 ts 出现 (U+{unmapped_in_ts[0]:04X} …)')
    # 同一码点被多个名字复用 = 别名机制（旧 uni-icons 名 → 规范名），属正常
    alias_cps = len(ts_map) - len(ts_cps)
    if alias_cps > 0:
        info.append(f'ts {len(ts_map)} 键 / {len(ts_cps)} 码点（{alias_cps} 个键为别名复用）')

    # 是否为顺序分配（E000 连续无空洞）→ 增删图标会整表位移
    private_cps = sorted(c for c in cmap if PRIVATE_START <= c <= PRIVATE_END)
    sequential = private_cps and private_cps == list(range(private_cps[0], private_cps[0] + len(private_cps)))
    if sequential:
        warns.append('码点为「从 U+E000 顺序分配」：增/删任一图标会让其后所有码点位移，'
                     '字体与 ts 稍有不同步就是整片 blank（建议改 append-only 注册表）')

    # ---- C. 内联 base64 与 ttf 是否同一份 ----
    css_text = CSS.read_text()
    m = re.search(r'url\(data:font/ttf;base64,([A-Za-z0-9+/=]+)\)', css_text)
    if not m:
        problems.append('em-icon.css 没有 base64 内联字体（wxss 用文件路径在 mp 渲染层加载失败）')
    else:
        inline = base64.b64decode(m.group(1))
        same = inline == ttf_bytes
        info.append(f'inline {len(inline)/1024:.1f}KB  md5={md5(inline)[:12]}  '
                    f'{"= ttf ✓" if same else "≠ ttf ✗"}')
        if not same:
            problems.append('css 内联字体与 em-icons.ttf 不是同一份（先跑 build-icons.py 重生成，'
                            '不要手拷 ttf）: 码点位移时表现为全部图标 blank')

    # ---- D. 族名 ----
    fam = re.search(r"font-family:\s*'(em-icons-v(\d+))'", css_text)
    if not fam:
        problems.append('css 未找到 em-icons-vN 族名（mp 端按族名缓存，缺版本号会一直是旧字体）')
    else:
        info.append(f'family={fam.group(1)}')

    # ---- E. 体积 ----
    size = len(css_text.encode())
    info.append(f'em-icon.css {size/1024:.1f}KB（构建后 wxss 相近）')
    if size > CSS_WARN_BYTES:
        warns.append(f'em-icon.css 超过 {CSS_WARN_BYTES//1024}KB：确认 mp 构建产物 wxss 未被截断，'
                     f'必要时拆字体或裁字形')

    # ---- F. 几何 ----
    bad_geo = []
    for cp, name in cmap.items():
        g = glyf[name]
        if g.numberOfContours == 0:
            continue
        g.recalcBounds(glyf)
        aw, _ = hmtx[name]
        if aw == 0:
            bad_geo.append(f'{name}: advance=0')
        elif g.xMax > font['head'].unitsPerEm or g.yMax > font['head'].unitsPerEm:
            bad_geo.append(f'{name}: 越界 ({g.xMin},{g.xMax},{g.yMin},{g.yMax})')
    # 整片字形落在 em box 之外 = y 轴翻转/基线写错，mp 端 text 盒子会整块裁掉（H5 仍可能显示）
    if cmap:
        ys = [(n, glyf[n].yMin, glyf[n].yMax) for n in cmap.values() if glyf[n].numberOfContours]
        bad_y = [f'{n}({lo},{hi})' for n, lo, hi in ys if hi <= 0 or lo >= font['head'].unitsPerEm]
        if len(bad_y) > len(ys) * 0.5 and ys:
            problems.append(f'{len(bad_y)}/{len(ys)} 个字形整体脱离 em box (y 轴翻转/基线写错)——'
                            f'mp 端会整块蒸发布局外: {bad_y[:5]}')
    if bad_geo:
        warns.append(f'几何异常 {len(bad_geo)} 个: {bad_geo[:5]}')
    info.append(f'hhea asc/desc={font["hhea"].ascent}/{font["hhea"].descent}  '
                f'head yMin={font["head"].yMin}')
    if font['hhea'].descent == 0:
        warns.append('hhea.descent=0：负 y 字形(下探)在小程序 text 固定高度下会被裁掉底部')

    # ---- 输出 ----
    print('\n'.join('     ' + i for i in info))
    for w in warns:
        print('WARN ' + w)
    for p in problems:
        print('FAIL ' + p)
    if not problems and not warns:
        print('OK   字体/映射/内联/族名全部一致')
    elif not problems:
        print('OK   未发现致命问题（WARN 项按需处理）')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
