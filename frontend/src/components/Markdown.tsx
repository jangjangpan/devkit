import React from 'react';

// 경량 마크다운 렌더러 — React 엘리먼트로 직접 구성(dangerouslySetInnerHTML 미사용 → XSS 안전).
// 지원: # 제목, - / * 목록, 1. 순서목록, > 인용, --- 구분선, **굵게**, *기울임*, `인라인코드`, [텍스트](url)

const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:)/i;

function inline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      nodes.push(<code key={k++} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-[#243149] text-[0.88em] font-mono text-dk-red dark:text-dk-cyan">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    } else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      const href = mm[2];
      if (SAFE_HREF.test(href)) {
        nodes.push(<a key={k++} href={href} target="_blank" rel="noreferrer" className="text-dk-blue underline">{mm[1]}</a>);
      } else {
        nodes.push(mm[1]); // 안전하지 않은 스킴(javascript: 등)은 텍스트로
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isSpecial = (l: string) =>
  /^(#{1,4})\s/.test(l) || /^>\s?/.test(l) || /^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l);

// GFM 표 구분선 (예: | --- | :--: | ---: |)
const isTableDelim = (l: string) =>
  l.includes('|') && l.includes('-') && /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(l);
// 표 행 셀 분리 (선두/말미 | 제거, | 로 분할)
const splitCells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const cellAlign = (c: string): 'left' | 'center' | 'right' => {
  const s = c.trim();
  const l = s.startsWith(':'); const r = s.endsWith(':');
  return l && r ? 'center' : r ? 'right' : 'left';
};

export default function Markdown({ text }: { text: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const HCLS = ['text-xl font-bold', 'text-lg font-bold', 'text-base font-semibold', 'text-sm font-semibold'];
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }

    // GFM 표: |헤더| 다음 줄이 |---| 구분선이면 표로 렌더
    if (line.includes('|') && i + 1 < lines.length && isTableDelim(lines[i + 1])) {
      const header = splitCells(line);
      const aligns = splitCells(lines[i + 1]).map(cellAlign);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '' && !/^\s*$/.test(lines[i])) {
        rows.push(splitCells(lines[i])); i++;
      }
      out.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="border-collapse text-[12.5px] min-w-full">
            <thead>
              <tr>{header.map((c, ci) => (
                <th key={ci} style={{ textAlign: aligns[ci] || 'left' }}
                  className="border border-gray-200 dark:border-[#2A3953] px-2.5 py-1.5 font-semibold bg-gray-50 dark:bg-[#1b2942] text-gray-700 dark:text-gray-100">{inline(c)}</th>
              ))}</tr>
            </thead>
            <tbody>{rows.map((r, ri) => (
              <tr key={ri} className={ri % 2 ? 'bg-gray-50/40 dark:bg-white/5' : ''}>
                {header.map((_, ci) => (
                  <td key={ci} style={{ textAlign: aligns[ci] || 'left' }}
                    className="border border-gray-200 dark:border-[#2A3953] px-2.5 py-1.5 text-gray-700 dark:text-gray-200">{inline(r[ci] ?? '')}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const Tag = (`h${Math.min(lvl, 4)}`) as keyof JSX.IntrinsicElements;
      out.push(<Tag key={key++} className={`${HCLS[lvl - 1]} mt-3 mb-1 text-gray-800 dark:text-gray-100`}>{inline(h[2])}</Tag>);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={key++} className="my-3 border-gray-200 dark:border-[#243149]" />); i++; continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(<blockquote key={key++} className="border-l-2 border-dk-blue/40 pl-3 my-1.5 text-gray-600 dark:text-gray-300">{q.map((l, ix) => <div key={ix}>{inline(l)}</div>)}</blockquote>);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      out.push(<ul key={key++} className="list-disc ml-5 my-1 space-y-0.5">{items.map((t, ix) => <li key={ix}>{inline(t)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push(<ol key={key++} className="list-decimal ml-5 my-1 space-y-0.5">{items.map((t, ix) => <li key={ix}>{inline(t)}</li>)}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isSpecial(lines[i])
           && !(lines[i].includes('|') && i + 1 < lines.length && isTableDelim(lines[i + 1]))) { para.push(lines[i]); i++; }
    out.push(
      <p key={key++} className="my-1 leading-relaxed">
        {para.map((l, ix) => <React.Fragment key={ix}>{ix > 0 && <br />}{inline(l)}</React.Fragment>)}
      </p>,
    );
  }
  return <div className="text-[13px] text-gray-800 dark:text-gray-100">{out}</div>;
}
