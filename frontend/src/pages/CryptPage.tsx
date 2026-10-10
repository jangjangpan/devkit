import { useState, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import CryptoJS from 'crypto-js';
import Layout from '../components/Layout';
import { errorMessage } from '../api/client';

// ── 사진 변환 유틸 ─────────────────────────────────────────────
const readDataUrl = (file: File) =>
  new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('read fail')); fr.readAsDataURL(file); });

const copyText = async (t: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
};

const MIME_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg', 'image/x-icon': 'ico',
};
const extFromMime = (m: string) => MIME_EXT[m] || 'png';

// base64 앞부분을 디코드해 이미지 시그니처(매직바이트)로 MIME 추정
function sniffMime(b64: string): string {
  try {
    const bin = atob(b64.slice(0, 32));
    if (bin.charCodeAt(0) === 0x89 && bin.slice(1, 4) === 'PNG') return 'image/png';
    if (bin.charCodeAt(0) === 0xff && bin.charCodeAt(1) === 0xd8) return 'image/jpeg';
    if (bin.slice(0, 3) === 'GIF') return 'image/gif';
    if (bin.slice(0, 4) === 'RIFF' && bin.slice(8, 12) === 'WEBP') return 'image/webp';
    if (bin.slice(0, 2) === 'BM') return 'image/bmp';
    if (bin.slice(0, 5) === '<?xml' || bin.slice(0, 4) === '<svg') return 'image/svg+xml';
  } catch { /* ignore */ }
  return '';
}

// data URL / 순수 base64 / `<img src="data:...">` HTML 모두 허용
function parseB64Input(text: string): { mime: string; b64: string; dataUrl: string } | null {
  const t = (text || '').trim();
  if (!t) return null;
  const m = t.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,\s*([A-Za-z0-9+/=\s]+)/);
  let mime = '', b64 = '';
  if (m) { mime = m[1]; b64 = m[2]; } else { b64 = t; }
  b64 = b64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length < 8) return null;
  const padded = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
  try { atob(padded.slice(0, 64)); } catch { return null; }
  if (!mime) mime = sniffMime(padded) || 'image/png';
  return { mime, b64: padded, dataUrl: `data:${mime};base64,${padded}` };
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`);

type Algo = 'base64' | 'hex' | 'url' | 'aes' | 'hmac' | 'md5' | 'sha1' | 'sha256' | 'sha512';
interface AlgoDef { id: Algo; label: string; kind: 'codec' | 'hash' | 'key'; needsKey?: boolean; }
const ALGOS: AlgoDef[] = [
  { id: 'base64', label: 'Base64', kind: 'codec' },
  { id: 'hex', label: 'Hex', kind: 'codec' },
  { id: 'url', label: 'URL 인코딩', kind: 'codec' },
  { id: 'aes', label: 'AES (대칭키)', kind: 'key', needsKey: true },
  { id: 'hmac', label: 'HMAC-SHA256', kind: 'key', needsKey: true },
  { id: 'md5', label: 'MD5 (해시)', kind: 'hash' },
  { id: 'sha1', label: 'SHA-1 (해시)', kind: 'hash' },
  { id: 'sha256', label: 'SHA-256 (해시)', kind: 'hash' },
  { id: 'sha512', label: 'SHA-512 (해시)', kind: 'hash' },
];

type CopyFmt = 'dataurl' | 'base64' | 'imgtag';

// 사진 변환 패널: 이미지 → Base64(업로드 시 자동 복사) / Base64 → 이미지(붙여넣기 시 자동 다운로드)
function ImageConvert() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<{ dataUrl: string; mime: string; name: string; size: number } | null>(null);
  const [copyFmt, setCopyFmt] = useState<CopyFmt>('dataurl');
  const [b64Input, setB64Input] = useState('');
  const [dlName, setDlName] = useState('image');
  const [drag, setDrag] = useState(false);

  const buildOut = (fmt: CopyFmt, dataUrl: string): string => {
    if (fmt === 'base64') { const c = dataUrl.indexOf(','); return c >= 0 ? dataUrl.slice(c + 1) : ''; }
    if (fmt === 'imgtag') return `<img src="${dataUrl}" />`;
    return dataUrl;
  };
  // 대용량 문자열을 매 렌더마다 새로 만들지 않도록 메모이즈
  const outText = useMemo(() => (img ? buildOut(copyFmt, img.dataUrl) : ''), [img, copyFmt]);
  // ★ textarea에 수천만 자를 그대로 렌더하면 브라우저가 죽음 → 화면엔 앞부분만, 전체는 복사/다운로드로 제공
  const PREVIEW_MAX = 20000;
  const outPreview = outText.length > PREVIEW_MAX
    ? outText.slice(0, PREVIEW_MAX) + `\n\n… (전체 ${outText.length.toLocaleString()}자 — 화면에는 일부만 표시됩니다. [복사] 또는 [.txt 저장]으로 전체를 사용하세요)`
    : outText;

  // 전체 base64를 텍스트 파일로 저장(클립보드 용량 한계 회피용)
  const downloadText = () => {
    if (!outText) return;
    const base = (img?.name || 'image').replace(/\.[a-z0-9]+$/i, '');
    downloadBlob(new Blob([outText], { type: 'text/plain;charset=utf-8' }), `${base}.base64.txt`);
    toast.success('Base64를 .txt로 저장했습니다.');
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 가능합니다.'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('이미지가 너무 큽니다 (20MB 이하).'); return; }
    let dataUrl: string;
    try { dataUrl = await readDataUrl(file); } catch { toast.error('이미지를 읽지 못했습니다.'); return; }
    setImg({ dataUrl, mime: file.type, name: file.name, size: file.size });
    setDlName((file.name || 'image').replace(/\.[a-z0-9]+$/i, ''));
    const ok = await copyText(buildOut(copyFmt, dataUrl));
    if (ok) toast.success('변환 완료 — 클립보드에 복사됨'); else toast('변환 완료 (자동 복사 실패 — 복사 버튼 사용)', { icon: '⚠️' });
  };

  const changeFmt = async (fmt: CopyFmt) => {
    setCopyFmt(fmt);
    if (img) { const ok = await copyText(buildOut(fmt, img.dataUrl)); if (ok) toast.success('형식 변경 — 클립보드에 복사됨'); }
  };

  const copyOut = async () => { if (outText && (await copyText(outText))) toast.success('복사했습니다.'); };

  // Base64 → 이미지 다운로드
  const doDownload = (text: string, silentFail = false): boolean => {
    const p = parseB64Input(text);
    if (!p) { if (!silentFail) toast.error('유효한 Base64 / 데이터 URL이 아닙니다.'); return false; }
    try {
      const blob = base64ToBlob(p.b64, p.mime);
      const base = (dlName.trim() || 'image').replace(/\.[a-z0-9]+$/i, '');
      downloadBlob(blob, `${base}.${extFromMime(p.mime)}`);
      toast.success('이미지를 다운로드했습니다.');
      return true;
    } catch { if (!silentFail) toast.error('다운로드에 실패했습니다.'); return false; }
  };

  // 붙여넣기 시 자동 다운로드 (유효할 때 1회)
  const onPasteB64 = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (parseB64Input(text)) setTimeout(() => doDownload(text, true), 0);
  };

  const previewUrl = useMemo(() => {
    if (b64Input.length > 6_000_000) return '';  // 초대용량 실시간 미리보기 생략
    return parseB64Input(b64Input)?.dataUrl || '';
  }, [b64Input]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 overflow-auto">
      {/* 이미지 → Base64 */}
      <div className="dk-card flex flex-col overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">
          이미지 → Base64 <span className="font-normal text-gray-400">· 업로드 시 자동 복사</span>
        </div>
        <div className="p-3.5 flex flex-col gap-3 min-h-0 flex-1">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            className={`shrink-0 cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${drag ? 'border-dk-blue bg-dk-blue/5' : 'border-gray-300 dark:border-[#2A3953] hover:border-dk-blue/60'}`}
          >
            <div className="text-gray-500 dark:text-gray-300">클릭하여 이미지 업로드</div>
            <div className="text-[11px] text-gray-400 mt-0.5">또는 파일을 여기로 드래그 · 20MB 이하</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }} />
          </div>
          <div className="flex items-center gap-2 text-xs shrink-0">
            <label className="text-gray-500 dark:text-gray-300">복사 형식</label>
            <select className="dk-input !py-1" value={copyFmt} onChange={(e) => changeFmt(e.target.value as CopyFmt)}>
              <option value="dataurl">데이터 URL (data:image/...;base64,)</option>
              <option value="base64">순수 Base64</option>
              <option value="imgtag">HTML &lt;img&gt; 태그</option>
            </select>
            <button className="dk-btn-secondary !py-1 ml-auto" onClick={copyOut} disabled={!outText}>복사</button>
            <button className="dk-btn-ghost !py-1" onClick={downloadText} disabled={!outText}>.txt 저장</button>
          </div>
          {img && (
            <div className="flex items-center gap-3 shrink-0">
              <img src={img.dataUrl} alt="" className="h-14 w-14 object-cover rounded border border-gray-200 dark:border-[#243149]" />
              <div className="text-[11px] text-gray-500 dark:text-gray-300 leading-relaxed min-w-0">
                <div className="truncate">{img.name}</div>
                <div>{img.mime} · 원본 {fmtBytes(img.size)} · Base64 {fmtBytes(outText.length)}</div>
              </div>
            </div>
          )}
          <textarea readOnly value={outPreview} spellCheck={false} wrap="off" placeholder="변환된 Base64가 여기에 표시됩니다."
            className="flex-1 min-h-[120px] w-full resize-none rounded-md border border-gray-200 dark:border-[#2A3953] p-2.5 font-mono text-[12px] bg-[#0f172a] text-[#e2e8f0] outline-none whitespace-pre overflow-auto" />
        </div>
      </div>

      {/* Base64 → 이미지 */}
      <div className="dk-card flex flex-col overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">
          Base64 → 이미지 <span className="font-normal text-gray-400">· 붙여넣기 시 자동 다운로드</span>
        </div>
        <div className="p-3.5 flex flex-col gap-3 min-h-0 flex-1">
          <textarea value={b64Input} onChange={(e) => setB64Input(e.target.value)} onPaste={onPasteB64} spellCheck={false} wrap="off"
            placeholder={'Base64 또는 data:image/...;base64,... 를 붙여넣으세요.\n붙여넣으면 자동으로 다운로드됩니다.'}
            className="flex-1 min-h-[120px] w-full resize-none rounded-md border border-gray-200 dark:border-[#2A3953] p-2.5 font-mono text-[12px] bg-white dark:bg-[#162033] dark:text-gray-100 outline-none focus:ring-2 focus:ring-dk-blue/40 whitespace-pre overflow-auto" />
          <div className="flex items-center gap-2 text-xs shrink-0">
            <label className="text-gray-500 dark:text-gray-300 shrink-0">파일명</label>
            <input className="dk-input !py-1 flex-1" value={dlName} onChange={(e) => setDlName(e.target.value)} placeholder="image" />
            <button className="dk-btn-primary !py-1 whitespace-nowrap" onClick={() => doDownload(b64Input)} disabled={!b64Input.trim()}>이미지 다운로드</button>
            <button className="dk-btn-ghost !py-1" onClick={() => { setB64Input(''); }}>지우기</button>
          </div>
          <div className="flex-1 min-h-[100px] rounded-md border border-gray-200 dark:border-[#2A3953] bg-gray-50 dark:bg-[#0F1A2D] flex items-center justify-center overflow-auto p-2">
            {previewUrl
              ? <img src={previewUrl} alt="미리보기" className="max-w-full max-h-[240px] object-contain" />
              : <span className="text-[11px] text-gray-400">{b64Input.trim() ? '유효한 이미지 Base64가 아닙니다.' : '미리보기'}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CryptPage() {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [algo, setAlgo] = useState<Algo>('base64');
  const [key, setKey] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const def = ALGOS.find((a) => a.id === algo)!;

  const encode = (): string => {
    switch (algo) {
      case 'base64': return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(input));
      case 'hex': return CryptoJS.enc.Hex.stringify(CryptoJS.enc.Utf8.parse(input));
      case 'url': return encodeURIComponent(input);
      case 'aes': return CryptoJS.AES.encrypt(input, key).toString();
      case 'hmac': return CryptoJS.HmacSHA256(input, key).toString();
      case 'md5': return CryptoJS.MD5(input).toString();
      case 'sha1': return CryptoJS.SHA1(input).toString();
      case 'sha256': return CryptoJS.SHA256(input).toString();
      case 'sha512': return CryptoJS.SHA512(input).toString();
      default: return '';
    }
  };
  const decode = (): string => {
    switch (algo) {
      case 'base64': return CryptoJS.enc.Base64.parse(input).toString(CryptoJS.enc.Utf8);
      case 'hex': return CryptoJS.enc.Hex.parse(input).toString(CryptoJS.enc.Utf8);
      case 'url': return decodeURIComponent(input);
      case 'aes': {
        const r = CryptoJS.AES.decrypt(input, key).toString(CryptoJS.enc.Utf8);
        if (!r) throw new Error('복호화 실패 (키 불일치 또는 형식 오류)');
        return r;
      }
      default: return '';
    }
  };

  const run = async (dir: 'enc' | 'dec') => {
    setOutput('');
    if (!input.trim()) return toast.error('입력값을 입력하세요.');
    if (def.needsKey && !key) return toast.error('키를 입력하세요.');
    try {
      const r = dir === 'enc' ? encode() : decode();
      setOutput(r);
      toast.success('완료');
    } catch (e) {
      toast.error(errorMessage(e) || (e instanceof Error ? e.message : '오류'));
    }
  };

  const copy = async () => { if (output) { await navigator.clipboard.writeText(output); toast.success('복사했습니다.'); } };

  const canDecode = def.kind === 'codec' || algo === 'aes';
  const textActions = (
    <>
      <select className="dk-input !py-1.5" value={algo} onChange={(e) => { setAlgo(e.target.value as Algo); setOutput(''); }}>
        {ALGOS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <button className="dk-btn-secondary !py-1.5" onClick={copy} disabled={!output}>결과 복사</button>
      <button className="dk-btn-primary !py-1.5 whitespace-nowrap" onClick={() => run('enc')}>
        {def.kind === 'hash' ? '해시 생성' : '인코딩/암호화'}
      </button>
      {canDecode && <button className="dk-btn-secondary !py-1.5 whitespace-nowrap" onClick={() => run('dec')}>디코딩/복호화</button>}
    </>
  );

  const tabBar = (
    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-[#162033] p-0.5 text-sm shrink-0 self-start">
      {(['text', 'image'] as const).map((m) => (
        <button key={m} onClick={() => setMode(m)}
          className={`px-4 py-1.5 rounded-md font-medium transition-colors ${mode === m ? 'bg-white dark:bg-[#0F1A2D] text-dk-blue shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>
          {m === 'text' ? '텍스트' : '사진 변환'}
        </button>
      ))}
    </div>
  );

  return (
    <Layout
      title="암호화 / 복호화"
      subtitle={mode === 'text' ? 'Base64 · Hex · URL · AES · HMAC · MD5/SHA' : '이미지 ↔ Base64 변환 · 업로드 시 자동 복사 · Base64 붙여넣기 시 다운로드'}
      actions={mode === 'text' ? textActions : undefined}
    >
      {mode === 'image' ? (
        <div className="flex flex-col h-full gap-3">
          {tabBar}
          <ImageConvert />
        </div>
      ) : (
      <div className="flex flex-col h-full gap-3 max-w-5xl">
        {tabBar}
        {def.needsKey && (
          <input className="dk-input w-full font-mono shrink-0" type={algo === 'aes' || algo === 'hmac' ? 'text' : 'text'}
            placeholder={algo === 'aes' ? 'AES 비밀키(passphrase)' : 'HMAC 키'} value={key} onChange={(e) => setKey(e.target.value)} />
        )}
        <div className="grid grid-rows-2 gap-3 flex-1 min-h-0">
          <div className="dk-card flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">입력</div>
            <textarea className="flex-1 min-h-0 w-full resize-none border-none outline-none p-3.5 font-mono text-[13px] bg-transparent dark:text-gray-100"
              value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} placeholder="암호화/복호화할 텍스트" />
          </div>
          <div className="dk-card flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">결과</div>
            <textarea readOnly className="flex-1 min-h-0 w-full resize-none border-none outline-none p-3.5 font-mono text-[13px] bg-[#0f172a] text-[#e2e8f0]"
              value={output} placeholder="결과가 여기에 표시됩니다." />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 shrink-0">
          {def.kind === 'hash' ? '해시는 단방향입니다(복호화 불가).' : ''}
          {algo === 'aes' && ' AES는 CryptoJS 기본(OpenSSL 호환, passphrase 기반)입니다.'}
        </p>
      </div>
      )}
    </Layout>
  );
}
