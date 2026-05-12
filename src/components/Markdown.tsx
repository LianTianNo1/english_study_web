/** 极简 Markdown 渲染——支持 **粗体**、*斜体*、`代码`、列表、标题、段落。
 *  避免引入额外依赖。
 */
export function Markdown({ text }: { text: string }) {
  const html = renderMarkdown(text);
  return (
    <div
      className="markdown text-sm leading-relaxed text-ink2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function renderInline(s: string) {
  let r = escapeHtml(s);
  r = r.replace(/`([^`]+)`/g, '<code class="rounded bg-paper2 px-1 font-mono text-xs">$1</code>');
  r = r.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
  r = r.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  return r;
}

function renderMarkdown(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList: 'ol' | 'ul' | null = null;

  const closeList = () => {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  };

  for (const line of lines) {
    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      const cls = lvl === 1 ? 'mb-2 font-display text-xl font-bold text-ink'
                : lvl === 2 ? 'mt-3 mb-1 font-display text-lg font-semibold text-ink'
                : 'mt-2 mb-1 font-display text-base font-semibold text-ink';
      out.push(`<h${lvl} class="${cls}">${renderInline(h[2])}</h${lvl}>`);
    } else if (ol) {
      if (inList !== 'ol') { closeList(); inList = 'ol'; out.push('<ol class="ml-5 list-decimal space-y-1">'); }
      out.push(`<li>${renderInline(ol[2])}</li>`);
    } else if (ul) {
      if (inList !== 'ul') { closeList(); inList = 'ul'; out.push('<ul class="ml-5 list-disc space-y-1">'); }
      out.push(`<li>${renderInline(ul[1])}</li>`);
    } else if (line.trim() === '') {
      closeList();
      out.push('');
    } else {
      closeList();
      out.push(`<p class="my-2">${renderInline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
