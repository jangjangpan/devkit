import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'devkit_token';
export const USER_KEY = 'devkit_user';

export const api = axios.create({
  baseURL: '/devkit/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/devkit/login';
      }
    }
    return Promise.reject(err);
  },
);

// 개발 메모
export type NoteScope = 'all' | 'mine' | 'shared';
export interface NoteMeta {
  id: string; title: string; lang: string; updated_at: string;
  user_cd: string; owner_nm: string | null; is_shared: string; // 'Y' | 'N'
}
export interface NoteFull extends NoteMeta { content: string; created_at: string; }
export const noteApi = {
  list: (scope: NoteScope = 'all') => api.get<NoteMeta[]>('/notes', { params: { scope } }).then((r) => r.data),
  get: (id: string) => api.get<NoteFull>(`/notes/${id}`).then((r) => r.data),
  create: (b: { title: string; lang: string; content: string; isShared: boolean }) =>
    api.post<{ id: string }>('/notes', b).then((r) => r.data),
  update: (id: string, b: { title: string; lang: string; content: string; isShared: boolean }) =>
    api.put(`/notes/${id}`, b).then((r) => r.data),
  remove: (id: string) => api.delete(`/notes/${id}`).then((r) => r.data),
};

// 활동 로그 (로그인/메뉴 클릭)
export interface ActivityRow {
  user_cd: string; user_nm: string | null; action: string; menu: string | null; ip: string | null; created_at: string;
}
export interface ActivityStats {
  total: number; days: number;
  daily: { day: string; count: number }[];
  byAction: { action: string; count: number }[];
  topMenus: { menu: string; count: number }[];
  topUsers: { userCd: string; userNm: string; count: number }[];
}
export const activityApi = {
  // 적재는 화면 흐름을 막지 않도록 fire-and-forget (실패 무시)
  record: (action: 'login' | 'menu', menu?: string) => {
    api.post('/activity', { action, menu: menu || '' }).catch(() => {});
  },
  list: (params: { action?: string; userCd?: string; limit?: number } = {}) =>
    api.get<ActivityRow[]>('/activity', { params }).then((r) => r.data),
  stats: (days = 14) => api.get<ActivityStats>('/activity/stats', { params: { days } }).then((r) => r.data),
  // beforeDays>0: N일 이전 삭제, 0: 전체 삭제
  clear: (beforeDays = 0) => api.delete<{ deleted: number }>('/activity', { params: { beforeDays } }).then((r) => r.data),
};

// 대메뉴 전역 설정(순서/숨김) — 관리자만 저장
export interface MenuConfig { order: string[]; hidden: string[]; }
export const menuConfigApi = {
  get: () => api.get<{ config: string }>('/menu-config').then((r) => {
    try { const o = JSON.parse(r.data.config || '{}'); return { order: o.order || [], hidden: o.hidden || [] } as MenuConfig; }
    catch { return { order: [], hidden: [] } as MenuConfig; }
  }),
  save: (cfg: MenuConfig) => api.put('/menu-config', { config: JSON.stringify(cfg) }).then((r) => r.data),
};

// 시스템 설정 (관리자)
export interface SystemConfig { adminEditShared: boolean; sessionHours: number; }
export const systemConfigApi = {
  get: () => api.get<SystemConfig>('/system-config').then((r) => r.data),
  // 부분 저장 지원 (변경한 키만 전달)
  save: (cfg: Partial<SystemConfig>) => api.put<SystemConfig>('/system-config', cfg).then((r) => r.data),
};

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || err.message;
  }
  return String(err);
}

// 작업물(ERD/순서도/DDL) 저장 API
export type ProjectType = 'erd' | 'flowchart' | 'ddl';

export interface ProjectMeta {
  id: string;
  type: ProjectType;
  name: string;
  owner_cd: string | null;
  owner_nm: string | null;
  is_shared: string; // 'Y' | 'N'
  is_favorite?: string; // 'Y' | 'N'
  tags?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFull extends ProjectMeta {
  content: string;
}

export const projectApi = {
  list: (type?: ProjectType) =>
    api.get<ProjectMeta[]>('/projects', { params: type ? { type } : {} }).then((r) => r.data),
  get: (id: string) => api.get<ProjectFull>(`/projects/${id}`).then((r) => r.data),
  create: (type: ProjectType, name: string, content: string, isShared = false, tags = '') =>
    api.post<{ id: string }>('/projects', { type, name, content, isShared: isShared ? 'Y' : 'N', tags }).then((r) => r.data),
  update: (id: string, body: { name?: string; content?: string; isShared?: boolean; tags?: string }) =>
    api.put(`/projects/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
  favorite: (id: string, favorite: boolean) =>
    api.post(`/projects/${id}/favorite`, { favorite }).then((r) => r.data),
};

// 표준 사전 (테이블명/컬럼명 관리)
export interface DictTable { id: string; table_cd: string; table_nm: string; schema_nm: string; comment: string; }
export interface DictColumn { id: string; column_cd: string; column_nm: string; col_type: string; col_length: string; comment: string; }

// 생성한 SQL을 선택한 DB에 직접 실행 (connectionId 없으면 앱 기본 DB)
export const execApi = {
  run: (sql: string, connectionId?: string) =>
    api.post<{ statements: number; affected: number }>('/exec', { sql, connectionId: connectionId || '' }).then((r) => r.data),
};

// SQL 조회 실행
export interface QueryResult {
  columns?: string[];
  rows?: (string | null)[][];
  rowCount?: number;
  truncated?: boolean;
  affected?: number;
}
export const queryApi = {
  run: (sql: string, connectionId?: string, limit = 500) =>
    api.post<QueryResult>('/query', { sql, connectionId: connectionId || '', limit }).then((r) => r.data),
};

// 쿼리/실행 이력
export interface HistoryEntry {
  id: string;
  kind: string;          // query | exec
  conn_name: string;
  sql_text: string;
  status: string;        // ok | error
  result_info: string;
  ms: number;
  created_at: string;
}
export const historyApi = {
  list: (limit = 50) => api.get<HistoryEntry[]>('/history', { params: { limit } }).then((r) => r.data),
  clear: () => api.delete('/history').then((r) => r.data),
};

// 스키마 브라우저
export interface SchemaTable { name: string; type: string; schema: string | null; }
export interface SchemaColumn { name: string; type: string; size: number; nullable: boolean; remarks: string | null; }
export interface SchemaList { current: string; schemas: string[]; }
export const schemaApi = {
  schemas: (connectionId?: string) =>
    api.get<SchemaList>('/schema/schemas', { params: { connectionId: connectionId || '' } }).then((r) => r.data),
  tables: (connectionId?: string, schema?: string) =>
    api.get<SchemaTable[]>('/schema/tables', { params: { connectionId: connectionId || '', schema: schema || '' } }).then((r) => r.data),
  columns: (table: string, connectionId?: string, schema?: string) =>
    api.get<SchemaColumn[]>('/schema/columns', { params: { connectionId: connectionId || '', schema: schema || '', table } }).then((r) => r.data),
  tableDef: (table: string, connectionId?: string, schema?: string) =>
    api.get<SchemaTableDef>('/schema/ddl', { params: { connectionId: connectionId || '', schema: schema || '', table } }).then((r) => r.data),
};

export interface SchemaTableDef {
  name: string;
  schema: string;
  columns: { name: string; type: string; length: string; pk: boolean; notNull: boolean; comment: string }[];
}

export interface SchemaErd {
  tables: SchemaTableDef[];
  relations: { fromTable: string; fromColumns: string[]; toTable: string; toColumns: string[] }[];
}
// schemaApi.erd 는 아래에서 schemaApi에 합쳐 정의 (별도 export)
export const schemaErdApi = {
  erd: (tables: string[], connectionId?: string, schema?: string) =>
    api.get<SchemaErd>('/schema/erd', { params: { connectionId: connectionId || '', schema: schema || '', tables: tables.join(',') } }).then((r) => r.data),
};

// DB 실행 대상(연결) 관리
export interface DbConnection {
  id: string;
  name: string;
  dialect: string;
  jdbc_url: string;
  username: string;
  created_at?: string;
}
export const connectionApi = {
  list: () => api.get<DbConnection[]>('/connections').then((r) => r.data),
  create: (b: { name: string; dialect: string; jdbcUrl: string; username: string; password: string }) =>
    api.post<{ id: string }>('/connections', b).then((r) => r.data),
  update: (id: string, b: { name: string; dialect: string; jdbcUrl: string; username: string; password: string }) =>
    api.put(`/connections/${id}`, b).then((r) => r.data),
  remove: (id: string) => api.delete(`/connections/${id}`).then((r) => r.data),
  test: (b: { id?: string; jdbcUrl?: string; username?: string; password?: string }) =>
    api.post<{ ok?: boolean; error?: string }>('/connections/test', b).then((r) => r.data),
};

export const dictApi = {
  listTables: () => api.get<DictTable[]>('/dict/tables').then((r) => r.data),
  addTable: (b: Partial<DictTable> & { tableCd: string; tableNm: string; schemaNm: string; comment: string }) =>
    api.post<{ id: string }>('/dict/tables', b).then((r) => r.data),
  updTable: (id: string, b: { tableCd: string; tableNm: string; schemaNm: string; comment: string }) =>
    api.put(`/dict/tables/${id}`, b).then((r) => r.data),
  delTable: (id: string) => api.delete(`/dict/tables/${id}`).then((r) => r.data),
  listColumns: () => api.get<DictColumn[]>('/dict/columns').then((r) => r.data),
  addColumn: (b: { columnCd: string; columnNm: string; colType: string; colLength: string; comment: string }) =>
    api.post<{ id: string }>('/dict/columns', b).then((r) => r.data),
  updColumn: (id: string, b: { columnCd: string; columnNm: string; colType: string; colLength: string; comment: string }) =>
    api.put(`/dict/columns/${id}`, b).then((r) => r.data),
  delColumn: (id: string) => api.delete(`/dict/columns/${id}`).then((r) => r.data),
  bulkTables: (rows: Array<{ tableCd: string; tableNm: string; schemaNm: string; comment: string }>) =>
    api.post<{ inserted: number }>('/dict/tables/bulk', rows).then((r) => r.data),
  bulkColumns: (rows: Array<{ columnCd: string; columnNm: string; colType: string; colLength: string; comment: string }>) =>
    api.post<{ inserted: number }>('/dict/columns/bulk', rows).then((r) => r.data),
};
