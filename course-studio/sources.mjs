import { esc } from './public/shared.js';

function links(text) {
  return esc(text).replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
}

// The three maintained source notes use headings, paragraphs and simple tables.
export function sourcePage(markdown) {
  const article = [];
  let inTable = false;
  for (const line of markdown.trim().split(/\r?\n/)) {
    if (line.startsWith('|')) {
      if (/^\|[\s|:-]+$/.test(line)) continue;
      const cells = line.slice(1, -1).split('|');
      const tag = inTable ? 'td' : 'th';
      if (!inTable) article.push('<div class="table-scroll"><table>');
      inTable = true;
      article.push('<tr>' + cells.map((cell) => `<${tag}>${links(cell.trim())}</${tag}>`).join('') + '</tr>');
      continue;
    }
    if (inTable) article.push('</table></div>');
    inTable = false;
    if (!line.trim()) continue;
    const heading = /^(#{1,3})\s+(.+)/.exec(line);
    article.push(
      heading
        ? `<h${heading[1].length}>${links(heading[2])}</h${heading[1].length}>`
        : '<p>' + links(line) + '</p>',
    );
  }
  if (inTable) article.push('</table></div>');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>教材依据 · 沪上动画课堂</title><link rel="icon" href="/mark.svg"><link rel="stylesheet" href="/style.css">
    <main class="source-doc"><a class="crumb" href="/">‹ 返回课程书架</a><article class="panel">${article.join('\n')}</article></main></html>`;
}
