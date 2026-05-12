/** 计算用户输入与正确答案的差异，返回逐字符标记。
 *  用最短编辑距离回溯一遍标出 match/sub/del/ins。
 */
export type DiffOp = 'match' | 'sub' | 'del' | 'ins';
export interface DiffPart { op: DiffOp; char: string }

export function diffChars(user: string, correct: string): DiffPart[] {
  const a = user;
  const b = correct;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  // 回溯
  const parts: DiffPart[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      parts.push({ op: 'match', char: b[j - 1] });
      i--; j--;
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
      parts.push({ op: 'sub', char: b[j - 1] });
      i--; j--;
    } else if (dp[i][j] === dp[i][j - 1] + 1) {
      parts.push({ op: 'ins', char: b[j - 1] });
      j--;
    } else {
      parts.push({ op: 'del', char: a[i - 1] });
      i--;
    }
  }
  while (j > 0) { parts.push({ op: 'ins', char: b[j - 1] }); j--; }
  while (i > 0) { parts.push({ op: 'del', char: a[i - 1] }); i--; }
  return parts.reverse();
}
