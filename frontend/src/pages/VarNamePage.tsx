import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { toWords, suggestByLang } from '../lib/varname';

const EXAMPLES = ['사용자 이름', '주문 금액', '사용여부', '생산 계획 실적', '등록일', '거래처 코드', '주차별 수율'];

const copy = async (text: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(`복사됨: ${text}`); }
  catch { toast.error('복사 실패'); }
};

const LANG_COLOR: Record<string, string> = {
  SQL: 'bg-dk-blue', Java: 'bg-dk-orange', JavaScript: 'bg-dk-cyan', Python: 'bg-dk-green',
};

export default function VarNamePage() {
  const [input, setInput] = useState('사용자 이름');
  const words = useMemo(() => toWords(input), [input]);
  const groups = useMemo(() => suggestByLang(words), [words]);

  const actions = (
    <input
      className="dk-input !py-1.5 w-72"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="한글 또는 영문 입력 (예: 사용자 이름)"
      autoFocus
    />
  );

  return (
    <Layout title="변수명 추천" subtitle="한글/영문 → 언어별 변수명 (SQL · Java · JavaScript · Python) · 내장 사전, 오프라인" actions={actions}>
      <div className="max-w-5xl space-y-4">
        {/* 입력 + 예시 */}
        <div className="dk-card p-4 space-y-3">
          <input
            className="dk-input w-full text-base"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="변수로 만들 개념을 입력하세요 — 예: 사용자 이름, 주문 금액"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400">예시:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setInput(ex)}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#243149] text-gray-600 dark:text-gray-300 hover:bg-dk-blue/10 hover:text-dk-blue">{ex}</button>
            ))}
          </div>
          {words.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-gray-400">인식된 단어:</span>
              {words.map((w, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-dk-blue/10 text-dk-blue font-mono">{w}</span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">입력하면 추천 변수명이 표시됩니다.</div>
          )}
        </div>

        {/* 언어별 추천 */}
        {groups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((g) => (
              <div key={g.lang} className="dk-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-[#243149]">
                  <span className={`w-2.5 h-2.5 rounded-full ${LANG_COLOR[g.lang] || 'bg-gray-400'}`} />
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-100">{g.lang}</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-[#243149]">
                  {g.items.map((it) => (
                    <div key={it.use} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 group">
                      <span className="w-40 shrink-0 text-[11px] text-gray-400">{it.use}</span>
                      <code className="flex-1 min-w-0 truncate font-mono text-sm text-gray-800 dark:text-gray-100 select-all">{it.value}</code>
                      <button onClick={() => copy(it.value)}
                        className="shrink-0 text-xs text-gray-400 hover:text-dk-blue opacity-0 group-hover:opacity-100">복사</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          한글은 내장 사전(개발·제조/SCM 용어)으로 영어로 매핑하고, 사전에 없는 단어는 로마자로 변환합니다.
          외부 번역 서비스를 호출하지 않으므로 폐쇄망에서도 동작합니다. 영문을 직접 입력해도 됩니다.
        </p>
      </div>
    </Layout>
  );
}
