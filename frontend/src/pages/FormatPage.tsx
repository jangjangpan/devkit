import { useState } from 'react';
import toast from 'react-hot-toast';
import ReactDiffViewer from 'react-diff-viewer-continued';
import Layout from '../components/Layout';
import CodeArea from '../components/CodeArea';
import { formatPep8 } from '../lib/pep8';
import { useDark } from '../theme/DarkContext';

type Lang = 'javascript' | 'typescript' | 'json' | 'python';
const LANGS: { id: Lang; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'json', label: 'JSON' },
  { id: 'python', label: 'Python (PEP 8)' },
];

const SAMPLE = `function add(a,b){return a+b}
const obj={x:1,y:2,arr:[1,2,3]}
if(a){doThing( )}`;

async function formatPrettier(code: string, lang: Lang, opt: { tabWidth: number; semi: boolean; singleQuote: boolean }) {
  const standalone = await import('prettier/standalone');
  const babel = await import('prettier/plugins/babel');
  const estree = await import('prettier/plugins/estree');
  const plugins: unknown[] = [babel.default ?? babel, estree.default ?? estree];
  let parser = 'babel';
  if (lang === 'typescript') {
    const ts = await import('prettier/plugins/typescript');
    plugins.push(ts.default ?? ts);
    parser = 'typescript';
  } else if (lang === 'json') {
    parser = 'json';
  }
  // @ts-expect-error prettier plugin typing
  return standalone.format(code, { parser, plugins, tabWidth: opt.tabWidth, semi: opt.semi, singleQuote: opt.singleQuote });
}

export default function FormatPage() {
  const { dark } = useDark();
  const [lang, setLang] = useState<Lang>('javascript');
  const [input, setInput] = useState(SAMPLE);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tabWidth, setTabWidth] = useState(2);
  const [semi, setSemi] = useState(true);
  const [singleQuote, setSingleQuote] = useState(true);
  const [err, setErr] = useState('');

  const run = async () => {
    setErr(''); setOutput('');
    if (!input.trim()) return toast.error('코드를 입력하세요.');
    setBusy(true);
    try {
      const result = lang === 'python'
        ? formatPep8(input)
        : await formatPrettier(input, lang, { tabWidth, semi, singleQuote });
      setOutput(result);
      if (result.trim() === input.trim()) toast('이미 스타일 가이드에 맞습니다.', { icon: '✅' });
      else toast.success('정렬했습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      toast.error('정렬 실패 (구문 오류)');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => { if (output) { await navigator.clipboard.writeText(output); toast.success('복사했습니다.'); } };

  const actions = (
    <>
      <select className="dk-input !py-1.5" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
      {lang !== 'python' && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <select className="dk-input !py-1.5" value={tabWidth} onChange={(e) => setTabWidth(Number(e.target.value))} title="들여쓰기">
            <option value={2}>2칸</option><option value={4}>4칸</option>
          </select>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={semi} onChange={(e) => setSemi(e.target.checked)} />세미콜론</label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={singleQuote} onChange={(e) => setSingleQuote(e.target.checked)} />홑따옴표</label>
        </div>
      )}
      <button className="dk-btn-secondary !py-1.5" onClick={copy} disabled={!output}>결과 복사</button>
      <button className="dk-btn-primary !py-1.5" onClick={run} disabled={busy}>정렬</button>
    </>
  );

  return (
    <Layout title="코드 정렬" subtitle="JS/TS/JSON은 Prettier, Python은 PEP 8 기준으로 정리하고 변경점을 비교 표시" actions={actions}>
      <div className="flex flex-col h-full gap-3">
        <div className="h-44 shrink-0">
          <CodeArea className="h-full" value={input} onChange={setInput} placeholder="정렬할 코드를 붙여넣으세요." />
        </div>
        {err && <div className="text-xs text-dk-red bg-dk-red/10 rounded px-3 py-2 shrink-0">{err}</div>}
        {lang === 'javascript' && !output && (
          <div className="text-[11px] text-gray-400 bg-gray-50 dark:bg-[#162033] rounded px-3 py-2 shrink-0">
            JS 스타일 가이드 예시: <b>Prettier</b>(본 도구 기준), <b>Airbnb</b>(엄격·세미콜론·2칸), <b>StandardJS</b>(세미콜론 없음·2칸), <b>Google JS</b>. 위 옵션으로 세미콜론/따옴표/들여쓰기를 조정할 수 있습니다.
          </div>
        )}
        <div className="dk-card flex-1 min-h-0 overflow-auto">
          {!output ? (
            <div className="p-6 text-sm text-gray-400">[정렬]을 누르면 원본과 정렬 결과를 좌우로 비교해 보여줍니다.</div>
          ) : (
            <div className="text-[12.5px]">
              <ReactDiffViewer oldValue={input} newValue={output} splitView useDarkTheme={dark}
                leftTitle="원본" rightTitle="정렬 결과" />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
