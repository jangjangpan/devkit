import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { activityApi } from '../api/client';

// 경로 → 메뉴명 (활동 로그 표기용)
const LABELS: Record<string, string> = {
  '/flowchart': '순서도',
  '/erd': 'ERD',
  '/ddl': 'DDL 생성',
  '/dict': '표준 사전',
  '/connections': 'DB 연결 관리',
  '/query': 'DB 쿼리',
  '/mock': '더미 데이터',
  '/sql-format': 'SQL 정렬',
  '/palette': '색상 팔레트',
  '/format': '코드 정렬',
  '/crypt': '암호화 / 복호화',
  '/compare': '코드 비교',
  '/notes': '개발 메모',
  '/profile': '내 정보',
  '/admin/users': '사용자 관리',
  '/admin/logs': '활동 로그',
};

const labelFor = (p: string) => LABELS[p] || p;

/**
 * 라우트 변경(클릭/URL 직접 접근/새로고침/뒤로가기 전부)마다 활동 로그를 적재한다.
 * 로그인 사용자에 한해, /login 은 제외. 동일 경로 중복 적재는 방지.
 */
export default function ActivityTracker() {
  const { user } = useAuth();
  const loc = useLocation();
  const lastLogged = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;                       // 미인증 시 적재하지 않음
    const path = loc.pathname;
    if (path === '/login' || path === '/') return;
    if (lastLogged.current === path) return; // 같은 경로 연속 중복 방지
    lastLogged.current = path;
    activityApi.record('menu', labelFor(path));
  }, [user, loc.pathname]);

  return null;
}
