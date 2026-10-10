import { useState } from 'react';
import toast from 'react-hot-toast';
import ReactDiffViewer from 'react-diff-viewer-continued';
import Layout from '../components/Layout';
import CodeArea from '../components/CodeArea';
import { useDark } from '../theme/DarkContext';

export default function ComparePage() {
  const { dark } = useDark();
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [diff, setDiff] = useState<{ l: string; r: string } | null>(null);
  const [splitView, setSplitView] = useState(true);

  const compare = () => {
    if (!left && !right) return toast.error('비교할 코드를 입력하세요.');
    setDiff({ l: left, r: right });
    if (left === right) toast('두 코드가 동일합니다.', { icon: '✅' });
    else toast.success('비교했습니다.');
  };
  const swap = () => { setLeft(right); setRight(left); setDiff(null); };

  const actions = (
    <>
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#243149] rounded p-0.5">
        <button onClick={() => setSplitView(true)} className={`px-3 py-1 rounded text-xs font-medium ${splitView ? 'bg-white dark:bg-[#0F1A2D] text-dk-blue shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>좌우</button>
        <button onClick={() => setSplitView(false)} className={`px-3 py-1 rounded text-xs font-medium ${!splitView ? 'bg-white dark:bg-[#0F1A2D] text-dk-blue shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>통합</button>
      </div>
      <button className="dk-btn-secondary !py-1.5" onClick={swap}>좌우 교체</button>
      <button className="dk-btn-primary !py-1.5" onClick={compare}>비교</button>
    </>
  );

  return (
    <Layout title="코드 비교" subtitle="좌우에 코드를 붙여넣고 [비교] — 변경된 줄을 색으로 표시" actions={actions}>
      <div className="flex flex-col h-full gap-3">
        <div className="grid grid-cols-2 gap-3 h-44 shrink-0">
          <CodeArea className="h-full" value={left} onChange={setLeft} placeholder="원본(왼쪽) 코드" />
          <CodeArea className="h-full" value={right} onChange={setRight} placeholder="비교 대상(오른쪽) 코드" />
        </div>
        <div className="dk-card flex-1 min-h-0 overflow-auto">
          {!diff ? (
            <div className="p-6 text-sm text-gray-400">[비교]를 누르면 두 코드의 차이를 표시합니다.</div>
          ) : (
            <div className="text-[12.5px]">
              <ReactDiffViewer oldValue={diff.l} newValue={diff.r} splitView={splitView} useDarkTheme={dark}
                leftTitle="원본" rightTitle="비교 대상" />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
