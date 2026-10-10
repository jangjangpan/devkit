// DevKit 브랜드 마크 — 둥근 타일(브래킷 < / >).
// 타일 배경은 currentColor 라서 부모의 color(테마 강조색)를 따라간다.
// 사용: <DevkitMark className="text-dk-cyan" /> → 현재 테마 색 타일 + 흰 브래킷.
export function DevkitMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label="DevKit">
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <g stroke="#ffffff" strokeWidth="4.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="19,15 10,24 19,33" />
        <polyline points="29,15 38,24 29,33" />
        <line x1="26.4" y1="13" x2="21.6" y2="35" />
      </g>
    </svg>
  );
}
