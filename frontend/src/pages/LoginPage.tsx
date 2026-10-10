import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';
import { DevkitMark } from '../components/DevkitLogo';

const REMEMBER_KEY = 'devkit_remember_user_cd';

export default function LoginPage() {
  const { login, signup, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  // 특정 메뉴 URL로 접근했다 로그인하면 거기로, 아니면 메인으로
  const from = (loc.state as { from?: string } | null)?.from;
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [userCd, setUserCd] = useState('');
  const [userNm, setUserNm] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  // 마운트 시 저장된 아이디 복원
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setUserCd(saved);
      setRemember(true);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(userCd, password);
        // 로그인 성공 시 체크 여부에 따라 아이디 저장/삭제
        if (remember) localStorage.setItem(REMEMBER_KEY, userCd.trim());
        else localStorage.removeItem(REMEMBER_KEY);
        nav(from && from !== '/login' ? from : '/home', { replace: true });
      } else {
        const msg = await signup(userCd, userNm, password);
        toast.success(msg, { duration: 6000 });
        setMode('login');        // 가입은 승인 대기 → 로그인 화면으로
        setPassword('');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dk-navy to-dk-blue p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-2.5 mb-1">
          <DevkitMark size={38} className="text-dk-cyan" />
          <div>
            <div className="font-extrabold text-gray-700 tracking-tight">DevKit<span className="text-dk-cyan">.</span></div>
            <div className="text-[11px] text-gray-400">개발자 도구 모음</div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded p-0.5 my-5 text-sm">
          {(['login', 'signup'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded font-medium transition-colors ${
                mode === m ? 'bg-white text-dk-blue shadow-sm' : 'text-gray-500'
              }`}>
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400">아이디</label>
            <input className="dk-input w-full mt-1" value={userCd} autoFocus
              onChange={(e) => setUserCd(e.target.value)} placeholder="ID" />
          </div>
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-gray-400">이름</label>
              <input className="dk-input w-full mt-1" value={userNm}
                onChange={(e) => setUserNm(e.target.value)} placeholder="이름" />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400">비밀번호</label>
            <input type="password" className="dk-input w-full mt-1" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {mode === 'login' && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 select-none cursor-pointer">
              <input type="checkbox" className="accent-dk-blue" checked={remember}
                onChange={(e) => setRemember(e.target.checked)} />
              <span>아이디 저장</span>
            </label>
          )}
          <button type="submit" className="dk-btn-primary w-full !py-2.5 mt-2" disabled={loading}>
            {loading ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        {mode === 'login' ? (
          <p className="text-[11px] text-gray-400 text-center mt-4">
            기본 관리자 계정: <code className="text-gray-500">admin / admin1234</code>
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 text-center mt-4">
            가입 후 <b className="text-gray-500">관리자 승인</b>이 완료되어야 로그인할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}
