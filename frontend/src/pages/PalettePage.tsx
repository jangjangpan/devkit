import { useState } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ColorWheel from '../components/ColorWheel';
import { PALETTES, COMBOS, hexToRgb, isLight } from '../lib/palettes';

type Fmt = 'hex' | 'rgb';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  toast.success(`복사됨: ${text}`);
}

export default function PalettePage() {
  const [fmt, setFmt] = useState<Fmt>('hex');
  const fmtCode = (hex: string) => (fmt === 'hex' ? hex : hexToRgb(hex));

  const actions = (
    <div className="flex items-center gap-1 bg-gray-100 rounded p-0.5">
      {(['hex', 'rgb'] as Fmt[]).map((f) => (
        <button
          key={f}
          onClick={() => setFmt(f)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            fmt === f ? 'bg-white text-dk-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <Layout title="색상 팔레트" subtitle="색상 휠로 직접 선택 · 조합/팔레트 클릭 복사" actions={actions}>
      <div className="space-y-8 max-w-6xl">
        {/* 색상 휠 (직접 선택) */}
        <section>
          <h2 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <span className="text-lg">🎯</span> 색상 휠 — 직접 선택
          </h2>
          <ColorWheel />
        </section>

        {/* Color Hunt 스타일 조합 */}
        <section>
          <h2 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <span className="text-lg">🧩</span> 색 조합 (Color Hunt)
            <span className="text-xs font-normal text-gray-400">· {COMBOS.length}세트 · 색을 클릭하면 복사</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {COMBOS.map((combo) => (
              <div key={combo.id} className="dk-card overflow-hidden group">
                <div className="flex h-24">
                  {combo.colors.map((hex, i) => {
                    const light = isLight(hex);
                    return (
                      <button
                        key={hex + i}
                        onClick={() => copy(fmtCode(hex))}
                        title={`${hex} · ${hexToRgb(hex)}\n클릭하여 복사`}
                        className="flex-1 relative transition-[flex] hover:flex-[1.6] focus:outline-none"
                        style={{ background: hex }}
                      >
                        <span className={`absolute bottom-1 left-0 right-0 text-center text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${light ? 'text-gray-800/80' : 'text-white/90'}`}>
                          {hex.replace('#', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-600">{combo.title}</span>
                  <button
                    className="text-[11px] text-gray-400 hover:text-dk-blue"
                    onClick={() => copy(combo.colors.map(fmtCode).join(', '))}
                  >
                    전체 복사
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 단색 팔레트 (flatuicolors) */}
        {PALETTES.map((p) => (
          <section key={p.id}>
            <h2 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
              <span className="text-lg">{p.flag}</span>
              {p.title}
              <span className="text-xs font-normal text-gray-400">· {p.colors.length}색</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2">
              {p.colors.map((c) => {
                const code = fmtCode(c.hex);
                const light = isLight(c.hex);
                return (
                  <button
                    key={c.hex + (c.name || '')}
                    onClick={() => copy(code)}
                    title={`${c.name ? c.name + ' · ' : ''}${c.hex} · ${hexToRgb(c.hex)}\n클릭하여 복사`}
                    className="group relative h-20 rounded-lg overflow-hidden text-left transition-transform hover:scale-[1.04] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-dk-blue"
                    style={{ background: c.hex }}
                  >
                    <span
                      className={`absolute bottom-1.5 left-2 right-2 text-[11px] font-mono font-semibold tracking-tight ${
                        light ? 'text-gray-800/80' : 'text-white/90'
                      }`}
                    >
                      {code}
                    </span>
                    {c.name && (
                      <span
                        className={`absolute top-1.5 left-2 right-2 text-[10px] leading-tight ${
                          light ? 'text-gray-700/70' : 'text-white/70'
                        }`}
                      >
                        {c.name}
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${light ? 'bg-black/15 text-gray-900' : 'bg-white/20 text-white'}`}>
                        복사
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
}
