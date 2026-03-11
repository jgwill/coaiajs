import chalk from 'chalk';

let colorEnabled = true;

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
  if (!enabled) {
    chalk.level = 0;
  }
}

export function formatTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '(no data)';

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] ?? '').length))
  );

  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i]!))
    .join('  ');
  const separator = widths.map(w => '─'.repeat(w)).join('──');
  const dataLines = rows.map(row =>
    row.map((cell, i) => (cell ?? '').padEnd(widths[i]!)).join('  ')
  );

  return [
    colorEnabled ? chalk.bold(headerLine) : headerLine,
    separator,
    ...dataLines,
  ].join('\n');
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatError(message: string): string {
  const sym = colorEnabled ? chalk.red('✗') : '✗';
  const txt = colorEnabled ? chalk.red(message) : message;
  return `${sym} ${txt}`;
}

export function formatSuccess(message: string): string {
  const sym = colorEnabled ? chalk.green('✓') : '✓';
  const txt = colorEnabled ? chalk.green(message) : message;
  return `${sym} ${txt}`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toISOString().slice(0, 10);
}

export function formatProgress(completed: number, total: number): string {
  if (total === 0) return '[░░░░░░░░░░] 0% (0/0)';
  const ratio = Math.min(completed / total, 1);
  const pct = Math.round(ratio * 100);
  const filled = Math.round(ratio * 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const colored = colorEnabled
    ? ratio >= 1
      ? chalk.green(bar)
      : ratio >= 0.5
        ? chalk.yellow(bar)
        : chalk.red(bar)
    : bar;
  return `[${colored}] ${pct}% (${completed}/${total})`;
}
