/** First display glyph for commander marker: CJK surname (first Han character) or Latin initial. */
export function commanderDisplayGlyph(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const cp = t.codePointAt(0);
  if (cp === undefined) return "?";
  if (cp >= 0x4e00 && cp <= 0x9fff) {
    return String.fromCodePoint(cp);
  }
  return t.charAt(0).toUpperCase();
}
