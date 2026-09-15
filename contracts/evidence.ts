// @ts-check
/** Indices are UTF-16 offsets into the exact source.txt string, end-exclusive.
 * 'repaired' only means the existing whitespace/case-insensitive quote check;
 * neither source nor quote is rewritten, and no fuzzy factual match is inferred.
 * @param {{scenes: Array<{id: string, sourceQuote: string}>}} board @param {string} source
 */
export function buildEvidence(board: {scenes: Array<{id: string, sourceQuote: string}>}, source: string) {
  let normalized = '';
  /** @type {number[]} */ const starts: number[] = [];
  /** @type {number[]} */ const ends: number[] = [];
  for (let i = 0; i < source.length;) {
    const char = String.fromCodePoint(source.codePointAt(i)!);
    if (!/\s/u.test(char)) for (const unit of char.toLowerCase().split('')) {normalized += unit; starts.push(i); ends.push(i + char.length);}
    i += char.length;
  }
  return {scenes: board.scenes.map(({id, sourceQuote: quote}) => {
    const exact = quote.trim() ? source.indexOf(quote) : -1;
    if (exact >= 0) return {id, quote, start: exact, end: exact + quote.length, matched: 'exact'};
    const needle = quote.replace(/\s+/g, '').toLowerCase();
    const index = needle ? normalized.indexOf(needle) : -1;
    if (index >= 0) return {id, quote, start: starts[index], end: ends[index + needle.length - 1], matched: 'repaired'};
    return {id, quote, start: null, end: null, matched: 'missing'};
  })};
}
