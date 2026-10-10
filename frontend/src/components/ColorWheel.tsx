import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { hsvToHex, hexToHsv, hexToRgb, hexToHsl, isLight } from '../lib/palettes';

const SIZE = 220;
const R = SIZE / 2;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
  toast.success(`복사됨: ${text}`);
}

// figma 스타일 색상 휠 — 각도=색상(Hue), 반지름=채도(Saturation), 슬라이더=명도(Value).
export default function ColorWheel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [h, setH] = useState(210);
  const [s, setS] = useState(0.7);
  const [v, setV] = useState(1);
  const dragging = useRef(false);

  const hex = hsvToHex(h, s, v);

  // HEX 입력은 별도 로컬 상태로 두어 자유롭게 타이핑 가능하게 한다.
  // (제어값을 hex로 직접 묶으면 미완성 입력이 즉시 되돌려져 입력이 막힘)
  const [hexInput, setHexInput] = useState(hex);
  const hexFocused = useRef(false);
  useEffect(() => { if (!hexFocused.current) setHexInput(hex); }, [hex]);

  // 휠 렌더링 (명도 v 변경 시 다시 그림)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(SIZE, SIZE);
    const data = img.data;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - R;
        const dy = y - R;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * SIZE + x) * 4;
        if (dist > R) { data[idx + 3] = 0; continue; }
        let ang = Math.atan2(dy, dx) * 180 / Math.PI;
        if (ang < 0) ang += 360;
        const sat = Math.min(dist / R, 1);
        const c = hsvToHex(ang, sat, v).replace('#', '');
        data[idx] = parseInt(c.substring(0, 2), 16);
        data[idx + 1] = parseInt(c.substring(2, 4), 16);
        data[idx + 2] = parseInt(c.substring(4, 6), 16);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [v]);

  const pick = useCallback((clientX: number, clientY: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left - R;
    const y = clientY - rect.top - R;
    let ang = Math.atan2(y, x) * 180 / Math.PI;
    if (ang < 0) ang += 360;
    const dist = Math.min(Math.sqrt(x * x + y * y) / R, 1);
    setH(ang);
    setS(dist);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) pick(e.clientX, e.clientY); };
    const up = () => { dragging.current = false; };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [pick]);

  // 마커 위치
  const markerX = R + Math.cos(h * Math.PI / 180) * s * R;
  const markerY = R + Math.sin(h * Math.PI / 180) * s * R;

  const setFromHex = (raw: string) => {
    const m = raw.trim().replace(/^#?/, '#');
    if (/^#[0-9a-fA-F]{6}$/.test(m)) {
      const hsv = hexToHsv(m);
      setH(hsv.h); setS(hsv.s); setV(hsv.v);
    }
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[11px] font-bold text-gray-400">{label}</span>
      <code className="flex-1 text-xs font-mono text-gray-700 select-all">{value}</code>
      <button className="dk-btn-ghost !px-2 !py-1 text-xs" onClick={() => copy(value)}>복사</button>
    </div>
  );

  return (
    <div className="dk-card p-4 flex flex-wrap items-center gap-6">
      {/* 휠 */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="rounded-full cursor-crosshair shadow-inner"
          onMouseDown={(e) => { dragging.current = true; pick(e.clientX, e.clientY); }}
        />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: markerX - 8, top: markerY - 8, background: hex }}
        />
      </div>

      {/* 명도 슬라이더 + 출력 */}
      <div className="flex-1 min-w-[240px] space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg shadow-inner border border-gray-100 shrink-0" style={{ background: hex }} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <input
                className="dk-input w-28 font-mono !py-1.5"
                value={hexInput}
                onChange={(e) => { setHexInput(e.target.value); setFromHex(e.target.value); }}
                onFocus={() => { hexFocused.current = true; }}
                onBlur={() => { hexFocused.current = false; setHexInput(hex); }}
                placeholder="#RRGGBB"
                spellCheck={false}
              />
              <input
                type="color"
                className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
                value={hex}
                onChange={(e) => setFromHex(e.target.value)}
                title="시스템 색상 선택기"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-gray-400">명도 (Value) {Math.round(v * 100)}%</label>
          <input
            type="range" min={0} max={100} value={Math.round(v * 100)}
            onChange={(e) => setV(Number(e.target.value) / 100)}
            className="w-full mt-1 accent-dk-blue"
            style={{ background: `linear-gradient(to right, #000, ${hsvToHex(h, s, 1)})` }}
          />
        </div>

        <div className="space-y-1.5 pt-1">
          <Row label="HEX" value={hex} />
          <Row label="RGB" value={hexToRgb(hex)} />
          <Row label="HSL" value={hexToHsl(hex)} />
        </div>
        <p className="text-[11px] text-gray-400">
          휠을 클릭·드래그해 색상/채도를 고르고, 슬라이더로 밝기를 조절하세요.
          <span className={isLight(hex) ? 'text-gray-400' : 'text-gray-400'}> 코드는 각 행의 [복사]로 클립보드에 담깁니다.</span>
        </p>
      </div>
    </div>
  );
}
