#!/usr/bin/env python3
"""check-icon-parity.py — em-icon 与 vue 版 uikit 图标源的 1:1 对照检查。

用法（仓库根目录）:
  .venv-icons/bin/python scripts/check-icon-parity.py            # 只查，退出码 0/1
  .venv-icons/bin/python scripts/check-icon-parity.py --verbose  # 打印完整对照与调用点
  .venv-icons/bin/python scripts/check-icon-parity.py --vue-icons <dir>

检查项:
  A. vue 源覆盖   icons-v2 下每个 SVG 都在 em-icons.ts 有同名规范键（canonical = 路径拍平 kebab，
                  filled/ → -filled 后缀，_ → -）——缺一个就说明「vue 有、本项目没有」。
  B. 字形覆盖     em-icons.ts 每个键都能在 em-icons.ttf 的 cmap 找到（别名允许复用码点）。
  C. 组件调用点   组件/ demo 里的字面量图标名必须存在于 em-icons.ts；仍在用旧版 uni-icons 别名
                  （非规范键）的单列 WARN，内部代码应改回 vue 同名键，别名仅保留给外部接入者。
  D. 别名面       ts 键数 - 规范键数 = 旧版别名数量（仅供盘点，不是错误）。

注意：本脚本只做「名称/来源」对照，不做字形轮廓比对；轮廓一致性由
scripts/build-icons.py --dry-run 的描边转曲相似度报告负责。
"""
import argparse
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

REPO_ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = REPO_ROOT / 'uni_modules/easemob-uikit-uni/components/em-icon'
TTF = ICON_DIR / 'em-icons.ttf'
TS = ICON_DIR / 'em-icons.ts'
DEFAULT_VUE_ICONS = REPO_ROOT.parent / 'easemob-uikit-vue/packages/uikit-core/src/assets/icons-v2'
SCAN_DIRS = [
    REPO_ROOT / 'uni_modules/easemob-uikit-uni/components',
    REPO_ROOT / 'demo',
]
# uni.showToast / showLoading 的 icon 取值，不是 em-icon 名
NON_EM_ICON_VALUES = {'none', 'success', 'error', 'loading', 'info', 'warn', 'fail', 'exception'}
# statusIconOf(kind, fallback) 的首参是消息状态键，不是图标名（:name 表达式里会被引号正则一并抓到）
NON_ICON_ARG_VALUES = {'sending', 'failed', 'unread', 'read'}

STATIC_NAME_RE = re.compile(r'<EmIcon\b[^>]*?(?<!:)name="([^"]+)"', re.S)
BOUND_NAME_RE = re.compile(r':name="([^"]+)"')
BOUND_ICON_RE = re.compile(r':icon="([^"]+)"')
STATIC_ICON_ATTR_RE = re.compile(r'(?<![\w:-])icon="([^"]+)"')
ICON_PROP_RE = re.compile(r"\bicon:\s*'([^']+)'")
QUOTED_RE = re.compile(r"'([^']+)'")


def canonical_name(rel: Path) -> str:
    """与 build-icons.py 的 canonical_name 保持一致。"""
    parts = rel.with_suffix('').parts
    filled = parts[0] == 'filled'
    body = parts[1:] if filled else parts
    return '-'.join(p.replace('_', '-') for p in body) + ('-filled' if filled else '')


def parse_ts_map(text: str) -> dict[str, int]:
    pairs = re.findall(r"'([\w.-]+)':\s*'\\u([0-9a-fA-F]{4,6})'", text)
    return {name: int(code, 16) for name, code in pairs}


def referenced_names(path: Path) -> set[str]:
    text = path.read_text(errors='ignore')
    names: set[str] = set()
    for m in STATIC_NAME_RE.finditer(text):
        names.add(m.group(1))
    for m in BOUND_NAME_RE.finditer(text):
        names.update(QUOTED_RE.findall(m.group(1)))
    for m in BOUND_ICON_RE.finditer(text):
        names.update(QUOTED_RE.findall(m.group(1)))
    for m in STATIC_ICON_ATTR_RE.finditer(text):
        names.add(m.group(1))
    for m in ICON_PROP_RE.finditer(text):
        names.add(m.group(1))
    return {n for n in names if ' ' not in n and n not in NON_EM_ICON_VALUES and n not in NON_ICON_ARG_VALUES}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--vue-icons', type=Path, default=DEFAULT_VUE_ICONS)
    ap.add_argument('--verbose', action='store_true')
    args = ap.parse_args()

    problems: list[str] = []
    warns: list[str] = []
    info: list[str] = []

    if not args.vue_icons.is_dir():
        print(f'FAIL 找不到 vue 图标源: {args.vue_icons}')
        return 1
    if not TS.exists():
        print(f'FAIL 找不到 {TS}')
        return 1

    ts_map = parse_ts_map(TS.read_text())
    cmap = set((TTFont(TTF).getBestCmap() or {}).keys())
    vue_names = {canonical_name(p.relative_to(args.vue_icons)) for p in args.vue_icons.rglob('*.svg')}
    ts_names = set(ts_map)

    info.append(f'vue icons-v2  {len(vue_names)} 个 SVG')
    info.append(f'em-icons.ts   {len(ts_names)} 键 / {len(set(ts_map.values()))} 码点'
                f'（{len(ts_names - vue_names)} 个旧版别名）')
    info.append(f'em-icons.ttf  {len(cmap)} 个 unicode 码点')

    # A. vue 源 → 字体映射（1:1 的「一个都不能少」）
    missing_in_ts = sorted(vue_names - ts_names)
    if missing_in_ts:
        problems.append(f'vue 有 {len(missing_in_ts)} 个图标未注册到 em-icons.ts: {missing_in_ts[:10]}')

    # B. ts → 字体字形
    missing_in_font = sorted(name for name, cp in ts_map.items() if cp not in cmap)
    if missing_in_font:
        problems.append(f'em-icons.ts 有 {len(missing_in_font)} 个键在 ttf 中无字形: {missing_in_font[:10]}')

    # C. 组件调用点
    alias_uses: list[tuple[str, str]] = []
    missing_refs: dict[str, set[str]] = {}
    for base in SCAN_DIRS:
        if not base.is_dir():
            continue
        for p in base.rglob('*'):
            if p.suffix not in ('.vue', '.uvue') or 'node_modules' in p.parts or 'unpackage' in p.parts:
                continue
            for name in referenced_names(p):
                if name not in ts_names:
                    missing_refs.setdefault(name, set()).add(str(p.relative_to(REPO_ROOT)))
                elif name not in vue_names:
                    alias_uses.append((name, str(p.relative_to(REPO_ROOT))))
    if missing_refs:
        detail = '; '.join(f'{n} ({", ".join(sorted(v)[:2])})' for n, v in sorted(missing_refs.items()))
        problems.append(f'组件引用了不存在的图标名: {detail}')
    if alias_uses:
        uniq = sorted({n for n, _ in alias_uses})
        warns.append(f'组件仍在用旧版别名 {len(uniq)} 个（应改 vue 同名规范键）: {uniq}')
        if args.verbose:
            for name, path in alias_uses:
                info.append(f'  alias {name}  <- {path}')

    print('\n'.join('     ' + i for i in info))
    for w in warns:
        print('WARN ' + w)
    for p in problems:
        print('FAIL ' + p)
    if not problems and not warns:
        print('OK   vue icons-v2 / em-icons.ts / ttf / 组件调用点全部一致')
    elif not problems:
        print('OK   未发现缺失或错名（WARN 按需处理）')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
