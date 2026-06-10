export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function extIcon(ext: string): string {
  const map: Record<string, string> = {
    '.docx': 'file-text', '.doc': 'file-text',
    '.pdf': 'clipboard',
    '.xlsx': 'chart', '.xls': 'chart', '.csv': 'chart',
    '.pptx': 'play',
    '.txt': 'file-text',
    '.jpg': 'image', '.png': 'image',
    '.zip': 'archive',
  };
  return map[ext] || 'file';
}
