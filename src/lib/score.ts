// What a student types in the "Correct" field after a block: "62", "62%", "7/10", "7 of 10", "٧/١٠".
// Pure and local. Never fixes a value silently: anything it can't read becomes a short, plain message.

export type ScoreInput =
  | { ok: true; percent: number; /** Set when the text gave a count, e.g. "7/10" → 10. */ questions?: number }
  | { ok: false; message: string }

const ARABIC_DIGITS = /[٠-٩۰-۹]/g

/** Arabic-Indic and Persian digits → 0–9, "٪" → "%", Arabic comma/decimal → ".". */
export function westernDigits(text: string): string {
  return text
    .replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) - 0x0660) % (0x06f0 - 0x0660)))
    .replace(/[٪]/g, '%')
    .replace(/[٫]/g, '.')
}

/** null → nothing typed yet. */
export function parseScore(raw: string, maxQuestions = 120): ScoreInput | null {
  const text = westernDigits(raw).trim().toLowerCase()
  if (text === '') return null
  if (text.includes('-')) return { ok: false, message: 'A score can’t be below 0.' }

  const ratio = text.match(/^(\d+)\s*(?:\/|of|out of|من)\s*(\d+)$/)
  if (ratio) {
    const right = Number(ratio[1])
    const total = Number(ratio[2])
    if (total === 0) return { ok: false, message: 'How many questions were there?' }
    if (right > total) return { ok: false, message: `${right} right out of ${total} isn’t possible. Check the numbers.` }
    if (total > maxQuestions) return { ok: false, message: `Up to ${maxQuestions} questions per block.` }
    return { ok: true, percent: Math.round((right / total) * 100), questions: total }
  }

  const pct = text.match(/^(\d+(?:\.\d+)?)\s*%?$/)
  if (pct) {
    const n = Number(pct[1])
    if (n > 100) return { ok: false, message: 'That’s over 100%. Type the percent, or right/total like 7/10.' }
    return { ok: true, percent: Math.round(n) }
  }

  return { ok: false, message: 'Type the percent, like 62, or right/total like 7/10.' }
}
