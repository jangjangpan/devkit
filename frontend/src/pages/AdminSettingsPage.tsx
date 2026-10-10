import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { systemConfigApi, errorMessage } from '../api/client';

// 세션 유지 시간 프리셋 (시간 단위)
const PRESETS: { h: number; label: string }[] = [
  { h: 1, label: '1시간' },
  { h: 4, label: '4시간' },
  { h: 8, label: '8시간' },
  { h: 12, label: '12시간' },
  { h: 24, label: '24시간 (1일)' },
  { h: 48, label: '48시간 (2일)' },
  { h: 72, label: '72시간 (3일)' },
  { h: 168, label: '168시간 (7일)' },
  { h: 720, label: '720시간 (30일)' },
];

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [adminEditShared, setAdminEditShared] = useState(false);
  const [sessionHours, setSessionHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) return;
    systemConfigApi.get().then((c) => { setAdminEditShared(c.adminEditShared); setSessionHours(c.sessionHours); })
      .catch((e) => toast.error(errorMessage(e))).finally(() => setLoading(false));
  }, [user]);

  if (!user?.isAdmin) return <Navigate to="/home" replace />;

  const toggleShared = async (on: boolean) => {
    setAdminEditShared(on); setSaving(true);
    try { const r = await systemConfigApi.save({ adminEditShared: on }); setAdminEditShared(r.adminEditShared); toast.success('저장했습니다.'); }
    catch (e) { setAdminEditShared(!on); toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  };

  const saveHours = async (h: number) => {
    const prev = sessionHours;
    setSessionHours(h); setSaving(true);
    try { const r = await systemConfigApi.save({ sessionHours: h }); setSessionHours(r.sessionHours); toast.success(`세션 유지 시간 ${r.sessionHours}시간으로 저장했습니다.`); }
    catch (e) { setSessionHours(prev); toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  };

  const isPreset = PRESETS.some((p) => p.h === sessionHours);

  return (
    <Layout title="시스템 설정" subtitle="사이트 전역 시스템 옵션 (관리자 전용)">
      <div className="max-w-2xl space-y-4">
        {/* 관리자 공유 메모 수정 */}
        <div className="dk-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-bold text-gray-800 dark:text-gray-100">관리자의 공유 메모 수정 허용</div>
              <p className="text-sm text-gray-500 dark:text-gray-300 mt-1 leading-relaxed">
                켜면 <b>관리자</b>는 <b>공유된</b> 메모를 작성자와 무관하게 <b>원본째 수정</b>할 수 있습니다.
                끄면 관리자도 남의 메모는 수정할 수 없고, 공유 메모를 열어 저장하면 본인 사본으로 복제됩니다.
                (비공유 메모는 이 설정과 무관하게 항상 작성자만 수정)
              </p>
            </div>
            <label className={`relative inline-flex items-center shrink-0 cursor-pointer ${loading || saving ? 'opacity-50 pointer-events-none' : ''}`}>
              <input type="checkbox" className="sr-only peer" checked={adminEditShared} onChange={(e) => toggleShared(e.target.checked)} />
              <span className="w-11 h-6 bg-gray-200 dark:bg-[#2A3953] rounded-full peer-checked:bg-dk-blue transition-colors" />
              <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>
          <div className="mt-3 text-xs">
            현재 상태: {loading ? '불러오는 중…' : (
              <span className={adminEditShared ? 'text-dk-green font-semibold' : 'text-gray-400'}>{adminEditShared ? '허용됨 (ON)' : '허용 안 함 (OFF)'}</span>
            )}
          </div>
        </div>

        {/* 세션 유지 시간 */}
        <div className="dk-card p-5">
          <div className="font-bold text-gray-800 dark:text-gray-100">로그인 세션 유지 시간</div>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1 leading-relaxed">
            로그인 후 자동 로그아웃까지의 시간입니다. 여기서 정한 값으로 <b>각 사용자가 로그인할 때마다</b> 세션(토큰) 만료가 결정됩니다.
            <br />변경은 <b>변경 이후의 새 로그인</b>부터 적용되며, 이미 로그인된 세션은 기존 만료 시간을 유지합니다.
          </p>
          <div className="mt-3 flex items-center flex-wrap gap-2">
            <select className="dk-input !py-1.5 text-sm" value={isPreset ? sessionHours : 'custom'}
              disabled={loading || saving}
              onChange={(e) => { if (e.target.value !== 'custom') saveHours(parseInt(e.target.value, 10)); }}>
              {PRESETS.map((p) => <option key={p.h} value={p.h}>{p.label}</option>)}
              {!isPreset && <option value="custom">직접 입력 ({sessionHours}시간)</option>}
            </select>
            <span className="text-xs text-gray-400">또는 직접</span>
            <input type="number" min={1} max={8760} value={sessionHours}
              disabled={loading || saving}
              onChange={(e) => setSessionHours(parseInt(e.target.value, 10) || 1)}
              className="dk-input !py-1.5 text-sm w-24" />
            <span className="text-xs text-gray-400">시간</span>
            <button className="dk-btn-primary !py-1.5 text-sm" disabled={loading || saving} onClick={() => saveHours(Math.max(1, Math.min(8760, sessionHours || 1)))}>적용</button>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            현재: {loading ? '불러오는 중…' : <span className="text-gray-600 dark:text-gray-300 font-semibold">{sessionHours}시간</span>} (범위 1~8760시간)
          </div>
        </div>
      </div>
    </Layout>
  );
}
