import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { activityApi, errorMessage, type ActivityRow, type ActivityStats } from '../api/client';

type View = 'grid' | 'chart';

const actionLabel = (a: string) => (a === 'login' ? '로그인' : a === 'menu' ? '메뉴' : a);
const fmtTime = (s: string) => (s ? s.replace('T', ' ').slice(0, 19) : '');

export default function AdminLogsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('grid');

  // grid
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [action, setAction] = useState('');
  const [userCd, setUserCd] = useState('');
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(false);

  // chart
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [days, setDays] = useState(14);

  // 정리(삭제)
  const [cleanDays, setCleanDays] = useState(30);

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try { setRows(await activityApi.list({ action, userCd, limit })); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [action, userCd, limit]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try { setStats(await activityApi.stats(days)); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    if (view === 'grid') loadGrid(); else loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, days]);

  const reload = useCallback(() => { if (view === 'grid') loadGrid(); else loadStats(); }, [view, loadGrid, loadStats]);

  const clean = async (beforeDays: number) => {
    const msg = beforeDays > 0
      ? `${beforeDays}일 이전 로그를 삭제할까요? (되돌릴 수 없습니다)`
      : '전체 로그를 삭제할까요? (되돌릴 수 없습니다)';
    if (!window.confirm(msg)) return;
    try {
      const r = await activityApi.clear(beforeDays);
      toast.success(`${r.deleted}건 삭제했습니다.`);
      reload();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  if (!user?.isAdmin) return <Navigate to="/sql-format" replace />;

  const actions = (
    <>
      <div className="flex rounded overflow-hidden border border-gray-200 dark:border-[#2A3953]">
        {(['grid', 'chart'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-dk-blue text-white' : 'bg-white text-gray-600 dark:bg-[#162033] dark:text-gray-300'}`}>
            {v === 'grid' ? 'Grid' : 'Chart'}
          </button>
        ))}
      </div>
      <button className="dk-btn-secondary" onClick={reload}>새로고침</button>
      <span className="w-px h-5 bg-gray-200 dark:bg-[#2A3953] mx-1" />
      <select className="dk-input !py-1.5 text-sm" value={cleanDays} onChange={(e) => setCleanDays(parseInt(e.target.value, 10))}>
        {[7, 30, 90, 180, 365].map((n) => <option key={n} value={n}>{n}일 이전</option>)}
      </select>
      <button className="dk-btn-secondary" onClick={() => clean(cleanDays)}>정리</button>
      <button className="dk-btn-danger" onClick={() => clean(0)}>전체 삭제</button>
    </>
  );

  return (
    <Layout title="활동 로그" subtitle="로그인 · 메뉴 클릭 이력 — Grid / Chart" actions={actions}>
      <div className="flex flex-col h-full gap-3 min-h-0">
        {view === 'grid' ? (
          <>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <select className="dk-input !py-1.5 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">전체 동작</option>
                <option value="login">로그인</option>
                <option value="menu">메뉴</option>
              </select>
              <input className="dk-input !py-1.5 text-sm w-40" placeholder="사용자 ID 필터" value={userCd}
                onChange={(e) => setUserCd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadGrid()} />
              <select className="dk-input !py-1.5 text-sm" value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
                {[100, 200, 500, 1000, 2000].map((n) => <option key={n} value={n}>{n}건</option>)}
              </select>
              <button className="dk-btn-primary !py-1.5" onClick={loadGrid}>조회</button>
              <span className="text-xs text-gray-400 ml-1">{loading ? '불러오는 중…' : `${rows.length}건`}</span>
            </div>
            <div className="dk-card flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#1b2942] text-xs text-gray-500 dark:text-gray-300">
                  <tr>
                    <th className="text-left px-3 py-2 w-44">시각</th>
                    <th className="text-left px-3 py-2 w-40">사용자</th>
                    <th className="text-left px-3 py-2 w-20">동작</th>
                    <th className="text-left px-3 py-2">메뉴</th>
                    <th className="text-left px-3 py-2 w-36">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">로그가 없습니다.</td></tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-50 dark:border-[#243149]">
                      <td className="px-3 py-1.5 font-mono text-[12px] text-gray-500 dark:text-gray-400">{fmtTime(r.created_at)}</td>
                      <td className="px-3 py-1.5">
                        <span className="text-gray-700 dark:text-gray-200">{r.user_nm || '-'}</span>
                        <span className="text-gray-400 text-[11px] ml-1">{r.user_cd}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${r.action === 'login' ? 'bg-dk-cyan/15 text-dk-cyan' : 'bg-gray-100 text-gray-500 dark:bg-[#243149] dark:text-gray-300'}`}>
                          {actionLabel(r.action)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{r.menu || '-'}</td>
                      <td className="px-3 py-1.5 font-mono text-[12px] text-gray-400">{r.ip || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-300">기간</span>
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-2.5 py-1 rounded text-sm ${days === d ? 'bg-dk-blue text-white' : 'bg-gray-100 text-gray-600 dark:bg-[#243149] dark:text-gray-300'}`}>
                  {d}일
                </button>
              ))}
              {stats && <span className="text-xs text-gray-400 ml-2">총 {stats.total}건</span>}
            </div>
            {stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 overflow-auto pr-1">
                <ChartCard title={`일별 활동 (최근 ${stats.days}일)`}>
                  <BarsV data={stats.daily.map((x) => ({ label: x.day.slice(5), value: x.count }))} />
                </ChartCard>
                <ChartCard title="동작 비율">
                  <BarsH data={stats.byAction.map((x) => ({ label: actionLabel(x.action), value: x.count }))} />
                </ChartCard>
                <ChartCard title="메뉴 TOP 10">
                  <BarsH data={stats.topMenus.map((x) => ({ label: x.menu, value: x.count }))} />
                </ChartCard>
                <ChartCard title="사용자 TOP 10">
                  <BarsH data={stats.topUsers.map((x) => ({ label: `${x.userNm || x.userCd}`, value: x.count }))} />
                </ChartCard>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dk-card p-3 flex flex-col">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-200 mb-2">{title}</div>
      {children}
    </div>
  );
}

// 세로 막대 (일별)
function BarsV({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = Math.max(data.length * 26, 200);
  const H = 160;
  const pad = 22;
  const bw = (W - pad) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {data.map((d, i) => {
          const h = Math.round(((H - pad - 10) * d.value) / max);
          const x = pad + i * bw;
          const y = H - pad - h;
          return (
            <g key={i}>
              <rect x={x + 2} y={y} width={bw - 5} height={h} rx={2} style={{ fill: 'rgb(var(--dk-blue))' }} />
              {d.value > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="currentColor" className="text-gray-400">{d.value}</text>}
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" className="text-gray-400">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// 가로 막대 (TOP N / 비율)
function BarsH({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-28 shrink-0 truncate text-gray-600 dark:text-gray-300" title={d.label}>{d.label}</div>
          <div className="flex-1 bg-gray-100 dark:bg-[#243149] rounded h-4 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(d.value / max) * 100}%`, background: 'rgb(var(--dk-cyan))' }} />
          </div>
          <div className="w-10 text-right tabular-nums text-gray-500 dark:text-gray-400">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

const Empty = () => <div className="text-xs text-gray-400 py-6 text-center">데이터 없음</div>;
