// The SGR styling still "open" at the end of a styled string — the codes a following line must
// re-apply after we close the current line with a reset, so a color/bold span that straddles a
// word-wrap break neither bleeds into the line's padding nor drops off the continuation. Returns ''
// when styling is balanced or absent.
//
// It tracks the attributes chalk actually emits here (theme.ts): weight (bold/dim), italic,
// underline, strike, and foreground/background colors — basic, 256 (`38;5;n`), and truecolor
// (`38;2;r;g;b`). Each attribute keeps the raw parameter that set it so the reopener reproduces it.

/** SGR sequences (`ESC[…m`); other CSI escapes don't affect styling and are ignored. */
const SGR = /\x1b\[([0-9;]*)m/g;

/** The SGR escape that re-opens whatever styling is still active at the end of `text` (or ''). */
export function openSgr(text: string): string {
  let weight = ''; // 1 bold / 2 dim (reset 22)
  let italic = ''; // 3 (reset 23)
  let underline = ''; // 4 (reset 24)
  let strike = ''; // 9 (reset 29)
  let fg = ''; // 30-37 / 90-97 / 38;… (reset 39)
  let bg = ''; // 40-47 / 100-107 / 48;… (reset 49)

  let match: RegExpExecArray | null;
  while ((match = SGR.exec(text)) !== null) {
    const raw = match[1] ?? '';
    const params = raw === '' ? [0] : raw.split(';').map((n) => Number(n));
    for (let i = 0; i < params.length; i += 1) {
      const p = params[i];
      if (p === undefined) continue;
      if (p === 0) weight = italic = underline = strike = fg = bg = '';
      else if (p === 1 || p === 2) weight = `${p}`;
      else if (p === 22) weight = '';
      else if (p === 3) italic = '3';
      else if (p === 23) italic = '';
      else if (p === 4) underline = '4';
      else if (p === 24) underline = '';
      else if (p === 9) strike = '9';
      else if (p === 29) strike = '';
      else if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) fg = `${p}`;
      else if (p === 39) fg = '';
      else if (p === 38) {
        if (params[i + 1] === 5) { fg = `38;5;${params[i + 2]}`; i += 2; }
        else if (params[i + 1] === 2) { fg = `38;2;${params[i + 2]};${params[i + 3]};${params[i + 4]}`; i += 4; }
      } else if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) bg = `${p}`;
      else if (p === 49) bg = '';
      else if (p === 48) {
        if (params[i + 1] === 5) { bg = `48;5;${params[i + 2]}`; i += 2; }
        else if (params[i + 1] === 2) { bg = `48;2;${params[i + 2]};${params[i + 3]};${params[i + 4]}`; i += 4; }
      }
    }
  }

  const active = [weight, italic, underline, strike, fg, bg].filter((code) => code !== '');
  return active.length > 0 ? `\x1b[${active.join(';')}m` : '';
}
