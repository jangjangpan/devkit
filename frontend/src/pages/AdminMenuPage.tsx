import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { useMenuConfig } from '../context/MenuConfigContext';
import { TOOLS } from '../components/Sidebar';
import { menuConfigApi, errorMessage, type MenuConfig } from '../api/client';

type Item = { to: string; label: string; desc: string };
const ALL: Item[] = TOOLS.map((t) => ({ to: t.to, label: t.label, desc: t.desc }));

// 설정 → 표시 순서대로의 전체 항목(숨김 포함)
function buildItems(cfg: MenuConfig): Item[] {
  const order = cfg.order.length ? cfg.order : ALL.map((t) => t.to);
  const rank = new Map(order.map((k, i) => [k, i]));
  return ALL.slice().sort((a, b) => (rank.has(a.to) ? rank.get(a.to)! : 999) - (rank.has(b.to) ? rank.get(b.to)! : 999));
}

export default function AdminMenuPage() {
  const { user } = useAuth();
  const { config, reload } = useMenuConfig();
  const [items, setItems] = useState<Item[]>(() => buildItems(config));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(config.hidden));
  const [dirty, setDirty] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [over, setOver] = useState<{ idx: number; pos: 'before' | 'after' } | null>(null);

  // 설정이 (재)로드되면 편집 중이 아닐 때만 동기화
  useEffect(() => {
    if (dirty) return;
    setItems(buildItems(config)); setHidden(new Set(config.hidden));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  if (!user?.isAdmin) return <Navigate to="/sql-format" replace />;

  const move = (idx: number, d: -1 | 1) => {
    setItems((a) => { const j = idx + d; if (j < 0 || j >= a.length) return a; const c = a.slice(); [c[idx], c[j]] = [c[j], c[idx]]; return c; });
    setDirty(true);
  };
  const dropAt = (from: number, idx: number, pos: 'before' | 'after') => {
    setItems((a) => {
      let to = pos === 'after' ? idx + 1 : idx;
      const c = a.slice(); const [m] = c.splice(from, 1);
      if (from < to) to--;
      to = Math.max(0, Math.min(to, c.length));
      c.splice(to, 0, m); return c;
    });
    setDirty(true);
  };
  const toggle = (to: string) => {
    setHidden((s) => { const n = new Set(s); if (n.has(to)) n.delete(to); else n.add(to); return n; });
    setDirty(true);
  };

  const save = async () => {
    try {
      await menuConfigApi.save({ order: items.map((i) => i.to), hidden: [...hidden] });
      setDirty(false); reload();
      toast.success('메뉴 설정을 저장했습니다.');
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const resetDefault = async () => {
    if (!confirm('순서/숨김을 기본값으로 되돌릴까요?')) return;
    try {
      await menuConfigApi.save({ order: [], hidden: [] });
      setDirty(false); reload();
      setItems(ALL.slice()); setHidden(new Set());
      toast.success('기본값으로 되돌렸습니다.');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const actions = (
    <>
      <button className="dk-btn-ghost" onClick={resetDefault}>기본값 복원</button>
      <button className="dk-btn-primary !py-1.5" onClick={save}>저장{dirty ? ' *' : ''}</button>
    </>
  );

  return (
    <Layout title="메뉴 관리" subtitle="대메뉴 순서 변경 · 표시/숨김 — 전체 사용자에게 동일 적용 (관리자 전용)" actions={actions}>
      <div className="max-w-2xl space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-300">
          핸들(⠿)을 드래그하거나 ↑↓ 로 순서를 바꾸고, 체크박스로 표시 여부를 조절하세요. <b>저장</b>하면 모든 사용자에게 즉시 반영됩니다.
        </p>
        <div className="dk-card divide-y divide-gray-50 dark:divide-[#243149]">
          {items.map((it, idx) => {
            const isHidden = hidden.has(it.to);
            const dropLine = over && over.idx === idx && dragIdx !== null && dragIdx !== idx ? over.pos : null;
            return (
              <div key={it.to} className="relative"
                onDragOver={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver({ idx, pos: e.clientY - r.top < r.height / 2 ? 'before' : 'after' }); }}
                onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && over) dropAt(dragIdx, over.idx, over.pos); setDragIdx(null); setOver(null); }}>
                {dropLine === 'before' && <div className="absolute -top-px left-0 right-0 h-0.5 bg-dk-blue z-10" />}
                {dropLine === 'after' && <div className="absolute -bottom-px left-0 right-0 h-0.5 bg-dk-blue z-10" />}
                <div className={`flex items-center gap-3 px-3 py-2.5 ${isHidden ? 'opacity-45' : ''}`}>
                  <span draggable onDragStart={() => setDragIdx(idx)} onDragEnd={() => { setDragIdx(null); setOver(null); }}
                    title="드래그하여 이동" className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none">⠿</span>
                  <span className="w-7 text-center text-xs text-gray-400">{idx + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-700 dark:text-gray-100">{it.label}</span>
                    <span className="block text-[11px] text-gray-400">{it.desc} · {it.to}</span>
                  </span>
                  <button className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 px-1 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)} title="위로">↑</button>
                  <button className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 px-1 disabled:opacity-30" disabled={idx === items.length - 1} onClick={() => move(idx, 1)} title="아래로">↓</button>
                  <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300 cursor-pointer select-none ml-1">
                    <input type="checkbox" className="accent-dk-blue" checked={!isHidden} onChange={() => toggle(it.to)} /> 표시
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
