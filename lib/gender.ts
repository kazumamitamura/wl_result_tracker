/**
 * 階級（category）文字列から男女を判定する。
 * 女子: "W" または "女" を含む（例: W55, 女子49kg）
 * 男子: 上記以外、または "M" / "男" を含む
 */

export function isFemaleCategory(category: string | null): boolean {
  if (category == null || typeof category !== "string") return false;
  return /W|女/i.test(category.trim());
}

export function isMaleCategory(category: string | null): boolean {
  if (category == null || typeof category !== "string") return true;
  const s = category.trim();
  if (/W|女/i.test(s)) return false;
  return true; // M/男がなくても女子でなければ男子扱い
}
