import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // 임시 비밀번호 사용자는 비밀번호 변경 전까지 /profile 외 접근 차단
  if (user.mustChangePassword && loc.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  return <>{children}</>;
}
