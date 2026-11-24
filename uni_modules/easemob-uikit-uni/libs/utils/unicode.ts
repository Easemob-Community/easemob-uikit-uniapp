function isCombiningMark(cp: number): boolean {
  return (cp >= 0x0300 && cp <= 0x036f)
    || (cp >= 0x1ab0 && cp <= 0x1aff)
    || (cp >= 0x1dc0 && cp <= 0x1dff)
    || (cp >= 0x20d0 && cp <= 0x20ff)
    || (cp >= 0xfe20 && cp <= 0xfe2f)
}

function isVariationSelector(cp: number): boolean {
  return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)
}

function isEmojiModifier(cp: number): boolean {
  return cp >= 0x1f3fb && cp <= 0x1f3ff
}

function isRegionalIndicator(cp: number): boolean {
  return cp >= 0x1f1e6 && cp <= 0x1f1ff
}

function isTag(cp: number): boolean {
  return (cp >= 0xe0020 && cp <= 0xe007e) || cp === 0xe007f
}

export function removeLastGrapheme(value: string): string {
  if (value === '') return ''

  let index = 0
  let previousCp = -1
  let lastClusterStart = 0
  let regionalRun = 0
  let joinNext = false

  while (index < value.length) {
    const cp = value.codePointAt(index) as number
    const extendsPrevious = cp === 0x200d
      || isCombiningMark(cp)
      || isVariationSelector(cp)
      || isEmojiModifier(cp)
      || isTag(cp)
    const joinsPrevious = joinNext || extendsPrevious || (cp === 0x0a && previousCp === 0x0d)
    let startsNew = index > 0 && !joinsPrevious

    if (isRegionalIndicator(cp) && regionalRun % 2 === 1 && !joinNext) {
      startsNew = false
    }
    if (startsNew) lastClusterStart = index

    regionalRun = isRegionalIndicator(cp) ? regionalRun + 1 : 0
    joinNext = cp === 0x200d
    previousCp = cp
    index += cp > 0xffff ? 2 : 1
  }

  return value.slice(0, lastClusterStart)
}
