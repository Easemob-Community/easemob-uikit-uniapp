#!/usr/bin/env python3
"""向 em-icons.ttf 合并缺省字形（占位字体 uniicons.ttf 无 pin/bell-slash 等字形时使用）。

字形来源：Remix Icon（Apache-2.0，https://github.com/Remix-Design/RemixIcon）。
流程：subset 源字体到目标字形 → fontTools 官方 Merger 合并 → 目标码点重映射到私用区。
（曾用手动 glyf 复制的 v1 方案：Chromium/FreeType 渲染正常，但微信 mp 引擎不渲染新字形，
故改走 Merger 标准合并路径。）

用法：python3 scripts/patch-icons.py [remixicon.ttf 路径]
默认源字体路径 /tmp/remixicon.ttf，不存在时自动下载。幂等：码点已存在则跳过。
新增字形后须在 components/em-icon/em-icons.ts 的 EmIcons 补映射（业务代码不写死码点）。
"""
import os
import shutil
import subprocess
import sys

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(
    REPO_ROOT, 'uni_modules/easemob-uikit-uni/components/em-icon/em-icons.ttf'
)
BACKUP = '/tmp/em-icons.ttf.bak'
REMIX_URL = 'https://github.com/Remix-Design/RemixIcon/raw/master/fonts/remixicon.ttf'

# (源码点, 目标码点, 含义) —— 对齐 vue 版 filled/pin 与 filled/bell-slash
JOBS = [
    (0xF038, 0xE700, 'pin'),         # remix pushpin-fill
    (0xEF9B, 0xE701, 'bell-slash'),  # remix notification-off-fill
]


def ensure_source(path: str) -> str:
    if os.path.exists(path):
        return path
    subprocess.run(['curl', '-sL', '-o', path, REMIX_URL], check=True)
    return path


def main() -> None:
    src_path = ensure_source(sys.argv[1] if len(sys.argv) > 1 else '/tmp/remixicon.ttf')
    tgt = TTFont(TARGET)
    cmap_t = tgt.getBestCmap() or {}
    todo = [(s, d, n) for s, d, n in JOBS if d not in cmap_t]
    if not todo:
        print('nothing to do')
        return
    del tgt

    # subset 源字体到目标字形（保留 layout 关闭，只带轮廓/度量/cmap/post）
    subset_path = '/tmp/em-icons-subset.ttf'
    opts = subset.Options()
    opts.layout_features = []
    opts.name_IDs = []
    opts.notdef_outline = False
    opts.recalc_bounds = True
    opts.drop_tables += ['FFTM', 'GDEF', 'GSUB', 'GPOS']
    unicodes = [s for s, _, _ in todo]
    subset.main([
        src_path,
        f'--unicodes={",".join(f"U+{u:04X}" for u in unicodes)}',
        f'--output-file={subset_path}',
    ])

    # 合并前剥离两端的 layout 表（图标字体不需要；Merger 的 GSUB 合并逻辑会在
    # ReqFeatureIndex 断言上失败），并把源字体 upm 缩放到与目标一致（Merger 要求相等）
    from fontTools.ttLib.scaleUpem import scale_upem
    stripped_target = '/tmp/em-icons-target-stripped.ttf'
    for src, dst in ((TARGET, stripped_target), (subset_path, subset_path)):
        f = TTFont(src)
        for tag in ('GSUB', 'GPOS', 'GDEF'):
            if tag in f:
                del f[tag]
        f.save(dst)
    s = TTFont(subset_path)
    if s['head'].unitsPerEm != 1024:
        scale_upem(s, 1024)
        s.save(subset_path)

    # 官方 Merger 合并
    merged_path = '/tmp/em-icons-merged.ttf'
    Merger().merge([stripped_target, subset_path]).save(merged_path)

    # 源码点重映射到私用区目标码点（所有 unicode cmap 子表）
    merged = TTFont(merged_path)
    for code_s, code_t, label in todo:
        for table in merged['cmap'].tables:
            if table.isUnicode() and code_s in table.cmap:
                table.cmap[code_t] = table.cmap[code_s]
                del table.cmap[code_s]
        print(f'map U+{code_s:04X} -> U+{code_t:04X} ({label})')

    if not os.path.exists(BACKUP):
        shutil.copy(TARGET, BACKUP)
        print(f'backup -> {BACKUP}')
    merged.save(TARGET)
    check = TTFont(TARGET)
    cmap = check.getBestCmap()
    ok = all(d in cmap for _, d, _ in todo)
    print(f'saved {TARGET}, glyphs {len(check.getGlyphOrder())}, codepoints ok: {ok}')


if __name__ == '__main__':
    main()
