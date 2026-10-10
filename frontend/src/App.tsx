import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ActivityTracker from './components/ActivityTracker';
import HomePage from './pages/HomePage';
import ErrorPage from './pages/ErrorPage';
import LoginPage from './pages/LoginPage';
import FlowchartPage from './pages/FlowchartPage';
import ErdPage from './pages/ErdPage';
import DdlPage from './pages/DdlPage';
import SqlFormatPage from './pages/SqlFormatPage';
import PalettePage from './pages/PalettePage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminLogsPage from './pages/AdminLogsPage';
import AdminMenuPage from './pages/AdminMenuPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import DictPage from './pages/DictPage';
import ConnectionsPage from './pages/ConnectionsPage';
import QueryPage from './pages/QueryPage';
import MockDataPage from './pages/MockDataPage';
import VarNamePage from './pages/VarNamePage';
import CasePage from './pages/CasePage';

// 무거운 라이브러리(prettier/crypto-js/codemirror/diff-viewer)는 해당 메뉴 진입 시에만 로드
const FormatPage = lazy(() => import('./pages/FormatPage'));
const CryptPage = lazy(() => import('./pages/CryptPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));

const Loading = () => <div className="p-10 text-sm text-gray-400">로딩 중…</div>;

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <ActivityTracker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/error-page" element={<ErrorPage />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/flowchart" element={<ProtectedRoute><FlowchartPage /></ProtectedRoute>} />
        <Route path="/erd" element={<ProtectedRoute><ErdPage /></ProtectedRoute>} />
        <Route path="/ddl" element={<ProtectedRoute><DdlPage /></ProtectedRoute>} />
        <Route path="/dict" element={<ProtectedRoute><DictPage /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />
        <Route path="/query" element={<ProtectedRoute><QueryPage /></ProtectedRoute>} />
        <Route path="/mock" element={<ProtectedRoute><MockDataPage /></ProtectedRoute>} />
        <Route path="/varname" element={<ProtectedRoute><VarNamePage /></ProtectedRoute>} />
        <Route path="/case" element={<ProtectedRoute><CasePage /></ProtectedRoute>} />
        <Route path="/sql-format" element={<ProtectedRoute><SqlFormatPage /></ProtectedRoute>} />
        <Route path="/palette" element={<ProtectedRoute><PalettePage /></ProtectedRoute>} />
        <Route path="/format" element={<ProtectedRoute><FormatPage /></ProtectedRoute>} />
        <Route path="/crypt" element={<ProtectedRoute><CryptPage /></ProtectedRoute>} />
        <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
        <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/logs" element={<ProtectedRoute><AdminLogsPage /></ProtectedRoute>} />
        <Route path="/admin/menu" element={<ProtectedRoute><AdminMenuPage /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<ErrorPage defaultCode="404" />} />
      </Routes>
    </Suspense>
  );
}
