import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from '../components/Layout';
import { TOOLS } from '../components/Sidebar';
import { useMenuConfig } from '../context/MenuConfigContext';
import { useAuth } from '../auth/AuthContext';

// 카드용 한글 설명 (없으면 영문 desc 사용)
const DESC: Record<string, string> = {
  '/flowchart': '도형과 화살표로 순서도를 그리고 PNG로 내보내세요.',
  '/erd': '엔티티 관계도를 그리고 4종 DBMS DDL을 생성하세요.',
  '/ddl': 'CREATE TABLE DDL과 더미 INSERT를 만드세요.',
  '/mock': '컬럼을 정의해 더미 데이터를 SQL·CSV·JSON으로 생성하세요.',
  '/varname': '한글/영문을 언어별(SQL·Java·JS·Python) 변수명으로 변환하세요.',
  '/sql-format': 'SQL을 회사 규칙에 맞게 자동 정렬하세요.',
  '/query': '등록한 DB에 SQL을 실행하고 결과를 확인하세요.',
  '/format': 'JS/TS/JSON/Python 코드를 보기 좋게 정렬하세요.',
  '/case': '텍스트를 대문자/소문자/반전으로 변환하세요.',
  '/crypt': 'Base64·AES·해시 암복호화와 이미지 변환.',
  '/compare': '두 텍스트/코드의 차이를 좌우로 비교하세요.',
  '/notes': '블록 문서로 메모와 코드 스니펫을 정리하세요.',
  '/palette': '색상 휠과 추천 팔레트로 색을 고르고 복사하세요.',
  '/dict': '표준 테이블·컬럼 사전을 관리하세요.',
  '/connections': 'SQL을 실행할 DB 연결 대상을 등록·관리하세요.',
};

const svg = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">{path}</svg>
);
const ADMIN = [
  { to: '/admin/users', label: '사용자 관리', desc: '사용자 승인·권한·비밀번호를 관리하세요.', icon: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" /><path d="M17 8.5a3 3 0 1 0 0-1M22 20c0-2.5-2-4.5-4.5-4.8" /></>) },
  { to: '/admin/logs', label: '활동 로그', desc: '로그인·메뉴 접근 이력을 Grid/Chart로 확인하세요.', icon: svg(<><path d="M4 5h16v16H4z" /><path d="M8 10h8M8 14h5" /></>) },
  { to: '/admin/menu', label: '메뉴 관리', desc: '대메뉴 순서와 표시 여부를 설정하세요.', icon: svg(<><path d="M4 6h16M4 12h16M4 18h16" /></>) },
  { to: '/admin/settings', label: '시스템 설정', desc: '관리자의 공유 메모 수정 허용 등 전역 옵션.', icon: svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>) },
];

export default function HomePage() {
  const nav = useNavigate();
  const { apply } = useMenuConfig();
  const { user } = useAuth();
  const tools = apply(TOOLS);

  const Card = ({ to, label, desc, icon, action }: { to: string; label: string; desc: string; icon: ReactNode; action: string }) => (
    <button onClick={() => nav(to)}
      className="dk-card p-5 text-left hover:shadow-md hover:border-dk-blue/40 transition-all flex flex-col gap-3 group">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-dk-blue/10 text-dk-blue flex items-center justify-center shrink-0 group-hover:bg-dk-blue group-hover:text-white transition-colors">{icon}</span>
        <span className="font-bold text-gray-800 dark:text-gray-100">{label}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-300 leading-relaxed min-h-[40px]">{desc}</p>
      <span className="self-start text-xs px-3 py-1 rounded border border-gray-200 dark:border-[#2A3953] text-gray-500 dark:text-gray-300 group-hover:border-dk-blue group-hover:text-dk-blue">{action} →</span>
    </button>
  );

  return (
    <Layout title="DevKit." subtitle="개발에 필요한 도구를 한곳에서 — 카드를 눌러 바로 이동하세요.">
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-300 mb-3">개발 도구</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((t) => (
              <Card key={t.to} to={t.to} label={t.label} desc={DESC[t.to] || t.desc} icon={t.icon} action="바로가기" />
            ))}
          </div>
        </section>

        {user?.isAdmin && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-300 mb-3">관리자</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ADMIN.map((a) => <Card key={a.to} to={a.to} label={a.label} desc={a.desc} icon={a.icon} action="관리" />)}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
