import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, TOKEN_KEY, USER_KEY } from '../api/client';
import { applyTheme } from '../lib/theme';

export interface User {
  userCd: string;
  userNm: string;
  isAdmin: boolean;
  themeColor?: string;
  mustChangePassword?: boolean;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (userCd: string, password: string) => Promise<void>;
  /** 가입 신청 → 관리자 승인 대기. 안내 메시지를 반환(자동 로그인 안 함). */
  signup: (userCd: string, userNm: string, password: string) => Promise<string>;
  logout: () => void;
  /** 로컬 사용자 정보 갱신 (프로필/테마 변경 후) */
  patchUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    const u = raw ? (JSON.parse(raw) as User) : null;
    applyTheme(u?.themeColor);
    return u;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !user) {
      api.get<User>('/auth/me')
        .then((r) => { setUser(r.data); localStorage.setItem(USER_KEY, JSON.stringify(r.data)); applyTheme(r.data.themeColor); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyAuth(data: { token: string; user: User }) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    applyTheme(data.user.themeColor);
  }

  function patchUser(patch: Partial<User>) {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      if (patch.themeColor) applyTheme(next.themeColor);
      return next;
    });
  }

  async function login(userCd: string, password: string) {
    setLoading(true);
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/login', { userCd, password });
      applyAuth(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function signup(userCd: string, userNm: string, password: string): Promise<string> {
    setLoading(true);
    try {
      const r = await api.post<{ message?: string }>('/auth/signup', { userCd, userNm, password });
      return r.data.message || '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.';
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    applyTheme('BLUE');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
