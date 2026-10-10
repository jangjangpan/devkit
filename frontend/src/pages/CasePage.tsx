import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

type Mode = 'upper' | 'lower' | 'swap';
type Scope = 'all' | 'outside' | 'inside';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'upper', label: '대문자로 (abc → ABC)', hint: '소문자 → 대문자' },
  { id: 'lower', label: '소문자로 (ABC → abc)', hint: '대문자 → 소문자' },
  { id: 'swap', label: '대소문자 반전 (aBc → AbC)', hint: '소문자 ↔ 대문자' },
];
const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: 'all', label: '전체', hint: '전체 변환' },
  { id: 'outside', label: '일반 문자열 (따옴표 밖)', hint: '따옴표 밖만 변환' },
  { id: 'inside', label: '따옴표 안', hint: '따옴표 안만 변환' },
];

// 한 글자 변환 (upper/lower/swap). swap은 ASCII a-z↔A-Z만.
function convChar(c: string, mode: Mode): string {
  if (mode === 'upper') return c.toUpperCase();
  if (mode === 'lower') return c.toLowerCase();
  if (c >= 'a' && c <= 'z') return c.toUpperCase();
  if (c >= 'A' && c <= 'Z') return c.toLowerCase();
  return c;
}

// scope에 따라 홑/쌍따옴표 내부/외부를 구분해 변환.
// 따옴표 문자 자체는 유지, SQL식 '' / "" (연속 따옴표=이스케이프)는 문자열 내용으로 취급.
function convert(text: string, mode: Mode, scope: Scope): string {
  if (scope === 'all') {
    let out = '';
    for (const c of text) out += convChar(c, mode);
    return out;
  }
  let out = '';
  let i = 0;
  const n = text.length;
  let inStr = false;
  let q = '';
  while (i < n) {
    const c = text[i];
    if (!inStr) {
      if (c === "'" || c === '"') { inStr = true; q = c; out += c; i++; continue; }
      out += scope === 'outside' ? convChar(c, mode) : c;
      i++;
    } else {
      if (c === q) {
        if (text[i + 1] === q) { out += c + c; i += 2; continue; } // 이스케이프 '' / ""
        inStr = false; out += c; i++; continue;                     // 문자열 종료
      }
      out += scope === 'inside' ? convChar(c, mode) : c;
      i++;
    }
  }
  return out;
}

const countLines = (s: string) => (s ? s.split('\n').length : 0);

export default function CasePage() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('upper');
  const [scope, setScope] = useState<Scope>('all');
  const output = useMemo(() => convert(input, mode, scope), [input, mode, scope]);

  const copyOutput = async () => {
    if (!output) return toast.error('복사할 결과가 없습니다.');
    try { await navigator.clipboard.writeText(output); toast.success('결과를 클립보드에 복사했습니다.'); }
    catch { toast.error('복사에 실패했습니다.'); }
  };

  const actions = (
    <>
      <select className="dk-input !py-1.5" value={mode} onChange={(e) => setMode(e.target.value as Mode)} title="변환 방식">
        {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <select className="dk-input !py-1.5" value={scope} onChange={(e) => setScope(e.target.value as Scope)} title="적용 범위 (따옴표 기준)">
        {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <button className="dk-btn-ghost" onClick={() => setInput('')}>전체 지우기</button>
      <button className="dk-btn-primary" onClick={copyOutput} disabled={!output}>결과 복사</button>
    </>
  );

  const scopeHint = SCOPES.find((s) => s.id === scope)?.hint;
  const modeHint = MODES.find((m) => m.id === mode)?.hint;

  return (
    <Layout title="대소문자 변환" subtitle="대문자/소문자/반전 · 따옴표 범위 선택 · 입력하면 즉시 반영" actions={actions}>
      <div className="flex flex-col h-full gap-3">
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          <div className="dk-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">
              <span>원본</span>
              <span className="font-normal text-gray-400">{input.length}자 · {countLines(input)}줄</span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              placeholder={"여기에 텍스트를 붙여넣으면 우측에 변환 결과가 바로 표시됩니다.\n\n적용 범위:\n · 전체 — 모두 변환\n · 일반 문자열 — 따옴표('' 또는 \"\") 밖만 변환\n · 따옴표 안 — 따옴표 안만 변환"}
              className="flex-1 min-h-0 w-full resize-none border-none outline-none p-3.5 font-mono text-[13px] leading-relaxed text-gray-800 dark:text-gray-100 bg-transparent whitespace-pre overflow-auto"
              style={{ tabSize: 4 }}
            />
          </div>
          <div className="dk-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">
              <span>변환 결과 · {modeHint} · {scopeHint}</span>
              <span className="font-normal text-gray-400">{output.length}자 · {countLines(output)}줄</span>
            </div>
            <textarea
              value={output}
              readOnly
              spellCheck={false}
              placeholder="변환 결과가 여기에 표시됩니다."
              className="flex-1 min-h-0 w-full resize-none border-none outline-none p-3.5 font-mono text-[13px] leading-relaxed whitespace-pre overflow-auto bg-[#0f172a] text-[#e2e8f0]"
              style={{ tabSize: 4 }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
