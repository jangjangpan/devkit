import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { projectApi, errorMessage, type ProjectMeta, type ProjectType } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface Props {
  type: ProjectType;
  name: string;
  setName: (n: string) => void;
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  getContent: () => string;
  onLoad: (content: string, name: string) => void;
}

export default function ProjectControls({
  type, name, setName, currentId, setCurrentId, getContent, onLoad,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ProjectMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'updated' | 'name'>('updated');
  // 현재 열린 작업의 소유자/공유 상태
  const [ownerCd, setOwnerCd] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [tags, setTags] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const meCd = user?.userCd || '';
  const isMine = !currentId || ownerCd === null || ownerCd === meCd; // 신규/레거시/본인
  const canDelete = (m: ProjectMeta) => m.owner_cd === null || m.owner_cd === meCd || user?.isAdmin;

  const refresh = async () => {
    try { setList(await projectApi.list(type)); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const save = async () => {
    if (!name.trim()) return toast.error('이름을 입력하세요.');
    setBusy(true);
    try {
      const content = getContent();
      if (currentId && isMine) {
        await projectApi.update(currentId, { name, content, isShared: shared, tags });
        toast.success('저장했습니다.');
      } else {
        // 신규 또는 남의 공유 작업 → 내 소유로 새로 저장(복제)
        const r = await projectApi.create(type, name, content, shared, tags);
        setCurrentId(r.id);
        setOwnerCd(meCd);
        toast.success(currentId ? '내 작업으로 복제 저장했습니다.' : '새로 저장했습니다.');
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleShare = async () => {
    const next = !shared;
    setShared(next);
    if (currentId && isMine) {
      try {
        await projectApi.update(currentId, { isShared: next });
        toast.success(next ? '공유로 전환했습니다.' : '공유를 해제했습니다.');
      } catch (e) { toast.error(errorMessage(e)); }
    }
  };

  const load = async (m: ProjectMeta) => {
    try {
      const p = await projectApi.get(m.id);
      onLoad(p.content, p.name);
      setCurrentId(p.id);
      setName(p.name);
      setOwnerCd(p.owner_cd);
      setShared(p.is_shared === 'Y');
      setTags(p.tags || '');
      setOpen(false);
      const mine = p.owner_cd === null || p.owner_cd === meCd;
      toast.success(mine ? `'${p.name}' 불러옴` : `'${p.name}' (${p.owner_nm || '공유'}) 불러옴 · 저장 시 내 작업으로 복제됩니다`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const remove = async (m: ProjectMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await projectApi.remove(m.id);
      if (m.id === currentId) { setCurrentId(null); setOwnerCd(null); }
      await refresh();
      toast.success('삭제했습니다.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const newDoc = () => {
    setCurrentId(null);
    setOwnerCd(null);
    setShared(false);
    setTags('');
    setName('Untitled');
    onLoad('', 'Untitled');
    setOpen(false);
  };

  const toggleFav = async (m: ProjectMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await projectApi.favorite(m.id, m.is_favorite !== 'Y');
      await refresh();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  // 즐겨찾기 우선 → 선택 정렬
  const sortFn = (a: ProjectMeta, b: ProjectMeta) => {
    const fa = a.is_favorite === 'Y' ? 0 : 1;
    const fb = b.is_favorite === 'Y' ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return sort === 'name' ? a.name.localeCompare(b.name) : String(b.updated_at).localeCompare(String(a.updated_at));
  };
  const matchQ = (m: ProjectMeta) => {
    const k = q.trim().toLowerCase();
    if (!k) return true;
    return m.name.toLowerCase().includes(k) || (m.tags || '').toLowerCase().includes(k);
  };
  const mineList = list.filter((m) => (m.owner_cd === meCd || m.owner_cd === null) && matchQ(m)).sort(sortFn);
  const sharedList = list.filter((m) => m.owner_cd !== meCd && m.owner_cd !== null && m.is_shared === 'Y' && matchQ(m)).sort(sortFn);

  // JSON 파일 내보내기/가져오기
  const fileRef = useRef<HTMLInputElement>(null);
  const exportJson = () => {
    const blob = new Blob([getContent()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(name || type).replace(/[\\/:*?"<>|]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        JSON.parse(text); // 형식 검증
        const nm = f.name.replace(/\.json$/i, '');
        onLoad(text, nm);
        setName(nm);
        setCurrentId(null);   // 가져온 것은 새 작업(미저장)
        setOwnerCd(null);
        setShared(false);
        setTags('');
        toast.success(`'${nm}' 가져옴 (저장 시 내 작업으로 추가됩니다)`);
      } catch {
        toast.error('JSON 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-2" ref={ref}>
      <input
        className="dk-input w-40 !py-1.5"
        placeholder="작업 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="dk-input w-28 !py-1.5"
        placeholder="태그(쉼표)"
        title="쉼표로 구분한 태그 (검색 가능)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none whitespace-nowrap"
        title={isMine ? '이 작업을 다른 사용자에게 공유' : '남의 작업은 공유 설정을 바꿀 수 없습니다'}>
        <input type="checkbox" checked={shared} onChange={toggleShare} disabled={!isMine} /> 공유
      </label>
      <button className="dk-btn-primary !py-1.5" onClick={save} disabled={busy}>
        {!currentId ? '새로 저장' : isMine ? '저장' : '복제 저장'}
      </button>
      <div className="relative">
        <button className="dk-btn-secondary !py-1.5" onClick={() => { setOpen((o) => !o); if (!open) refresh(); }}>
          열기 ▾
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-100 rounded-lg shadow-xl z-50 overflow-hidden dark:bg-[#162033] dark:border-[#243149]">
            <button className="w-full text-left px-3 py-2 text-sm text-dk-blue hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-[#243149]" onClick={newDoc}>
              + 새 작업
            </button>
            <div className="flex items-center gap-1 p-2 border-b border-gray-50 dark:border-[#243149]">
              <input className="dk-input flex-1 !py-1 text-xs" placeholder="이름/태그 검색…" value={q}
                onChange={(e) => setQ(e.target.value)} autoFocus />
              <button onClick={() => setSort((s) => (s === 'updated' ? 'name' : 'updated'))}
                className="text-[11px] text-gray-500 dark:text-gray-300 hover:text-dk-blue px-2 py-1 rounded whitespace-nowrap"
                title="정렬 전환">
                {sort === 'updated' ? '최신순' : '이름순'}
              </button>
            </div>
            <div className="max-h-80 overflow-auto">
              <Section title="내 작업" items={mineList} currentId={currentId} onPick={load} onDelete={remove} onFav={toggleFav} canDelete={canDelete} showOwner={false} />
              <Section title="공유됨" items={sharedList} currentId={currentId} onPick={load} onDelete={remove} onFav={toggleFav} canDelete={canDelete} showOwner />
              {list.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">저장된 작업이 없습니다.</div>}
            </div>
            <div className="flex border-t border-gray-50 dark:border-[#243149] text-xs">
              <button className="flex-1 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5" onClick={exportJson}>
                JSON 내보내기
              </button>
              <button className="flex-1 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-l border-gray-50 dark:border-[#243149]" onClick={() => fileRef.current?.click()}>
                JSON 가져오기
              </button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importJson} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title, items, currentId, onPick, onDelete, onFav, canDelete, showOwner,
}: {
  title: string;
  items: ProjectMeta[];
  currentId: string | null;
  onPick: (m: ProjectMeta) => void;
  onDelete: (m: ProjectMeta, e: React.MouseEvent) => void;
  onFav: (m: ProjectMeta, e: React.MouseEvent) => void;
  canDelete: (m: ProjectMeta) => boolean | undefined;
  showOwner: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-gray-400 bg-gray-50/60 dark:bg-white/5">{title}</div>
      {items.map((m) => {
        const fav = m.is_favorite === 'Y';
        const tagList = (m.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
        return (
          <div key={m.id} onClick={() => onPick(m)}
            className={`group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${m.id === currentId ? 'bg-dk-blue/5' : ''}`}>
            <button onClick={(e) => onFav(m, e)} title={fav ? '즐겨찾기 해제' : '즐겨찾기'}
              className={`shrink-0 text-base leading-none ${fav ? 'text-dk-orange' : 'text-gray-300 hover:text-dk-orange'}`}>
              {fav ? '★' : '☆'}
            </button>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-gray-700 dark:text-gray-100">
                {m.name}
                {m.is_shared === 'Y' && <span className="ml-1 text-[10px] text-dk-cyan">공유</span>}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                {showOwner && m.owner_nm ? <span>{m.owner_nm} ·</span> : null}
                <span className="truncate">{m.updated_at}</span>
                {tagList.map((t) => (
                  <span key={t} className="px-1.5 rounded-full bg-gray-100 dark:bg-[#243149] text-gray-500 dark:text-gray-300 whitespace-nowrap">#{t}</span>
                ))}
              </span>
            </span>
            {canDelete(m) && (
              <button onClick={(e) => onDelete(m, e)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-dk-red text-xs px-1 shrink-0">
                삭제
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
