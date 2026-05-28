import type { ToolDefinition } from '@proveit/shared';

export interface LineDiffEntry {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface ToolDiffResult {
  added: ToolDefinition[];
  removed: ToolDefinition[];
  modified: ToolDefinition[];
}

export function lineDiff(oldText: string, newText: string): LineDiffEntry[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Trace back
  const result: LineDiffEntry[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

export function toolsDiff(oldTools: ToolDefinition[], newTools: ToolDefinition[]): ToolDiffResult {
  const oldMap = new Map(oldTools.map((t) => [t.name, t]));
  const newMap = new Map(newTools.map((t) => [t.name, t]));

  return {
    added: newTools.filter((t) => !oldMap.has(t.name)),
    removed: oldTools.filter((t) => !newMap.has(t.name)),
    modified: newTools.filter((t) => {
      const old = oldMap.get(t.name);
      return old && JSON.stringify(old) !== JSON.stringify(t);
    }),
  };
}
