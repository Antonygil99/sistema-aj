// Turns an assistant's answer (light Markdown) into blocks the chat renders without HTML: paragraphs, lists, quotes
// and fenced blocks (WhatsApp drafts the user copies), with **bold**, `code` and links. Only internal CRM paths
// become links. Pure; tested in tests/agents.test.ts. Works on partial text while the answer streams.
export type Inline = { t: 'text'; v: string } | { t: 'bold'; v: string } | { t: 'code'; v: string } | { t: 'link'; v: string; href: string };
export type Block =
  | { type: 'paragraph'; inline: Inline[] }
  | { type: 'heading'; inline: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; inline: Inline[] }
  | { type: 'code'; text: string };
const INTERNAL = /^\/(crm|avisos|agenda|asistentes|usuarios|logs)(\/|\?|$)/;
export const isInternalPath = (href: string) => INTERNAL.test(href) && !href.includes('//') && !/[\s<>"']/.test(href);
export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  // A bare path only counts at the start of a word (not inside another URL such as //otro.com/crm).
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w/.:])(\/(?:crm|avisos|agenda|asistentes|usuarios|logs)(?:[/?][^\s)\],;]*)?)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ t: 'text', v: text.slice(last, index) });
    if (match[1] !== undefined) parts.push({ t: 'bold', v: match[1] });
    else if (match[2] !== undefined) parts.push({ t: 'code', v: match[2] });
    else if (match[3] !== undefined) parts.push(isInternalPath(match[4]) ? { t: 'link', v: match[3], href: match[4] } : { t: 'text', v: match[3] });
    else if (match[5] !== undefined) {
      // A trailing period or colon belongs to the sentence, not the path.
      const href = match[5].replace(/[.:]+$/, '');
      if (isInternalPath(href)) parts.push({ t: 'link', v: href, href });
      else parts.push({ t: 'text', v: href });
      if (href.length < match[5].length) parts.push({ t: 'text', v: match[5].slice(href.length) });
    }
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ t: 'text', v: text.slice(last) });
  return parts;
}
export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (paragraph.length) { blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) }); paragraph = []; }
    if (list) { blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) }); list = null; }
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim().startsWith('```')) {
      flush();
      const code: string[] = [];
      // An unclosed fence (still streaming) runs to the end.
      for (index++; index < lines.length && !lines[index].trim().startsWith('```'); index++) code.push(lines[index]);
      blocks.push({ type: 'code', text: code.join('\n').trim() });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line), numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      if (paragraph.length) { blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) }); paragraph = []; }
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) { blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) }); list = null; }
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) { flush(); blocks.push({ type: 'heading', inline: parseInline(heading[1]) }); continue; }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) { flush(); blocks.push({ type: 'quote', inline: parseInline(quote[1]) }); continue; }
    if (list) { blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) }); list = null; }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
