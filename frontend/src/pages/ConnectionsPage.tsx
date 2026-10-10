import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { connectionApi, errorMessage, type DbConnection } from '../api/client';
import { DIALECTS } from '../lib/ddl';

const URL_HINT: Record<string, string> = {
  oracle: 'jdbc:oracle:thin:@host:1521/service',
  mssql: 'jdbc:sqlserver://host:1433;databaseName=db;encrypt=false',
  postgresql: 'jdbc:postgresql://host:5432/db',
  mysql: 'jdbc:mysql://host:3306/db  (MariaDB: jdbc:mariadb://...)',
};

export default function ConnectionsPage() {
  const [list, setList] = useState<DbConnection[]>([]);
  const [nc, setNc] = useState({ name: '', dialect: 'oracle', jdbcUrl: '', username: '', password: '' });
  // 편집 중 비밀번호(변경 시에만 입력)
  const [pw, setPw] = useState<Record<string, string>>({});

  const reload = async () => {
    try { setList(await connectionApi.list()); } catch (e) { toast.error(errorMessage(e)); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const add = async () => {
    if (!nc.name.trim() || !nc.jdbcUrl.trim()) return toast.error('이름과 JDBC URL은 필수입니다.');
    try { await connectionApi.create(nc); setNc({ name: '', dialect: 'oracle', jdbcUrl: '', username: '', password: '' }); reload(); toast.success('추가했습니다.'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const save = async (c: DbConnection) => {
    try {
      await connectionApi.update(c.id, { name: c.name, dialect: c.dialect, jdbcUrl: c.jdbc_url, username: c.username, password: pw[c.id] || '' });
      setPw((p) => ({ ...p, [c.id]: '' }));
      toast.success('저장했습니다.');
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async (id: string) => { try { await connectionApi.remove(id); reload(); } catch (e) { toast.error(errorMessage(e)); } };

  const testNew = async () => {
    try { const r = await connectionApi.test({ jdbcUrl: nc.jdbcUrl, username: nc.username, password: nc.password });
      r.ok ? toast.success('연결 성공') : toast.error(r.error || '연결 실패'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const testSaved = async (c: DbConnection) => {
    try { const r = await connectionApi.test(pw[c.id] ? { jdbcUrl: c.jdbc_url, username: c.username, password: pw[c.id] } : { id: c.id });
      r.ok ? toast.success('연결 성공') : toast.error(r.error || '연결 실패'); }
    catch (e) { toast.error(errorMessage(e)); }
  };

  const patch = (id: string, p: Partial<DbConnection>) => setList((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <Layout title="DB 연결 관리" subtitle="데이터 생성 SQL을 실행할 대상 DB를 등록 — DDL [데이터 입력] / DB 쿼리의 실행 대상에서 선택">
      <div className="max-w-5xl space-y-4">
        {/* 추가 */}
        <section className="dk-card p-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-600 dark:text-gray-200">연결 추가</h2>
          <div className="grid grid-cols-2 gap-2">
            <input className="dk-input" placeholder="연결 이름 (예: 운영 Oracle)" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
            <select className="dk-input" value={nc.dialect} onChange={(e) => setNc({ ...nc, dialect: e.target.value })}>
              {DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <input className="dk-input w-full font-mono text-xs" placeholder={URL_HINT[nc.dialect]} value={nc.jdbcUrl} onChange={(e) => setNc({ ...nc, jdbcUrl: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="dk-input" placeholder="사용자" value={nc.username} onChange={(e) => setNc({ ...nc, username: e.target.value })} />
            <input className="dk-input" type="password" placeholder="비밀번호" value={nc.password} onChange={(e) => setNc({ ...nc, password: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="dk-btn-secondary !py-1.5" onClick={testNew}>연결 테스트</button>
            <button className="dk-btn-primary !py-1.5" onClick={add}>추가</button>
            <span className="text-[11px] text-gray-400 self-center">URL 예시: <code>{URL_HINT[nc.dialect]}</code></span>
          </div>
        </section>

        {/* 목록 */}
        <section className="dk-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#1b2942] text-xs text-gray-400">
              <tr><th className="text-left px-3 py-2 w-40">이름</th><th className="text-left px-3 py-2 w-28">종류</th><th className="text-left px-3 py-2">JDBC URL</th><th className="text-left px-3 py-2 w-28">사용자</th><th className="text-left px-3 py-2 w-28">비밀번호</th><th className="w-40"></th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400 text-xs">등록된 연결이 없습니다.</td></tr>}
              {list.map((c) => (
                <tr key={c.id} className="border-t border-gray-50 dark:border-[#243149]">
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} /></td>
                  <td className="px-2 py-1">
                    <select className="dk-input w-full !py-1" value={c.dialect} onChange={(e) => patch(c.id, { dialect: e.target.value })}>
                      {DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1 font-mono text-xs" value={c.jdbc_url} onChange={(e) => patch(c.id, { jdbc_url: e.target.value })} /></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={c.username} onChange={(e) => patch(c.id, { username: e.target.value })} /></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" type="password" placeholder="변경 시 입력" value={pw[c.id] || ''} onChange={(e) => setPw((p) => ({ ...p, [c.id]: e.target.value }))} /></td>
                  <td className="text-center whitespace-nowrap text-xs">
                    <button className="text-gray-500 hover:text-dk-cyan px-1" onClick={() => testSaved(c)}>테스트</button>
                    <button className="text-dk-blue hover:underline px-1" onClick={() => save(c)}>저장</button>
                    <button className="text-dk-red hover:underline px-1" onClick={() => remove(c.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="text-[11px] text-gray-400">⚠ 비밀번호는 내부 도구 특성상 서버 DB에 저장됩니다. 운영 계정 사용 시 권한을 최소화하세요. 드라이버는 URL로 자동 인식(PostgreSQL/Oracle/MSSQL/MySQL·MariaDB 번들됨).</p>
      </div>
    </Layout>
  );
}
