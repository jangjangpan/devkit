import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { json } from '@codemirror/lang-json';
import { java } from '@codemirror/lang-java';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import type { Extension } from '@codemirror/state';
import Layout from '../components/Layout';
import Markdown from '../components/Markdown';
import { noteApi, systemConfigApi, errorMessage, type NoteMeta, type NoteScope } from '../api/client';
import { useDark } from '../theme/DarkContext';
import { useAuth } from '../auth/AuthContext';

const CODE_LANGS = ['javascript', 'typescript', 'python', 'sql', 'json', 'java', 'html', 'css', 'xml', 'text'];

function langExt(lang: string, wrap: boolean): Extension[] {
  const base: Extension[] = [];
  switch (lang) {
    case 'javascript': base.push(javascript()); break;
    case 'typescript': base.push(javascript({ typescript: true })); break;
    case 'python': base.push(python()); break;
    case 'sql': base.push(sql()); break;
    case 'json': base.push(json()); break;
    case 'java': base.push(java()); break;
    case 'html': base.push(html()); break;
    case 'css': base.push(css()); break;
    case 'xml': base.push(xml()); break;
  }
  if (wrap) base.push(EditorView.lineWrapping);
  return base;
}

type BlockTheme = 'auto' | 'light' | 'dark';
type BlockType = 'text' | 'code' | 'image';
type Block = { id: string; type: BlockType; lang?: string; value: string; wrap?: boolean; theme?: BlockTheme; w?: number };
type DropPos = 'before' | 'after';

let _bid = 0;
const newId = () => `b${Date.now().toString(36)}${_bid++}`;
const mkText = (v = ''): Block => ({ id: newId(), type: 'text', value: v });
const mkCode = (v = '', lang = 'sql'): Block => ({ id: newId(), type: 'code', lang, value: v, wrap: false, theme: 'auto' });
// value = 이미지 data URL(base64). w = 표시 폭(%). 기본 100%.
const mkImage = (dataUrl: string): Block => ({ id: newId(), type: 'image', value: dataUrl, w: 100 });

// 붙여넣은/선택한 이미지를 data URL로 변환. 1600px 초과 시 캔버스로 축소해 용량을 억제한다.
async function processImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error('read fail'));
    fr.readAsDataURL(file);
  });
  const MAX = 1600;
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('decode fail'));
      im.src = dataUrl;
    });
    if (Math.max(img.width, img.height) <= MAX) return dataUrl;
    const scale = MAX / Math.max(img.width, img.height);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    const outType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
    return canvas.toDataURL(outType, 0.9);
  } catch {
    return dataUrl;  // 축소 실패 시 원본 유지
  }
}

function toBlocks(lang: string, content: string): Block[] {
  if (lang === 'blocks') {
    try {
      const o = JSON.parse(content);
      if (o && Array.isArray(o.blocks) && o.blocks.length) {
        return o.blocks.map((b: Block) => ({
          id: newId(), type: b.type === 'code' ? 'code' : b.type === 'image' ? 'image' : 'text',
          lang: b.lang, value: typeof b.value === 'string' ? b.value : '',
          wrap: !!b.wrap, theme: (b.theme as BlockTheme) || 'auto',
          w: typeof b.w === 'number' ? b.w : undefined,
        }));
      }
    } catch { /* fallthrough */ }
    return [mkText('')];
  }
  if (lang && lang !== 'text' && CODE_LANGS.indexOf(lang) >= 0) return [mkCode(content || '', lang)];
  return [mkText(content || '')];
}

const serialize = (blocks: Block[]) =>
  JSON.stringify({ v: 1, blocks: blocks.map((b) => ({ type: b.type, lang: b.lang, value: b.value, wrap: b.wrap, theme: b.theme, w: b.w })) });

// 슬래시 명령: 텍스트(insert 프리픽스) / 코드(code)
const SLASH: { k: string; label: string; hint: string; insert?: string; code?: boolean }[] = [
  { k: 'h1', label: '제목 1', hint: '#', insert: '# ' },
  { k: 'h2', label: '제목 2', hint: '##', insert: '## ' },
  { k: 'h3', label: '제목 3', hint: '###', insert: '### ' },
  { k: 'ul', label: '목록', hint: '-', insert: '- ' },
  { k: 'ol', label: '번호 목록', hint: '1.', insert: '1. ' },
  { k: 'quote', label: '인용', hint: '>', insert: '> ' },
  { k: 'hr', label: '구분선', hint: '---', insert: '---\n' },
  { k: 'table', label: '표', hint: '⊞', insert: '| 제목1 | 제목2 |\n| --- | --- |\n| 값1 | 값2 |\n| 값3 | 값4 |\n' },
  { k: 'code', label: '코드 블록', hint: '{ }', code: true },
];

// 엑셀/스프레드시트 붙여넣기(TSV) → 마크다운 표. 탭이 없으면 null(일반 붙여넣기).
function tsvToTable(text: string): string | null {
  if (!text || text.indexOf('\t') < 0) return null;
  const lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  if (lines.length === 0) return null;
  const rows = lines.map((l) => l.split('\t'));
  const cols = Math.max(...rows.map((r) => r.length));
  if (cols < 2) return null;
  const esc = (c: string) => c.replace(/\|/g, '\\|').trim();
  const pad = (r: string[]) => { const a = r.slice(); while (a.length < cols) a.push(''); return a; };
  const mkRow = (r: string[]) => '| ' + pad(r).map(esc).join(' | ') + ' |';
  const md = [mkRow(rows[0]), '| ' + Array(cols).fill('---').join(' | ') + ' |'];
  for (let i = 1; i < rows.length; i++) md.push(mkRow(rows[i]));
  return md.join('\n');
}

export default function NotesPage() {
  const { dark } = useDark();
  const { user } = useAuth();
  const meCd = user?.userCd || '';
  const [list, setList] = useState<NoteMeta[]>([]);
  const [scope, setScope] = useState<NoteScope>('all');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ownerCd, setOwnerCd] = useState<string | null>(null);
  const [title, setTitle] = useState('새 메모');
  const [blocks, setBlocks] = useState<Block[]>([mkText('')]);
  const [shared, setShared] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [over, setOver] = useState<{ idx: number; pos: DropPos } | null>(null);
  const [adminEditShared, setAdminEditShared] = useState(false);  // 시스템 설정 플래그
  const [origShared, setOrigShared] = useState(false);            // 열 때의 원본 공유 여부
  const [listW, setListW] = useState(() => {                      // 좌측 목록 너비(px) — 스플리터로 조절
    const v = parseInt(localStorage.getItem('devkit_notes_listw') || '', 10);
    return isNaN(v) ? 240 : Math.max(180, Math.min(560, v));
  });
  useEffect(() => { localStorage.setItem('devkit_notes_listw', String(listW)); }, [listW]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX; const startW = listW;
    const move = (ev: MouseEvent) => setListW(Math.max(180, Math.min(560, startW + ev.clientX - startX)));
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.body.style.userSelect = ''; document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  };

  const isMine = !currentId || ownerCd === meCd;
  // 관리자가 (플래그 ON) 공유된 남의 메모를 원본째 수정 가능한지
  const canEditOriginal = isMine || (!!user?.isAdmin && adminEditShared && origShared);

  const reload = async (sc: NoteScope = scope) => { try { setList(await noteApi.list(sc)); } catch (e) { toast.error(errorMessage(e)); } };
  useEffect(() => { reload(scope); /* eslint-disable-next-line */ }, [scope]);
  useEffect(() => { systemConfigApi.get().then((c) => setAdminEditShared(c.adminEditShared)).catch(() => {}); }, []);

  const newNote = () => { setCurrentId(null); setOwnerCd(null); setTitle('새 메모'); setBlocks([mkText('')]); setShared(false); setOrigShared(false); setDirty(false); setPreview(false); };

  const open = async (m: NoteMeta) => {
    try {
      const n = await noteApi.get(m.id);
      setCurrentId(n.id); setOwnerCd(n.user_cd); setTitle(n.title);
      setBlocks(toBlocks(n.lang || 'text', n.content || '')); setShared(n.is_shared === 'Y'); setOrigShared(n.is_shared === 'Y');
      setDirty(false); setPreview(true);
      if (n.user_cd !== meCd) {
        if (!!user?.isAdmin && adminEditShared && n.is_shared === 'Y') {
          toast(`'${n.owner_nm || n.user_cd}'님의 공유 메모 · 관리자 권한으로 원본을 수정합니다`, { icon: '🛠️' });
        } else {
          toast(`'${n.owner_nm || n.user_cd}'님의 공유 메모 · 저장 시 내 메모로 복제됩니다`, { icon: '🔗' });
        }
      }
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const save = async () => {
    try {
      const body = { title: title.trim() || '제목 없음', lang: 'blocks', content: serialize(blocks), isShared: shared };
      if (currentId && canEditOriginal) { await noteApi.update(currentId, body); toast.success(isMine ? '저장했습니다.' : '공유 메모(원본)를 수정했습니다.'); }
      else {
        const r = await noteApi.create(body); setCurrentId(r.id); setOwnerCd(meCd); setOrigShared(shared);
        toast.success(currentId ? '내 메모로 복제 저장했습니다.' : '새 메모를 저장했습니다.');
      }
      setDirty(false); reload();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const remove = async (m: NoteMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`'${m.title}' 메모를 삭제할까요?`)) return;
    try {
      await noteApi.remove(m.id);
      if (m.id === currentId) newNote();
      reload(); toast.success('삭제했습니다.');
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const touch = () => setDirty(true);
  const patchBlock = (id: string, p: Partial<Block>) => { setBlocks((a) => a.map((b) => (b.id === id ? { ...b, ...p } : b))); touch(); };
  const addBlock = (type: 'text' | 'code', afterIdx: number) => {
    setBlocks((a) => { const c = a.slice(); c.splice(afterIdx + 1, 0, type === 'code' ? mkCode() : mkText()); return c; });
    touch(); setPreview(false);
  };
  const delBlock = (id: string) => { setBlocks((a) => (a.length <= 1 ? [mkText('')] : a.filter((b) => b.id !== id))); touch(); };
  const moveBy = (idx: number, d: -1 | 1) => {
    setBlocks((a) => { const j = idx + d; if (j < 0 || j >= a.length) return a; const c = a.slice(); [c[idx], c[j]] = [c[j], c[idx]]; return c; });
    touch();
  };
  // 드롭: from 블록을 idx 블록의 before/after 위치로 이동
  const dropAt = (from: number, idx: number, pos: DropPos) => {
    setBlocks((a) => {
      let to = pos === 'after' ? idx + 1 : idx;
      if (from < 0 || from >= a.length) return a;
      const c = a.slice(); const [m] = c.splice(from, 1);
      if (from < to) to--;
      to = Math.max(0, Math.min(to, c.length));
      c.splice(to, 0, m); return c;
    });
    touch();
  };
  // 텍스트 블록 안에서 '코드 블록' 명령: before/after 텍스트로 분할 + 코드 블록 삽입
  const insertCode = (id: string, before: string, after: string) => {
    setBlocks((a) => {
      const i = a.findIndex((b) => b.id === id); if (i < 0) return a;
      const cur = a[i];
      const parts: Block[] = [];
      if (before.trim() !== '') parts.push({ ...cur, id: newId(), value: before });
      parts.push(mkCode());
      if (after.trim() !== '') parts.push(mkText(after));
      const c = a.slice(); c.splice(i, 1, ...parts); return c;
    });
    touch(); setPreview(false);
  };

  // 텍스트 블록에 이미지 붙여넣기/삽입: caret 기준 before/after 분할 + 이미지 블록 삽입
  const insertImage = async (id: string, before: string, after: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 12 * 1024 * 1024) { toast.error('이미지가 너무 큽니다 (12MB 이하).'); return; }
    let dataUrl: string;
    try { dataUrl = await processImageFile(file); } catch { toast.error('이미지를 읽지 못했습니다.'); return; }
    setBlocks((a) => {
      const i = a.findIndex((b) => b.id === id); if (i < 0) return a;
      const cur = a[i];
      const parts: Block[] = [];
      if (before.trim() !== '') parts.push({ ...cur, id: newId(), value: before });
      parts.push(mkImage(dataUrl));
      parts.push(after.trim() !== '' ? mkText(after) : mkText(''));  // 이미지 뒤 계속 입력 가능하도록
      const c = a.slice(); c.splice(i, 1, ...parts); return c;
    });
    touch(); setPreview(false);
  };

  // '+ 이미지' 버튼(파일 선택)으로 idx 블록 뒤에 이미지 블록 추가
  const addImageBlock = async (afterIdx: number, file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 12 * 1024 * 1024) { toast.error('이미지가 너무 큽니다 (12MB 이하).'); return; }
    let dataUrl: string;
    try { dataUrl = await processImageFile(file); } catch { toast.error('이미지를 읽지 못했습니다.'); return; }
    setBlocks((a) => { const c = a.slice(); c.splice(afterIdx + 1, 0, mkImage(dataUrl)); return c; });
    touch(); setPreview(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  };

  const actions = (
    <>
      <input className="dk-input !py-1.5 w-52" value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} placeholder="메모 제목" />
      <div className="flex rounded overflow-hidden border border-gray-200 dark:border-[#2A3953]">
        {([['edit', '편집'], ['preview', '미리보기']] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setPreview(k === 'preview')}
            className={`px-3 py-1.5 text-sm font-medium ${(k === 'preview') === preview ? 'bg-dk-blue text-white' : 'bg-white text-gray-600 dark:bg-[#162033] dark:text-gray-300'}`}>{lbl}</button>
        ))}
      </div>
      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300 cursor-pointer whitespace-nowrap"
        title={canEditOriginal ? '이 메모를 다른 사용자에게 공유' : '남의 메모는 공유 설정을 바꿀 수 없습니다'}>
        <input type="checkbox" checked={shared} disabled={!canEditOriginal} onChange={(e) => { setShared(e.target.checked); touch(); }} /> 공유
      </label>
      <button className="dk-btn-primary !py-1.5 whitespace-nowrap" onClick={save}>
        {!currentId ? '새로 저장' : canEditOriginal ? (isMine ? '저장' : '공유 원본 저장') : '복제 저장'}{dirty ? ' *' : ''}
      </button>
    </>
  );

  return (
    <Layout title="개발 메모" subtitle="블록 문서 · 텍스트(마크다운) + 코드 스니펫 · 드래그 정렬 · / 명령 · Ctrl+S" actions={actions} flush>
      <div className="flex h-full" onKeyDown={onKey}>
        {/* 목록 */}
        <div style={{ width: listW }} className="shrink-0 border-r border-gray-100 dark:border-[#243149] bg-white dark:bg-[#162033] flex flex-col">
          <button className="m-2 dk-btn-secondary !py-1.5 text-xs" onClick={newNote}>+ 새 메모</button>
          <div className="px-2 pb-2 flex items-center gap-1 bg-gray-100/60 dark:bg-[#243149] mx-2 rounded p-0.5">
            {([['all', '전체'], ['mine', '내 메모'], ['shared', '공유됨']] as [NoteScope, string][]).map(([sc, label]) => (
              <button key={sc} onClick={() => setScope(sc)}
                className={`flex-1 px-2 py-1 rounded text-[11px] font-medium ${scope === sc ? 'bg-white dark:bg-[#0F1A2D] text-dk-blue shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>{label}</button>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {list.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">메모가 없습니다.</div>}
            {list.map((m) => {
              const mine = m.user_cd === meCd;
              const canDelete = mine || (!!user?.isAdmin && m.is_shared === 'Y'); // 관리자는 공유 메모 삭제 가능
              return (
                <div key={m.id} onClick={() => open(m)}
                  className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${m.id === currentId ? 'bg-dk-blue/5' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-sm text-gray-700 dark:text-gray-100">{m.title}</span>
                      {m.is_shared === 'Y' && <span className="shrink-0 text-[10px] text-dk-cyan bg-dk-cyan/10 px-1 rounded leading-tight">공유</span>}
                    </span>
                    <span className="block text-[11px] text-gray-400 truncate">
                      {!mine && m.owner_nm ? `${m.owner_nm} · ` : ''}{m.lang === 'blocks' ? '문서' : m.lang} · {String(m.updated_at).slice(0, 16)}
                    </span>
                  </span>
                  {canDelete && <button onClick={(e) => remove(m, e)} title={mine ? '삭제' : '관리자 — 공유 메모 삭제'} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-dk-red text-xs px-1 shrink-0">삭제</button>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 스플리터 (좌/우 너비 조절) */}
        <div onMouseDown={startResize} title="드래그하여 너비 조절"
          className="w-1 shrink-0 cursor-col-resize bg-gray-100 dark:bg-[#243149] hover:bg-dk-blue/50 active:bg-dk-blue transition-colors" />

        {/* 문서(블록) */}
        <div className="flex-1 min-w-0 overflow-auto bg-gray-50 dark:bg-[#0F1A2D]">
          <div className="w-full px-6 py-5 space-y-1">
            {blocks.map((b, idx) => (
              <BlockView
                key={b.id} block={b} idx={idx} total={blocks.length} preview={preview} dark={dark}
                dropLine={over && over.idx === idx && dragIdx !== null && dragIdx !== idx ? over.pos : null}
                onChange={(p) => patchBlock(b.id, p)} onDelete={() => delBlock(b.id)} onMove={(d) => moveBy(idx, d)}
                onAdd={(t) => addBlock(t, idx)} onInsertCode={(before, after) => insertCode(b.id, before, after)}
                onInsertImage={(before, after, file) => insertImage(b.id, before, after, file)}
                onAddImage={(file) => addImageBlock(idx, file)}
                onDragStart={() => setDragIdx(idx)} onDragEnd={() => { setDragIdx(null); setOver(null); }}
                onDragOver={(pos) => setOver({ idx, pos })}
                onDrop={() => { if (dragIdx !== null && over) dropAt(dragIdx, over.idx, over.pos); setDragIdx(null); setOver(null); }}
              />
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function BlockView({ block, idx, total, preview, dark, dropLine, onChange, onDelete, onMove, onAdd, onInsertCode, onInsertImage, onAddImage, onDragStart, onDragEnd, onDragOver, onDrop }: {
  block: Block; idx: number; total: number; preview: boolean; dark: boolean; dropLine: DropPos | null;
  onChange: (p: Partial<Block>) => void; onDelete: () => void; onMove: (d: -1 | 1) => void; onAdd: (t: 'text' | 'code') => void;
  onInsertCode: (before: string, after: string) => void;
  onInsertImage: (before: string, after: string, file: File) => void;
  onAddImage: (file: File) => void;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: (pos: DropPos) => void; onDrop: () => void;
}) {
  const copy = async () => { try { await navigator.clipboard.writeText(block.value); toast.success('복사했습니다.'); } catch { toast.error('복사 실패'); } };
  const cmTheme = block.theme && block.theme !== 'auto' ? block.theme : (dark ? 'dark' : 'light');
  const imgFileRef = useRef<HTMLInputElement>(null);

  if (preview) {
    if (block.type === 'image') {
      return <div className="py-1"><img src={block.value} alt="" className="rounded-lg border border-gray-200 dark:border-[#243149]" style={{ width: `${block.w || 100}%`, maxWidth: '100%' }} /></div>;
    }
    if (block.type === 'code') {
      return (
        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-[#243149]">
          <div className="flex items-center justify-between px-3 py-1 bg-[#1b2942] text-[11px] text-gray-300">
            <span className="font-mono">{block.lang}</span>
            <button onClick={copy} className="hover:text-white">복사</button>
          </div>
          <CodeMirror value={block.value} theme={cmTheme} editable={false} extensions={langExt(block.lang || 'text', !!block.wrap)}
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }} style={{ fontSize: 12.5 }} />
        </div>
      );
    }
    if (!block.value.trim()) return null;
    return <div className="py-0.5"><Markdown text={block.value} /></div>;
  }

  // 편집 모드
  return (
    <div className="group relative"
      onDragOver={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onDragOver(e.clientY - r.top < r.height / 2 ? 'before' : 'after'); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}>
      {dropLine === 'before' && <div className="absolute -top-1 left-0 right-0 h-0.5 bg-dk-blue rounded z-10" />}
      {dropLine === 'after' && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-dk-blue rounded z-10" />}
      <div className="flex items-start gap-1.5">
        {/* 드래그 핸들 + 컨트롤 */}
        <div className="flex flex-col items-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
            title="드래그하여 이동" className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 select-none leading-none">⠿</span>
          <button title="위로" className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 text-xs leading-none disabled:opacity-30" disabled={idx === 0} onClick={() => onMove(-1)}>↑</button>
          <button title="아래로" className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 text-xs leading-none disabled:opacity-30" disabled={idx === total - 1} onClick={() => onMove(1)}>↓</button>
          <button title="삭제" className="text-gray-300 hover:text-dk-red text-xs leading-none" onClick={onDelete}>✕</button>
        </div>

        <div className="flex-1 min-w-0">
          {block.type === 'text' ? (
            <TextBlock block={block} onChange={onChange} onInsertCode={onInsertCode} onInsertImage={onInsertImage} />
          ) : block.type === 'image' ? (
            <div className="rounded-md overflow-hidden border border-gray-200 dark:border-[#2A3953]">
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-[#1b2942] text-[11px] text-gray-500 dark:text-gray-300">
                <span>이미지</span>
                <label className="flex items-center gap-1 ml-auto" title="표시 폭">
                  크기
                  <select className="bg-transparent outline-none" value={block.w || 100} onChange={(e) => onChange({ w: Number(e.target.value) })}>
                    <option value={100}>100%</option>
                    <option value={75}>75%</option>
                    <option value={50}>50%</option>
                    <option value={25}>25%</option>
                  </select>
                </label>
              </div>
              <div className="p-2 bg-white dark:bg-[#162033]">
                <img src={block.value} alt="" className="rounded" style={{ width: `${block.w || 100}%`, maxWidth: '100%' }} />
              </div>
            </div>
          ) : (
            <div className="rounded-md overflow-hidden border border-gray-200 dark:border-[#2A3953]">
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-[#1b2942] text-[11px]">
                <select className="bg-transparent text-gray-600 dark:text-gray-300 outline-none" value={block.lang || 'text'} onChange={(e) => onChange({ lang: e.target.value })}>
                  {CODE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <label className="flex items-center gap-1 text-gray-500 dark:text-gray-300 cursor-pointer" title="긴 줄 자동 줄바꿈">
                  <input type="checkbox" checked={!!block.wrap} onChange={(e) => onChange({ wrap: e.target.checked })} /> 줄바꿈
                </label>
                <select className="bg-transparent text-gray-500 dark:text-gray-300 outline-none" value={block.theme || 'auto'} onChange={(e) => onChange({ theme: e.target.value as BlockTheme })} title="코드 블록 테마">
                  <option value="auto">테마: 자동</option>
                  <option value="light">라이트</option>
                  <option value="dark">다크</option>
                </select>
                <button onClick={copy} className="ml-auto text-gray-500 dark:text-gray-300 hover:text-dk-blue">복사</button>
              </div>
              <CodeMirror value={block.value} theme={cmTheme} extensions={langExt(block.lang || 'text', !!block.wrap)}
                onChange={(v) => onChange({ value: v })} basicSetup={{ foldGutter: false }} style={{ fontSize: 12.5 }} />
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 ml-7 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="text-[11px] text-gray-400 hover:text-dk-blue" onClick={() => onAdd('text')}>+ 텍스트</button>
        <button className="text-[11px] text-gray-400 hover:text-dk-blue" onClick={() => onAdd('code')}>+ 코드</button>
        <button className="text-[11px] text-gray-400 hover:text-dk-blue" onClick={() => imgFileRef.current?.click()}>+ 이미지</button>
        <input ref={imgFileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddImage(f); e.currentTarget.value = ''; }} />
      </div>
    </div>
  );
}

// 텍스트 블록 — 자동 높이 + '/' 슬래시 명령(빈 줄 어디서나, 키보드 탐색)
function TextBlock({ block, onChange, onInsertCode, onInsertImage }: { block: Block; onChange: (p: Partial<Block>) => void; onInsertCode: (before: string, after: string) => void; onInsertImage: (before: string, after: string, file: File) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [slash, setSlash] = useState<{ lineStart: number; lineEnd: number } | null>(null);
  const [sel, setSel] = useState(0);
  const openRef = useRef(false);

  // 현재 캐럿이 위치한 줄이 정확히 '/' 이면 메뉴 오픈
  const detect = () => {
    const ta = taRef.current; if (!ta) { return; }
    const pos = ta.selectionStart; const v = ta.value;
    const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = v.indexOf('\n', pos); if (lineEnd < 0) lineEnd = v.length;
    if (v.slice(lineStart, lineEnd) === '/') {
      if (!openRef.current) setSel(0);  // 새로 열릴 때만 선택 초기화
      openRef.current = true; setSlash({ lineStart, lineEnd });
    } else { openRef.current = false; setSlash(null); }
  };

  const closeSlash = () => { openRef.current = false; setSlash(null); };

  const apply = (item: typeof SLASH[number]) => {
    if (!slash) return;
    const v = block.value;
    if (item.code) {
      const before = v.slice(0, slash.lineStart).replace(/\n$/, '');
      const after = v.slice(slash.lineEnd).replace(/^\n/, '');
      closeSlash();
      onInsertCode(before, after);
      return;
    }
    const next = v.slice(0, slash.lineStart) + (item.insert || '') + v.slice(slash.lineEnd);
    const caret = slash.lineStart + (item.insert || '').length;
    closeSlash();
    onChange({ value: next });
    setTimeout(() => { const ta = taRef.current; if (ta) { ta.focus(); ta.setSelectionRange(caret, caret); } }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={block.value}
        onChange={(e) => { onChange({ value: e.target.value }); requestAnimationFrame(detect); }}
        onPaste={(e) => {
          const ta = e.currentTarget;
          const s = ta.selectionStart, en = ta.selectionEnd;
          // 1) 클립보드에 이미지가 있으면 이미지 블록으로 삽입
          const items = e.clipboardData.items;
          for (let ii = 0; ii < items.length; ii++) {
            if (items[ii].type.indexOf('image/') === 0) {
              const file = items[ii].getAsFile();
              if (file) {
                e.preventDefault();
                onInsertImage(block.value.slice(0, s), block.value.slice(en), file);
                return;
              }
            }
          }
          // 2) 엑셀/스프레드시트(TSV) → 마크다운 표
          const md = tsvToTable(e.clipboardData.getData('text/plain'));
          if (!md) return;  // 표 형태가 아니면 일반 텍스트 붙여넣기
          e.preventDefault();
          const before = block.value.slice(0, s);
          const insert = (before.length > 0 && !before.endsWith('\n') ? '\n' : '') + md + '\n';
          const nv = before + insert + block.value.slice(en);
          onChange({ value: nv });
          const pos = s + insert.length;
          setTimeout(() => { ta.focus(); ta.setSelectionRange(pos, pos); }, 0);
        }}
        onKeyUp={() => { if (!slash) detect(); }}
        onClick={() => detect()}
        onKeyDown={(e) => {
          if (!slash) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % SLASH.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + SLASH.length) % SLASH.length); }
          else if (e.key === 'Enter') { e.preventDefault(); apply(SLASH[sel]); }
          else if (e.key === 'Escape') { e.preventDefault(); apply({ k: '', label: '', hint: '', insert: '' }); /* '/'를 빈 줄로 */ }
        }}
        placeholder="텍스트 입력 — 마크다운(# 제목, - 목록, **굵게**, `코드`) · 빈 줄에서 '/' 입력 시 블록 명령"
        rows={Math.max(2, block.value.split('\n').length)}
        className="w-full resize-none rounded-md border border-gray-200 dark:border-[#2A3953] bg-white dark:bg-[#162033] p-2.5 text-[13px] leading-relaxed text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-dk-blue/40"
      />
      {slash && (
        <div className="absolute z-20 left-2 top-11 w-52 bg-white dark:bg-[#162033] border border-gray-200 dark:border-[#2A3953] rounded-md shadow-lg py-1">
          <div className="px-3 py-1 text-[10px] text-gray-400">블록 삽입 (↑↓ 선택 · Enter)</div>
          {SLASH.map((s, i) => (
            <button key={s.k} onMouseDown={(e) => { e.preventDefault(); apply(s); }} onMouseEnter={() => setSel(i)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-sm ${i === sel ? 'bg-dk-blue/10 text-dk-blue' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              <span>{s.label}</span><span className="text-[11px] text-gray-400 font-mono">{s.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
