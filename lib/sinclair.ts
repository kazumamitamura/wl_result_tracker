/**
 * Sinclair coefficient (IWF 2021-2024 cycle).
 * 体重の異なる選手を公平に比較するための係数。
 */

export function calculateSinclair(
  total: number,
  bodyweight: number,
  isFemale: boolean
): number {
  if (!total || !bodyweight || total <= 0 || bodyweight <= 0) return 0;

  // 2021-2024 IWF Official Constants
  const A = isFemale ? 0.787004341 : 0.722762521;
  const b = isFemale ? 153.757 : 193.609;

  // 体重が上限以上の場合は係数1.0
  if (bodyweight >= b) return total;

  const X = Math.log10(bodyweight / b);
  const coefficient = Math.pow(10, A * Math.pow(X, 2));

  return Number((total * coefficient).toFixed(3)); // 小数点第3位まで表示
}

/**
 * 階級文字列から体重（kg）を推定する。DBに体重がない場合のMVP計算用。
 * 例: "55Kg" -> 55, "+109Kg" -> 109
 */
export function parseBodyweightFromCategory(category: string | null): number {
  if (!category || typeof category !== "string") return 0;
  const s = category.trim().replace(/\s*[Kk]g\s*$/i, "");
  if (s.startsWith("+")) {
    const n = parseInt(s.slice(1), 10);
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
