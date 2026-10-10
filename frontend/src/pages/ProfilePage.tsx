import { useState } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage } from '../api/client';
import { THEMES, applyTheme } from '../lib/theme';

export default function ProfilePage() {
  const { user, patchUser } = useAuth();
  const [userNm, setUserNm] = useState(user?.userNm || '');
  const [theme, setTheme] = useState(user?.themeColor || 'BLUE');
  const [saving, setSaving] = useState(false);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const saveProfile = async () => {
    if (!userNm.trim()) return toast.error('이름을 입력하세요.');
    setSaving(true);
    try {
      await api.put('/me/profile', { userNm: userNm.trim(), themeColor: theme });
      patchUser({ userNm: userNm.trim(), themeColor: theme });
      toast.success('프로필을 저장했습니다.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // 테마 즉시 미리보기 (저장 전에도 적용)
  const previewTheme = (t: string) => { setTheme(t); applyTheme(t); };

  const changePassword = async () => {
    if (newPw.length < 4) return toast.error('새 비밀번호는 4자 이상이어야 합니다.');
    setPwSaving(true);
    try {
      await api.post('/me/password', { currentPassword: curPw, newPassword: newPw });
      patchUser({ mustChangePassword: false });
      toast.success('비밀번호를 변경했습니다.');
      setCurPw(''); setNewPw('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Layout title="내 정보" subtitle="이름 · 테마(스킨) · 비밀번호 변경">
      <div className="max-w-xl space-y-6">
        {user?.mustChangePassword && (
          <div className="rounded-lg border border-dk-orange/40 bg-dk-orange/10 px-4 py-3 text-sm text-dk-orange">
            ⚠ 임시 비밀번호로 로그인했습니다. <b>비밀번호를 변경해야</b> 다른 메뉴를 사용할 수 있습니다.
          </div>
        )}
        {/* 기본 정보 + 테마 */}
        <section className="dk-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-600">기본 정보</h2>
          <div>
            <label className="text-xs text-gray-400">아이디</label>
            <input className="dk-input w-full mt-1 bg-gray-50" value={user?.userCd || ''} disabled />
          </div>
          <div>
            <label className="text-xs text-gray-400">이름</label>
            <input className="dk-input w-full mt-1" value={userNm} onChange={(e) => setUserNm(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400">테마 (스킨)</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => previewTheme(t.id)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-xs transition-all ${
                    theme === t.id ? 'border-dk-blue ring-2 ring-dk-blue/30' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: t.swatch }} />
                  <span className="text-gray-600">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="dk-btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? '저장 중…' : '프로필 저장'}
          </button>
        </section>

        {/* 비밀번호 변경 */}
        <section className="dk-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-600">비밀번호 변경</h2>
          <div>
            <label className="text-xs text-gray-400">현재 비밀번호</label>
            <input type="password" className="dk-input w-full mt-1" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400">새 비밀번호</label>
            <input type="password" className="dk-input w-full mt-1" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <button className="dk-btn-secondary" onClick={changePassword} disabled={pwSaving}>
            {pwSaving ? '변경 중…' : '비밀번호 변경'}
          </button>
        </section>
      </div>
    </Layout>
  );
}
