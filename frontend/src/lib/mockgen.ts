// 더미(목업) 데이터 생성기 — 컬럼 정의 + 행 수 → 랜덤 데이터 → SQL INSERT / CSV / JSON / TSV.
// 100% 클라이언트 측. SQL 리터럴은 dialect(Oracle/PG/MSSQL/MySQL)별로 날짜/불리언을 정확히 포맷.
import { Dialect } from './ddl';

export type GenType =
  | 'seq' | 'int' | 'decimal'
  | 'krName' | 'enName' | 'empNo' | 'dept' | 'company' | 'product'
  | 'email' | 'phone' | 'addr'
  | 'date' | 'datetime'
  | 'bool' | 'uuid'
  | 'list' | 'fixed' | 'string' | 'lorem';

export interface MockColumn {
  id: string;
  name: string;
  type: GenType;
  // 타입별 옵션 (문자열로 보관, 생성 시 파싱)
  min?: string;      // int/decimal 최소, seq/empNo 시작값
  max?: string;      // int/decimal 최대
  scale?: string;    // decimal 소수자리
  prefix?: string;   // empNo 접두
  digits?: string;   // empNo/string 자릿수·길이
  list?: string;     // list(쉼표구분) / fixed(고정값)
  from?: string;     // date/datetime 시작 (YYYY-MM-DD)
  to?: string;       // date/datetime 끝
  boolStyle?: 'YN' | 'TF' | '10';
  nullPct?: string;  // NULL 비율 0~100
}

export interface GenTypeMeta { id: GenType; label: string; }
export const GEN_TYPES: GenTypeMeta[] = [
  { id: 'seq', label: '시퀀스(연번)' },
  { id: 'int', label: '정수(범위)' },
  { id: 'decimal', label: '소수/금액' },
  { id: 'krName', label: '한글 이름' },
  { id: 'enName', label: '영문 이름' },
  { id: 'empNo', label: '사번' },
  { id: 'dept', label: '부서' },
  { id: 'company', label: '회사명' },
  { id: 'product', label: '제품/모델' },
  { id: 'email', label: '이메일' },
  { id: 'phone', label: '휴대폰' },
  { id: 'addr', label: '주소' },
  { id: 'date', label: '날짜' },
  { id: 'datetime', label: '일시' },
  { id: 'bool', label: '여부(Y/N)' },
  { id: 'uuid', label: 'UUID' },
  { id: 'list', label: '목록 중 랜덤' },
  { id: 'fixed', label: '고정값' },
  { id: 'string', label: '랜덤 문자열' },
  { id: 'lorem', label: '랜덤 문장' },
];

// SQL 리터럴 종류: 따옴표/날짜함수 적용 판단
type SqlKind = 'num' | 'str' | 'date' | 'datetime' | 'bool';
function sqlKindOf(t: GenType): SqlKind {
  if (t === 'seq' || t === 'int' || t === 'decimal') return 'num';
  if (t === 'date') return 'date';
  if (t === 'datetime') return 'datetime';
  if (t === 'bool') return 'bool';
  return 'str';
}

// ── 한국형 데이터 풀 ──
const SURNAMES = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구';
const GIVEN = '민서지우현준도윤시은하지유연수예진영호태선아은빈주아람솔하늘찬결보람나래';
const EN_FIRST = ['James', 'Mary', 'John', 'Linda', 'Robert', 'Susan', 'Michael', 'Karen', 'David', 'Lisa', 'Daniel', 'Nancy', 'Paul', 'Emily', 'Mark', 'Anna'];
const EN_LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Lee', 'Kim', 'Park', 'Choi', 'Wilson', 'Taylor', 'Clark', 'Lewis'];
const DEPTS = ['영업1팀', '영업2팀', '생산관리팀', '품질보증팀', '구매팀', '물류팀', '경영지원팀', '인사팀', '재무팀', '연구개발팀', '정보전략팀', '설비기술팀'];
const COMPANIES = ['삼성전자', '삼성디스플레이', 'LG디스플레이', 'SK하이닉스', '현대모비스', '한화솔루션', '포스코', '두산에너빌리티', '에스원', '바이매트릭스'];
const PRODUCTS = ['OLED-Panel', 'QD-Display', 'LCD-Module', 'Flex-Cell', 'MicroLED', 'TFT-Array', 'CF-Glass', 'Driver-IC', 'Sensor-Mod', 'Backlight-Unit'];
const CITIES = ['서울특별시', '경기도 수원시', '경기도 용인시', '충청남도 아산시', '충청남도 천안시', '경상북도 구미시', '대전광역시', '인천광역시', '경기도 화성시', '경기도 평택시'];
const GUS = ['영통구', '기흥구', '처인구', '강남구', '서초구', '유성구', '남동구', '권선구', '팔달구', '동남구'];
const EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'daum.net', 'company.co.kr', 'outlook.com'];
const WORDS = ['관리', '생산', '품질', '계획', '실적', '분석', '검토', '승인', '요청', '확인', '처리', '보고', '개선', '점검', '등록', '조회', '집계', '배포', '검증', '협의'];

function ri(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[] | string): T | string { return typeof arr === 'string' ? arr[ri(0, arr.length - 1)] : arr[ri(0, arr.length - 1)]; }
function pad(n: number, len: number): string { const s = String(n); return s.length >= len ? s : '0'.repeat(len - s.length) + s; }

function genUuid(): string {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* noop */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16);
  });
}

function randStr(len: number): string {
  const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < len; i++) s += CH[ri(0, CH.length - 1)]; return s;
}

function dateBetween(from: string, to: string): Date {
  const a = Date.parse(from); const b = Date.parse(to);
  const lo = isNaN(a) ? Date.now() - 365 * 864e5 : a;
  const hi = isNaN(b) ? Date.now() : b;
  return new Date(lo + Math.random() * Math.max(0, hi - lo));
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}
function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
}

// 한 컬럼의 한 행 값 생성 (NULL이면 null)
function genValue(col: MockColumn, rowIndex: number): string | null {
  const nullPct = parseFloat(col.nullPct || '0');
  if (nullPct > 0 && Math.random() * 100 < nullPct) return null;

  switch (col.type) {
    case 'seq': {
      const start = parseInt(col.min || '1', 10) || 1;
      const dg = parseInt(col.digits || '0', 10);
      const v = start + rowIndex;
      return dg > 0 ? pad(v, dg) : String(v);
    }
    case 'int': {
      const lo = parseInt(col.min || '1', 10); const hi = parseInt(col.max || '100', 10);
      return String(ri(Math.min(lo, hi), Math.max(lo, hi)));
    }
    case 'decimal': {
      const lo = parseFloat(col.min || '0'); const hi = parseFloat(col.max || '1000');
      const sc = parseInt(col.scale || '2', 10);
      const v = lo + Math.random() * (hi - lo);
      return v.toFixed(Math.max(0, sc));
    }
    case 'krName': return (pick(SURNAMES) as string) + (pick(GIVEN) as string) + (pick(GIVEN) as string);
    case 'enName': return `${pick(EN_FIRST)} ${pick(EN_LAST)}`;
    case 'empNo': {
      const start = parseInt(col.min || '1', 10) || 1;
      const dg = parseInt(col.digits || '5', 10) || 5;
      return (col.prefix || 'E') + pad(start + rowIndex, dg);
    }
    case 'dept': return pick(DEPTS) as string;
    case 'company': return pick(COMPANIES) as string;
    case 'product': return `${pick(PRODUCTS)}-${pad(ri(1, 999), 3)}`;
    case 'email': return `${randStr(ri(5, 8)).toLowerCase()}@${pick(EMAIL_DOMAINS)}`;
    case 'phone': return `010-${pad(ri(1000, 9999), 4)}-${pad(ri(0, 9999), 4)}`;
    case 'addr': return `${pick(CITIES)} ${pick(GUS)} ${pick(WORDS)}로 ${ri(1, 199)}`;
    case 'date': return fmtDate(dateBetween(col.from || '', col.to || ''));
    case 'datetime': return fmtDateTime(dateBetween(col.from || '', col.to || ''));
    case 'bool': {
      const t = Math.random() < 0.5;
      if (col.boolStyle === 'TF') return t ? 'true' : 'false';
      if (col.boolStyle === '10') return t ? '1' : '0';
      return t ? 'Y' : 'N';
    }
    case 'uuid': return genUuid();
    case 'list': {
      const opts = (col.list || '').split(',').map((s) => s.trim()).filter(Boolean);
      return opts.length ? opts[ri(0, opts.length - 1)] : '';
    }
    case 'fixed': return col.list ?? '';
    case 'string': return randStr(parseInt(col.digits || '8', 10) || 8);
    case 'lorem': {
      const n = ri(2, 5); let s = '';
      for (let i = 0; i < n; i++) s += (i ? ' ' : '') + (pick(WORDS) as string);
      return s;
    }
    default: return '';
  }
}

export type MockRow = (string | null)[];   // 컬럼 순서대로

export function generateRows(cols: MockColumn[], count: number): MockRow[] {
  const rows: MockRow[] = [];
  const n = Math.max(0, Math.min(count, 100000));
  for (let i = 0; i < n; i++) {
    rows.push(cols.map((c) => genValue(c, i)));
  }
  return rows;
}

// ── 출력 포맷터 ──
function quoteStr(v: string): string { return `'${v.replace(/'/g, "''")}'`; }

function sqlLiteral(type: GenType, raw: string | null, d: Dialect): string {
  if (raw === null) return 'NULL';
  const kind = sqlKindOf(type);
  if (kind === 'num') return raw === '' ? 'NULL' : raw;
  if (kind === 'bool') {
    const t = /^(1|y|t|true)$/i.test(raw);
    return d === 'postgresql' ? (t ? 'TRUE' : 'FALSE') : (t ? '1' : '0');
  }
  if (kind === 'date') return d === 'oracle' ? `TO_DATE(${quoteStr(raw)}, 'YYYY-MM-DD')` : quoteStr(raw);
  if (kind === 'datetime') return d === 'oracle' ? `TO_TIMESTAMP(${quoteStr(raw)}, 'YYYY-MM-DD HH24:MI:SS')` : quoteStr(raw);
  return quoteStr(raw);
}

function quoteId(id: string, d: Dialect, on: boolean): string {
  if (!on) return id;
  if (d === 'mssql') return `[${id}]`;
  if (d === 'mysql') return '`' + id + '`';
  return `"${id}"`;
}

export interface SqlOptions { table: string; dialect: Dialect; quoteIds: boolean; }

export function toInsertSQL(cols: MockColumn[], rows: MockRow[], opt: SqlOptions): string {
  const named = cols.filter((c) => c.name.trim());
  if (!opt.table.trim() || named.length === 0) return '';
  const idx = cols.map((c, i) => ({ c, i })).filter((x) => x.c.name.trim());
  const colList = named.map((c) => quoteId(c.name.trim(), opt.dialect, opt.quoteIds)).join(', ');
  return rows.map((r) => {
    const vals = idx.map((x) => sqlLiteral(x.c.type, r[x.i], opt.dialect)).join(', ');
    return `INSERT INTO ${opt.table.trim()} (${colList}) VALUES (${vals});`;
  }).join('\n');
}

function csvCell(v: string | null, sep: string): string {
  if (v === null) return '';
  const needQuote = v.includes(sep) || v.includes('"') || v.includes('\n');
  const e = v.replace(/"/g, '""');
  return needQuote ? `"${e}"` : e;
}

export function toCSV(cols: MockColumn[], rows: MockRow[], sep = ','): string {
  const named = cols.map((c, i) => ({ c, i })).filter((x) => x.c.name.trim());
  const header = named.map((x) => csvCell(x.c.name.trim(), sep)).join(sep);
  const body = rows.map((r) => named.map((x) => csvCell(r[x.i], sep)).join(sep)).join('\n');
  return header + '\n' + body;
}

export function toJSON(cols: MockColumn[], rows: MockRow[]): string {
  const idx = cols.map((c, i) => ({ c, i })).filter((x) => x.c.name.trim());
  const arr = rows.map((r) => {
    const o: Record<string, string | null> = {};
    for (const x of idx) o[x.c.name.trim()] = r[x.i];
    return o;
  });
  return JSON.stringify(arr, null, 2);
}
