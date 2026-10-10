// DDL 테이블 정의 기반 데이터 입력 → INSERT/UPDATE 생성 + 셀 검증.
import { Table, Column, Dialect } from './ddl';

export type Row = Record<string, string>; // key = column.id

export type GenMode = 'insert' | 'update';

// ── 셀 검증: 값이 컬럼 타입에 맞는지 검사. 에러 메시지 or null ──
export function validateCell(col: Column, raw: string): string | null {
  const v = (raw ?? '').trim();
  const required = col.pk || col.notNull;
  if (v === '') return required ? '필수 입력' : null;

  switch (col.type) {
    case 'INT':
    case 'BIGINT':
      if (!/^-?\d+$/.test(v)) return '정수만 입력 가능';
      return null;
    case 'DECIMAL': {
      if (!/^-?\d+(\.\d+)?$/.test(v)) return '숫자만 입력 가능';
      const len = col.length.trim();
      if (len) {
        const [pStr, sStr] = len.split(',');
        const p = parseInt(pStr, 10);
        const s = sStr ? parseInt(sStr, 10) : 0;
        const neg = v.startsWith('-');
        const body = neg ? v.slice(1) : v;
        const [intPart, decPart = ''] = body.split('.');
        if (!isNaN(s) && decPart.length > s) return `소수점 ${s}자리 초과`;
        if (!isNaN(p) && (intPart.replace(/^0+/, '').length + (s || 0)) > p) return `정밀도(${p}) 초과`;
      }
      return null;
    }
    case 'FLOAT':
      if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return '숫자만 입력 가능';
      return null;
    case 'DATE':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'YYYY-MM-DD 형식';
      if (isNaN(Date.parse(v))) return '유효하지 않은 날짜';
      return null;
    case 'DATETIME':
      if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v)) return 'YYYY-MM-DD[ HH:MM:SS]';
      return null;
    case 'BOOLEAN':
      if (!/^(0|1|y|n|t|f|true|false)$/i.test(v)) return '0/1/Y/N/true/false';
      return null;
    case 'CHAR':
    case 'VARCHAR': {
      const len = parseInt(col.length, 10);
      if (!isNaN(len) && len > 0 && v.length > len) return `길이 초과 (최대 ${len}, 현재 ${v.length})`;
      return null;
    }
    default:
      return null;
  }
}

// 표 전체 검증 → 에러 개수
export function countErrors(table: Table, rows: Row[]): number {
  let n = 0;
  for (const row of rows) {
    if (isEmptyRow(table, row)) continue;
    for (const c of table.columns) {
      if (c.name.trim() && validateCell(c, row[c.id] || '')) n++;
    }
  }
  return n;
}

export function isEmptyRow(table: Table, row: Row): boolean {
  return table.columns.every((c) => !(row[c.id] || '').trim());
}

// ── SQL 리터럴 변환 ──
function quoteStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function boolLiteral(v: string, d: Dialect): string {
  const t = /^(1|y|t|true)$/i.test(v.trim());
  if (d === 'postgresql') return t ? 'TRUE' : 'FALSE';
  return t ? '1' : '0';
}

function formatValue(col: Column, raw: string, d: Dialect): string {
  const v = (raw ?? '').trim();
  if (v === '') return 'NULL';
  switch (col.type) {
    case 'INT': case 'BIGINT': case 'DECIMAL': case 'FLOAT':
      return v;
    case 'BOOLEAN':
      return boolLiteral(v, d);
    case 'DATE':
      return d === 'oracle' ? `TO_DATE(${quoteStr(v)}, 'YYYY-MM-DD')` : quoteStr(v);
    case 'DATETIME': {
      const norm = v.replace('T', ' ');
      if (d === 'oracle') return `TO_TIMESTAMP(${quoteStr(norm)}, 'YYYY-MM-DD HH24:MI:SS')`;
      return quoteStr(norm);
    }
    default:
      return quoteStr(v);
  }
}

function quoteId(id: string, d: Dialect, on: boolean): string {
  if (!on) return id;
  if (d === 'mssql') return `[${id}]`;
  if (d === 'mysql') return '`' + id + '`';
  return `"${id}"`;
}

function qualified(t: Table, d: Dialect, on: boolean): string {
  const tbl = quoteId(t.name, d, on);
  return t.schema.trim() ? `${quoteId(t.schema.trim(), d, on)}.${tbl}` : tbl;
}

// ── INSERT / UPDATE 생성 ──
export function generateDML(
  table: Table, rows: Row[], dialect: Dialect, mode: GenMode, quoteIds = false,
): { sql: string; error?: string } {
  const cols = table.columns.filter((c) => c.name.trim());
  if (!table.name.trim() || cols.length === 0) return { sql: '', error: '테이블/컬럼 정의가 없습니다.' };

  const dataRows = rows.filter((r) => !isEmptyRow(table, r));
  if (dataRows.length === 0) return { sql: '', error: '입력된 데이터가 없습니다.' };

  const fq = qualified(table, dialect, quoteIds);

  if (mode === 'insert') {
    const colList = cols.map((c) => quoteId(c.name, dialect, quoteIds)).join(', ');
    const lines = dataRows.map((r) => {
      const vals = cols.map((c) => formatValue(c, r[c.id] || '', dialect)).join(', ');
      return `INSERT INTO ${fq} (${colList}) VALUES (${vals});`;
    });
    return { sql: lines.join('\n') };
  }

  // UPDATE: PK 필요
  const pkCols = cols.filter((c) => c.pk);
  if (pkCols.length === 0) return { sql: '', error: 'UPDATE는 PK 컬럼이 1개 이상 필요합니다.' };
  const setCols = cols.filter((c) => !c.pk);
  if (setCols.length === 0) return { sql: '', error: 'PK 외 갱신할 컬럼이 없습니다.' };

  const lines = dataRows
    .filter((r) => pkCols.every((c) => (r[c.id] || '').trim()))
    .map((r) => {
      const sets = setCols.map((c) => `${quoteId(c.name, dialect, quoteIds)} = ${formatValue(c, r[c.id] || '', dialect)}`).join(', ');
      const where = pkCols.map((c) => `${quoteId(c.name, dialect, quoteIds)} = ${formatValue(c, r[c.id] || '', dialect)}`).join(' AND ');
      return `UPDATE ${fq} SET ${sets} WHERE ${where};`;
    });
  if (lines.length === 0) return { sql: '', error: 'PK 값이 채워진 행이 없습니다.' };
  return { sql: lines.join('\n') };
}

// ── 입력 데이터 → JSON 배열 ──
function jsonValue(col: Column, raw: string): unknown {
  const v = (raw ?? '').trim();
  if (v === '') return null;
  switch (col.type) {
    case 'INT': case 'BIGINT': {
      const n = parseInt(v, 10);
      return isNaN(n) ? v : n;
    }
    case 'DECIMAL': case 'FLOAT': {
      const n = Number(v);
      return isNaN(n) ? v : n;
    }
    case 'BOOLEAN':
      return /^(1|y|t|true)$/i.test(v);
    default: // VARCHAR/CHAR/TEXT/DATE/DATETIME → 문자열
      return v;
  }
}

export function generateJson(table: Table, rows: Row[]): { json: string; error?: string } {
  const cols = table.columns.filter((c) => c.name.trim());
  if (!table.name.trim() || cols.length === 0) return { json: '', error: '테이블/컬럼 정의가 없습니다.' };
  const dataRows = rows.filter((r) => !isEmptyRow(table, r));
  if (dataRows.length === 0) return { json: '', error: '입력된 데이터가 없습니다.' };
  const arr = dataRows.map((r) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c) => { o[c.name] = jsonValue(c, r[c.id] || ''); });
    return o;
  });
  return { json: JSON.stringify(arr, null, 2) };
}

// ── 붙여넣기(TSV) 파싱 ── 클립보드 텍스트 → 2차원 배열
export function parseClipboardGrid(text: string): string[][] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '');
  if (cleaned === '') return [];
  return cleaned.split('\n').map((line) => line.split('\t'));
}

export function emptyRow(): Row {
  return {};
}
