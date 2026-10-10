import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useDark } from '../theme/DarkContext';
import { useMenuConfig } from '../context/MenuConfigContext';
import { DevkitMark } from './DevkitLogo';

export interface Tool {
  to: string;
  label: string;
  desc: string;
  icon: ReactNode;
}

const I = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    {path}
  </svg>
);

export const TOOLS: Tool[] = [
  {
    to: '/flowchart', label: '순서도', desc: 'Flowchart',
    icon: I(<><rect x="9" y="2" width="6" height="4" rx="1" /><rect x="9" y="10" width="6" height="4" rx="1" /><rect x="9" y="18" width="6" height="4" rx="1" /><path d="M12 6v4M12 14v4" /></>),
  },
  {
    to: '/erd', label: 'ERD', desc: 'Entity Relationship',
    icon: I(<><rect x="2" y="4" width="8" height="7" rx="1" /><rect x="14" y="13" width="8" height="7" rx="1" /><path d="M10 7h4v9" /></>),
  },
  {
    to: '/ddl', label: 'DDL 생성', desc: 'CREATE TABLE',
    icon: I(<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>),
  },
  {
    to: '/mock', label: '더미 데이터', desc: 'Mock Data',
    icon: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 4v16" /><path d="M13 13h5M13 16h3" /></>),
  },
  {
    to: '/varname', label: '변수명 추천', desc: 'Variable Namer',
    icon: I(<><path d="M4 7V4h16v3" /><path d="M9 20h6M12 4v16" /><circle cx="18" cy="16" r="3" /><path d="m20.5 18.5 1.5 1.5" /></>),
  },
  {
    to: '/sql-format', label: 'SQL 정렬', desc: 'SQL Formatter',
    icon: I(<><path d="M4 6h16M4 10h10M4 14h16M4 18h8" /></>),
  },
  {
    to: '/query', label: 'DB 쿼리', desc: 'Query Runner',
    icon: I(<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3 1 0 2-.1 3-.2M4 11v6c0 1.6 3.2 2.9 7 3" /><circle cx="17" cy="17" r="3.5" /><path d="m21 21-1.6-1.6" /></>),
  },
  {
    to: '/format', label: '코드 정렬', desc: 'Code Formatter',
    icon: I(<><path d="M4 7h16M4 12h10M8 17h12" /><path d="M3 12l2-2-2-2" /></>),
  },
  {
    to: '/case', label: '대소문자 변환', desc: 'Case Converter',
    icon: I(<><path d="M6 16V8m0 0-3 8m3-8 3 8M14 16V9a3 3 0 0 1 6 0v7M14 12h6" /></>),
  },
  {
    to: '/crypt', label: '암호화 / 복호화', desc: 'Encrypt / Decrypt',
    icon: I(<><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="15.5" r="1" /></>),
  },
  {
    to: '/compare', label: '코드 비교', desc: 'Diff Compare',
    icon: I(<><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /><path d="M10 9l4 0M10 13l4 0" /></>),
  },
  {
    to: '/notes', label: '개발 메모', desc: 'Dev Notes',
    icon: I(<><path d="M5 3h11l4 4v14H5z" /><path d="M16 3v4h4M8 12h8M8 16h6" /></>),
  },
  {
    to: '/palette', label: '색상 팔레트', desc: 'Color Palette',
    icon: I(<><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.3A4.2 4.2 0 0 0 22 11c0-5-4.5-9-10-9z" /></>),
  },
];

const COLLAPSE_KEY = 'devkit_sidebar_collapsed';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { apply } = useMenuConfig();
  const tools = apply(TOOLS);
  const { dark, toggle } = useDark();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  const doLogout = () => { logout(); nav('/login', { replace: true }); };
  const toggleCollapse = () => setCollapsed((c) => {
    const next = !c;
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    return next;
  });

  const navItem = (to: string, label: string, desc: string, icon: ReactNode) => (
    <NavLink
      to={to}
      title={collapsed ? label : ''}
      className={({ isActive }) =>
        `flex items-center rounded-lg transition-colors ${collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'} ${
          isActive ? 'bg-dk-cyan text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-[11px] text-white/40">{desc}</span>
        </span>
      )}
    </NavLink>
  );

  const sunMoon = dark
    ? I(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>)
    : I(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);

  return (
    <aside className={`group/side relative ${collapsed ? 'w-16' : 'w-60'} shrink-0 bg-dk-navy text-white flex flex-col transition-[width] duration-200`}>
      {/* 경계에 마우스를 올리면 나타나는 접기/펴기 토글 */}
      <button onClick={toggleCollapse} title={collapsed ? '펴기' : '접기'}
        className="absolute top-1/2 -right-3 -translate-y-1/2 z-30 w-6 h-6 rounded-full bg-dk-cyan text-white shadow-md
                   flex items-center justify-center opacity-0 group-hover/side:opacity-100 focus:opacity-100
                   transition-all hover:scale-110">
        {collapsed ? I(<path d="M9 6l6 6-6 6" />) : I(<path d="M15 6l-6 6 6 6" />)}
      </button>

      {/* 헤더 (클릭 시 메인으로) */}
      <button onClick={() => nav('/home')} title="메인으로"
        className={`h-16 flex items-center border-b border-white/10 hover:bg-white/5 transition-colors ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-5'}`}>
        <DevkitMark size={32} className="text-dk-cyan shrink-0" />
        {!collapsed && (
          <div className="leading-tight text-left">
            <div className="font-extrabold text-[15px] tracking-tight">DevKit<span className="text-dk-cyan">.</span></div>
            <div className="text-[11px] text-white/50">개발자 도구 모음</div>
          </div>
        )}
      </button>

      {/* 도구 메뉴 */}
      <nav className="flex-1 min-h-0 overflow-y-auto dk-nav-scroll px-3 py-2 space-y-0.5">
        {tools.map((t) => <span key={t.to}>{navItem(t.to, t.label, t.desc, t.icon)}</span>)}
      </nav>

      {/* 계정 메뉴 */}
      <div className="px-3 pb-1 space-y-0.5">
        {navItem('/profile', '내 정보', 'Profile', I(<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></>))}
        {user?.isAdmin && navItem('/admin/users', '사용자 관리', 'Users',
          I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" /><path d="M17 8.5a3 3 0 1 0 0-1M22 20c0-2.5-2-4.5-4.5-4.8" /></>))}
        {user?.isAdmin && navItem('/admin/logs', '활동 로그', 'Activity Log',
          I(<><path d="M4 5h16M4 5v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5" /><path d="M8 10h8M8 14h5" /><circle cx="6" cy="3" r="0" /></>))}
        {user?.isAdmin && navItem('/admin/menu', '메뉴 관리', 'Menu Order',
          I(<><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="2.5" cy="6" r="0.8" /><circle cx="2.5" cy="12" r="0.8" /><circle cx="2.5" cy="18" r="0.8" /></>))}
        {user?.isAdmin && navItem('/admin/settings', '시스템 설정', 'System Settings',
          I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 2.6V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>))}
      </div>

      {/* 사용자 + 로그아웃 + 다크 */}
      {user && (
        <div className="px-3 py-3 border-t border-white/10">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-dk-cyan flex items-center justify-center text-sm font-bold" title={`${user.userNm} (${user.userCd})`}>
                {user.userNm?.charAt(0) || user.userCd.charAt(0)}
              </div>
              <button onClick={toggle} title={dark ? '라이트 모드' : '다크 모드'} className="text-white/60 hover:text-white">{sunMoon}</button>
              <button onClick={doLogout} title="로그아웃" className="text-white/60 hover:text-white">
                {I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>)}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-1 mb-2">
                <div className="w-8 h-8 rounded-full bg-dk-cyan flex items-center justify-center text-sm font-bold shrink-0">
                  {user.userNm?.charAt(0) || user.userCd.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{user.userNm}{user.isAdmin && <span className="ml-1 text-[10px] text-dk-cyan">관리자</span>}</div>
                  <div className="text-[11px] text-white/40 truncate">{user.userCd}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={doLogout}
                  className="flex-1 text-left text-[12px] text-white/60 hover:text-white hover:bg-white/10 rounded px-2 py-1.5 transition-colors">
                  로그아웃
                </button>
                <button onClick={toggle} title={dark ? '라이트 모드' : '다크 모드'}
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded px-2 py-1.5 transition-colors">
                  {sunMoon}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 버전 */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/30">
          v1.5.1 · /devkit
        </div>
      )}
    </aside>
  );
}
