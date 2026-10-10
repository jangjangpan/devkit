import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage } from '../api/client';

interface AdminUser {
  user_cd: string;
  user_nm: string;
  is_admin: string;
  use_yn: string;
  status_cd: string; // PENDING | APPROVED | REJECTED
  created_at: string;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [newId, setNewId] = useState('');
  const [newNm, setNewNm] = useState('');
  const [newAdmin, setNewAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setUsers((await api.get<AdminUser[]>('/admin/users')).data);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.isAdmin) load(); /* eslint-disable-next-line */ }, []);

  if (!user?.isAdmin) return <Navigate to="/sql-format" replace />;

  const create = async () => {
    if (!newId.trim() || !newNm.trim()) return toast.error('ID와 이름을 입력하세요.');
    setCreating(true);
    try {
      const r = await api.post<{ tempPassword: string }>('/admin/users', { userCd: newId.trim(), userNm: newNm.trim(), isAdmin: newAdmin ? 'Y' : 'N' });
      toast.success(`생성됨 · 임시 비밀번호: ${r.data.tempPassword}`, { duration: 8000 });
      setNewId(''); setNewNm(''); setNewAdmin(false);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const toggleAdmin = async (u: AdminUser) => {
    try {
      await api.put(`/admin/users/${u.user_cd}`, { userNm: u.user_nm, isAdmin: u.is_admin === 'Y' ? 'N' : 'Y' });
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const toggleActive = async (u: AdminUser) => {
    try {
      await api.post(`/admin/users/${u.user_cd}/active`, { useYn: u.use_yn === 'Y' ? 'N' : 'Y' });
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const approve = async (u: AdminUser) => {
    try { await api.post(`/admin/users/${u.user_cd}/approve`); toast.success(`${u.user_cd} 승인됨`); load(); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const reject = async (u: AdminUser) => {
    if (!confirm(`'${u.user_nm}(${u.user_cd})' 가입을 거부할까요?`)) return;
    try { await api.post(`/admin/users/${u.user_cd}/reject`); toast.success('거부했습니다.'); load(); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  const resetPw = async (u: AdminUser) => {
    try {
      const r = await api.post<{ tempPassword: string }>(`/admin/users/${u.user_cd}/reset-password`, {});
      toast.success(`${u.user_cd} 임시 비밀번호: ${r.data.tempPassword}`, { duration: 8000 });
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`'${u.user_nm}(${u.user_cd})' 계정을 삭제할까요?`)) return;
    try {
      await api.delete(`/admin/users/${u.user_cd}`);
      toast.success('삭제했습니다.');
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const renameUser = async (u: AdminUser) => {
    const name = prompt('이름 변경', u.user_nm);
    if (name == null || !name.trim()) return;
    try {
      await api.put(`/admin/users/${u.user_cd}`, { userNm: name.trim(), isAdmin: u.is_admin });
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Layout title="사용자 관리" subtitle="관리자 전용 — 계정 생성 / 권한 / 활성화 / 비밀번호 초기화">
      <div className="max-w-4xl space-y-5">
        {/* 사용자 추가 */}
        <section className="dk-card p-4">
          <h2 className="text-sm font-bold text-gray-600 mb-3">사용자 추가</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-gray-400">아이디</label>
              <input className="dk-input mt-1 w-40" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="dev01" />
            </div>
            <div>
              <label className="text-xs text-gray-400">이름</label>
              <input className="dk-input mt-1 w-40" value={newNm} onChange={(e) => setNewNm(e.target.value)} placeholder="홍길동" />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 pb-2 cursor-pointer">
              <input type="checkbox" checked={newAdmin} onChange={(e) => setNewAdmin(e.target.checked)} /> 관리자
            </label>
            <button className="dk-btn-primary" onClick={create} disabled={creating}>
              {creating ? '생성 중…' : '추가'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">생성 시 임시 비밀번호가 발급됩니다(토스트로 표시). 사용자는 로그인 후 [내 정보]에서 변경하세요.</p>
        </section>

        {/* 사용자 목록 */}
        <section className="dk-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">아이디</th>
                <th className="text-left px-4 py-2 font-medium">이름</th>
                <th className="px-2 py-2 font-medium">승인</th>
                <th className="px-2 py-2 font-medium">관리자</th>
                <th className="px-2 py-2 font-medium">상태</th>
                <th className="text-left px-4 py-2 font-medium">생성일</th>
                <th className="px-2 py-2 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">불러오는 중…</td></tr>}
              {!loading && users.map((u) => {
                const isMe = u.user_cd === user.userCd;
                const status = u.status_cd || 'APPROVED';
                return (
                  <tr key={u.user_cd} className={`border-t border-gray-50 hover:bg-gray-50/50 ${status === 'PENDING' ? 'bg-dk-orange/5' : ''}`}>
                    <td className="px-4 py-2 font-mono text-gray-700">{u.user_cd}{isMe && <span className="ml-1 text-[10px] text-dk-blue">(나)</span>}</td>
                    <td className="px-4 py-2 text-gray-700">{u.user_nm}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      {status === 'APPROVED' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-dk-green/10 text-dk-green">승인됨</span>}
                      {status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-dk-orange/15 text-dk-orange">대기</span>
                          <button className="text-[11px] text-dk-green hover:underline" onClick={() => approve(u)}>승인</button>
                          <button className="text-[11px] text-dk-red hover:underline" onClick={() => reject(u)}>거부</button>
                        </span>
                      )}
                      {status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-dk-red/10 text-dk-red">거부됨</span>
                          <button className="text-[11px] text-dk-green hover:underline" onClick={() => approve(u)}>승인</button>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => toggleAdmin(u)} disabled={isMe}
                        className={`text-[11px] px-2 py-0.5 rounded-full ${u.is_admin === 'Y' ? 'bg-dk-blue/10 text-dk-blue' : 'bg-gray-100 text-gray-400'} disabled:opacity-50`}>
                        {u.is_admin === 'Y' ? '관리자' : '일반'}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => toggleActive(u)} disabled={isMe}
                        className={`text-[11px] px-2 py-0.5 rounded-full ${u.use_yn === 'Y' ? 'bg-dk-green/10 text-dk-green' : 'bg-dk-red/10 text-dk-red'} disabled:opacity-50`}>
                        {u.use_yn === 'Y' ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{String(u.created_at).slice(0, 10)}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap text-xs">
                      <button className="text-gray-500 hover:text-dk-blue px-1.5" onClick={() => renameUser(u)}>이름</button>
                      <button className="text-gray-500 hover:text-dk-orange px-1.5" onClick={() => resetPw(u)}>비번초기화</button>
                      {!isMe && <button className="text-gray-500 hover:text-dk-red px-1.5" onClick={() => remove(u)}>삭제</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </Layout>
  );
}
