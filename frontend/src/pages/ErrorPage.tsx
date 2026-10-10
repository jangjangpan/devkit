import { useSearchParams, useNavigate } from 'react-router-dom';
import { DevkitMark } from '../components/DevkitLogo';

interface ErrorInfo {
  accent: string; soft: string; glyph: string;
  labelKr: string; labelEn: string;
  title: string; desc: string;
  primaryLabel: string; primaryIcon: string; primaryTo: string;   // 'reload'|'back' 특수값
  secondaryLabel: string; secondaryTo: string;
}

const ERROR_MAP: Record<string, ErrorInfo> = {
  '401': {
    accent: '#d97706', soft: '#fef3c7', glyph: '🔒', labelKr: '세션 만료', labelEn: 'Unauthorized',
    title: '세션이 만료되었습니다',
    desc: '보안을 위해 로그인 세션이 종료되었습니다. 다시 로그인하시면 이어서 작업하실 수 있어요.',
    primaryLabel: '로그인 페이지로', primaryIcon: '→', primaryTo: '/login',
    secondaryLabel: '홈으로', secondaryTo: '/home',
  },
  '403': {
    accent: '#d97706', soft: '#fef3c7', glyph: '⛔', labelKr: '접근 거부', labelEn: 'Forbidden',
    title: '이 페이지에 접근할 권한이 없습니다',
    desc: '해당 메뉴에 대한 권한이 없습니다. 접근이 필요하다면 관리자에게 요청해주세요.',
    primaryLabel: '홈으로', primaryIcon: '⌂', primaryTo: '/home',
    secondaryLabel: '이전 페이지', secondaryTo: 'back',
  },
  '404': {
    accent: '#1a67a3', soft: '#e6efff', glyph: '🔍', labelKr: '페이지 없음', labelEn: 'Not Found',
    title: '페이지를 찾을 수 없습니다',
    desc: '요청하신 페이지가 존재하지 않거나 이동·삭제되었을 수 있습니다. 주소가 올바른지 확인해주세요.',
    primaryLabel: '홈으로 돌아가기', primaryIcon: '⌂', primaryTo: '/home',
    secondaryLabel: '이전 페이지', secondaryTo: 'back',
  },
  '500': {
    accent: '#dc2626', soft: '#fee2e2', glyph: '⚠️', labelKr: '서버 오류', labelEn: 'Internal Error',
    title: '서버에서 오류가 발생했습니다',
    desc: '일시적인 문제로 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요. 문제가 반복되면 관리자에게 문의해주세요.',
    primaryLabel: '새로고침', primaryIcon: '↻', primaryTo: 'reload',
    secondaryLabel: '홈으로', secondaryTo: '/home',
  },
  '502': {
    accent: '#dc2626', soft: '#fee2e2', glyph: '🔌', labelKr: '연결 실패', labelEn: 'Bad Gateway',
    title: '서비스에 연결할 수 없습니다',
    desc: '게이트웨이 연결에 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
    primaryLabel: '새로고침', primaryIcon: '↻', primaryTo: 'reload',
    secondaryLabel: '홈으로', secondaryTo: '/home',
  },
  '503': {
    accent: '#0d9488', soft: '#ccfbf1', glyph: '🛠️', labelKr: '시스템 점검', labelEn: 'Maintenance',
    title: '시스템 점검을 진행하고 있습니다',
    desc: '더 안정적인 서비스를 위해 정기 점검 중입니다. 점검이 끝나면 자동으로 정상화됩니다.',
    primaryLabel: '새로고침', primaryIcon: '↻', primaryTo: 'reload',
    secondaryLabel: '홈으로', secondaryTo: '/home',
  },
};
const DEFAULT_ERROR: ErrorInfo = {
  accent: '#dc2626', soft: '#fee2e2', glyph: '⚠️', labelKr: '오류', labelEn: 'Error',
  title: '오류가 발생했습니다',
  desc: '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  primaryLabel: '홈으로', primaryIcon: '⌂', primaryTo: '/home',
  secondaryLabel: '이전 페이지', secondaryTo: 'back',
};

export default function ErrorPage({ defaultCode = '500' }: { defaultCode?: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('code') || defaultCode;
  const info = ERROR_MAP[code] || DEFAULT_ERROR;
  const from = params.get('from') || '';

  const handleAction = (target: string) => {
    if (target === 'reload') { window.location.reload(); return; }
    if (target === 'back') { window.history.back(); return; }
    navigate(target);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-dk-navy to-dk-blue">
      {/* 상단 좌측 로고 */}
      <div className="absolute top-6 left-6 flex items-center gap-2 text-white">
        <DevkitMark size={30} className="text-dk-cyan" />
        <span className="font-extrabold text-lg tracking-tight">DevKit<span className="text-dk-cyan">.</span></span>
      </div>

      {/* 상단 우측 상태 배지 */}
      <div className="absolute top-6 right-6 flex items-center gap-2 text-white/70 text-xs">
        <span className="inline-block px-3 py-1 rounded-md text-white font-extrabold tracking-wider text-[11px]" style={{ background: info.accent }}>{code}</span>
        <span className="font-semibold">{info.labelKr} · {info.labelEn}</span>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-[520px] bg-white rounded-[28px] shadow-2xl overflow-hidden">
        <div style={{ height: 10, background: info.accent }} />
        <div className="px-10 py-10 text-center">
          <div className="w-[120px] h-[120px] mx-auto rounded-[26px] flex items-center justify-center relative" style={{ background: info.soft }}>
            <span className="text-[64px] leading-none select-none" role="img" aria-label={info.labelKr}>{info.glyph}</span>
            <span className="absolute -top-2 -right-2 px-2.5 py-0.5 rounded-md text-white text-[11px] font-black shadow-md" style={{ background: info.accent }}>{code}</span>
          </div>
          <div className="mt-4 text-xs font-bold tracking-wider" style={{ color: info.accent }}>ERROR · {code}</div>
          <h1 className="text-xl md:text-[22px] font-extrabold mt-2 text-slate-800 leading-snug">{info.title}</h1>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">{info.desc}</p>
          {from && (
            <div className="mt-5 inline-block px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[10.5px] font-mono text-slate-500 break-all max-w-full">{from}</div>
          )}
          <div className="flex flex-wrap gap-2 justify-center mt-7">
            <button onClick={() => handleAction(info.primaryTo)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white rounded-lg px-5 py-2.5 shadow transition-transform hover:-translate-y-0.5" style={{ background: info.accent }}>
              <span className="text-base leading-none">{info.primaryIcon}</span><span>{info.primaryLabel}</span>
            </button>
            <button onClick={() => handleAction(info.secondaryTo)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-5 py-2.5 transition-colors">
              {info.secondaryLabel}
            </button>
          </div>
          <div className="mt-6 text-[11px] text-slate-400">문제가 계속되면 관리자에게 문의해주세요.</div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-[10px] font-mono tracking-wider">
        DevKit · {info.labelEn.toUpperCase()}
      </div>
    </div>
  );
}
