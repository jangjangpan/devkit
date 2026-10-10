// DDL 데이터 모델 + 4-dialect CREATE TABLE 생성기.
// ERD 에디터와 DDL 생성 페이지가 동일 모델(Table/Column)을 공유한다.
// 레퍼런스(테이블 리스트 생성 및 관리 보고서)의 Oracle 기준 저장 → dialect 변환 방식을 따른다.

export type Dialect = 'oracle' | 'mssql' | 'postgresql' | 'mysql';

export const DIALECTS: { id: Dialect; label: string }[] = [
  { id: 'oracle', label: 'Oracle' },
  { id: 'mssql', label: 'MS SQL Server' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL / MariaDB' },
];

// 사용자가 선택하는 표준(논리) 타입 — dialect 별 물리 타입으로 매핑된다.
export type BaseType =
  | 'VARCHAR' | 'CHAR' | 'INT' | 'BIGINT' | 'DECIMAL'
  | 'FLOAT' | 'DATE' | 'DATETIME' | 'TEXT' | 'BOOLEAN';

export const BASE_TYPES: BaseType[] = [
  'VARCHAR', 'CHAR', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DATE', 'DATETIME', 'TEXT', 'BOOLEAN',
];

// 길이/정밀도 입력이 의미 있는 타입 (그 외에는 length 무시)
export const TYPES_WITH_LENGTH: BaseType[] = ['VARCHAR', 'CHAR', 'DECIMAL'];

// 선택한 dialect의 실제(물리) 타입명. 길이가 있는 타입은 base명만(길이는 별도 컬럼).
export function physicalTypeName(base: BaseType, d: Dialect): string {
  switch (base) {
    case 'VARCHAR': return d === 'oracle' ? 'VARCHAR2' : 'VARCHAR';
    case 'CHAR': return 'CHAR';
    case 'INT': return d === 'oracle' ? 'NUMBER(10)' : d === 'postgresql' ? 'INTEGER' : 'INT';
    case 'BIGINT': return d === 'oracle' ? 'NUMBER(19)' : 'BIGINT';
    case 'DECIMAL': return d === 'oracle' ? 'NUMBER' : d === 'postgresql' ? 'NUMERIC' : 'DECIMAL';
    case 'FLOAT': return d === 'oracle' ? 'BINARY_DOUBLE' : d === 'postgresql' ? 'DOUBLE PRECISION' : d === 'mysql' ? 'DOUBLE' : 'FLOAT';
    case 'DATE': return 'DATE';
    case 'DATETIME': return d === 'oracle' ? 'TIMESTAMP' : d === 'mssql' ? 'DATETIME2' : d === 'postgresql' ? 'TIMESTAMP' : 'DATETIME';
    case 'TEXT': return d === 'oracle' ? 'CLOB' : d === 'mssql' ? 'NVARCHAR(MAX)' : d === 'postgresql' ? 'TEXT' : 'LONGTEXT';
    case 'BOOLEAN': return d === 'oracle' ? 'NUMBER(1)' : d === 'mssql' ? 'BIT' : d === 'postgresql' ? 'BOOLEAN' : 'TINYINT(1)';
    default: return base;
  }
}

export interface Column {
  id: string;
  name: string;
  type: BaseType;
  length: string;     // "100" 또는 "10,2"
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  defaultValue: string;
  comment: string;
}

export interface TableIndex {
  id: string;
  name: string;       // 비우면 자동 생성
  columns: string[];  // 컬럼명들
  unique: boolean;
}

export interface Table {
  name: string;
  schema: string;
  comment: string;
  columns: Column[];
  indexes: TableIndex[];
}

export interface DdlOptions {
  quoteIdentifiers: boolean;  // 식별자 따옴표/대괄호 감싸기
  includeComments: boolean;   // 컬럼/테이블 주석 생성
  includeDrop: boolean;       // DROP TABLE 선행
}

export const DEFAULT_OPTIONS: DdlOptions = {
  quoteIdentifiers: false,
  includeComments: true,
  includeDrop: false,
};

// 표준 타입 → dialect 물리 타입 매핑
function mapType(col: Column, d: Dialect): string {
  const len = col.length.trim();
  const withLen = (base: string, fallback?: string) =>
    len ? `${base}(${len})` : fallback || base;
  switch (col.type) {
    case 'VARCHAR':
      return d === 'oracle' ? withLen('VARCHAR2', 'VARCHAR2(255)') : withLen('VARCHAR', 'VARCHAR(255)');
    case 'CHAR':
      return withLen('CHAR', 'CHAR(1)');
    case 'INT':
      if (d === 'oracle') return 'NUMBER(10)';
      if (d === 'postgresql') return 'INTEGER';
      return 'INT';
    case 'BIGINT':
      return d === 'oracle' ? 'NUMBER(19)' : 'BIGINT';
    case 'DECIMAL':
      if (d === 'oracle') return withLen('NUMBER', 'NUMBER(18,2)');
      if (d === 'postgresql') return withLen('NUMERIC', 'NUMERIC(18,2)');
      return withLen('DECIMAL', 'DECIMAL(18,2)');
    case 'FLOAT':
      if (d === 'oracle') return 'BINARY_DOUBLE';
      if (d === 'postgresql') return 'DOUBLE PRECISION';
      if (d === 'mysql') return 'DOUBLE';
      return 'FLOAT';
    case 'DATE':
      return 'DATE';
    case 'DATETIME':
      if (d === 'oracle') return 'TIMESTAMP';
      if (d === 'mssql') return 'DATETIME2';
      if (d === 'postgresql') return 'TIMESTAMP';
      return 'DATETIME';
    case 'TEXT':
      if (d === 'oracle') return 'CLOB';
      if (d === 'mssql') return 'NVARCHAR(MAX)';
      if (d === 'postgresql') return 'TEXT';
      return 'LONGTEXT';
    case 'BOOLEAN':
      if (d === 'oracle') return 'NUMBER(1)';
      if (d === 'mssql') return 'BIT';
      if (d === 'postgresql') return 'BOOLEAN';
      return 'TINYINT(1)';
    default:
      return 'VARCHAR(255)';
  }
}

// 식별자 인용
function quote(id: string, d: Dialect, on: boolean): string {
  if (!on) return id;
  if (d === 'mssql') return `[${id}]`;
  if (d === 'mysql') return '`' + id + '`';
  return `"${id}"`; // oracle / postgresql
}

function qualifiedName(t: Table, d: Dialect, on: boolean): string {
  const tbl = quote(t.name, d, on);
  if (t.schema.trim()) return `${quote(t.schema.trim(), d, on)}.${tbl}`;
  return tbl;
}

// 단일 테이블 DDL
export function generateTableDDL(t: Table, d: Dialect, opt: DdlOptions): string {
  if (!t.name.trim() || t.columns.length === 0) return '';
  const q = opt.quoteIdentifiers;
  const fq = qualifiedName(t, d, q);
  const lines: string[] = [];

  if (opt.includeDrop) {
    if (d === 'mssql') {
      lines.push(`IF OBJECT_ID('${t.schema.trim() ? t.schema.trim() + '.' : ''}${t.name}', 'U') IS NOT NULL DROP TABLE ${fq};`);
    } else if (d === 'mysql' || d === 'postgresql') {
      lines.push(`DROP TABLE IF EXISTS ${fq};`);
    } else {
      lines.push(`-- DROP TABLE ${fq};`);
    }
  }

  // 컬럼 폭 정렬
  const colNames = t.columns.map((c) => quote(c.name, d, q));
  const nameW = Math.max(...colNames.map((n) => n.length));
  const typeStrs = t.columns.map((c) => mapType(c, d));
  const typeW = Math.max(...typeStrs.map((s) => s.length));

  const colDefs = t.columns.map((c, i) => {
    let line = `    ${colNames[i].padEnd(nameW)} ${typeStrs[i].padEnd(typeW)}`;
    if (c.defaultValue.trim()) line += ` DEFAULT ${c.defaultValue.trim()}`;
    if (c.notNull || c.pk) line += ' NOT NULL';
    if (c.unique && !c.pk) line += ' UNIQUE';
    // MySQL 인라인 컬럼 주석
    if (opt.includeComments && d === 'mysql' && c.comment.trim()) {
      line += ` COMMENT '${c.comment.replace(/'/g, "''")}'`;
    }
    return line;
  });

  const pkCols = t.columns.filter((c) => c.pk).map((c) => quote(c.name, d, q));
  const body = [...colDefs];
  if (pkCols.length) {
    const pkName = `PK_${t.name.toUpperCase()}`;
    body.push(`    CONSTRAINT ${quote(pkName, d, q)} PRIMARY KEY (${pkCols.join(', ')})`);
  }

  let create = `CREATE TABLE ${fq} (\n${body.join(',\n')}\n)`;
  if (d === 'mysql') {
    create += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    if (opt.includeComments && t.comment.trim()) {
      create += ` COMMENT='${t.comment.replace(/'/g, "''")}'`;
    }
  }
  create += ';';
  lines.push(create);

  // 주석 (oracle / postgresql: COMMENT ON, mssql: 안내 주석)
  if (opt.includeComments && (d === 'oracle' || d === 'postgresql')) {
    const cmts: string[] = [];
    if (t.comment.trim()) cmts.push(`COMMENT ON TABLE ${fq} IS '${t.comment.replace(/'/g, "''")}';`);
    t.columns.forEach((c) => {
      if (c.comment.trim()) {
        cmts.push(`COMMENT ON COLUMN ${fq}.${quote(c.name, d, q)} IS '${c.comment.replace(/'/g, "''")}';`);
      }
    });
    if (cmts.length) lines.push('', ...cmts);
  }
  if (opt.includeComments && d === 'mssql') {
    const cmts = t.columns.filter((c) => c.comment.trim()).map((c) => `-- ${c.name}: ${c.comment}`);
    if (t.comment.trim()) cmts.unshift(`-- TABLE ${t.name}: ${t.comment}`);
    if (cmts.length) lines.push('', ...cmts);
  }

  // 인덱스
  const idxLines = (t.indexes || [])
    .filter((ix) => ix.columns.filter((c) => c && c.trim()).length > 0)
    .map((ix, i) => {
      const cols = ix.columns.filter((c) => c && c.trim()).map((c) => quote(c, d, q)).join(', ');
      const nm = ix.name.trim() || `${ix.unique ? 'UX' : 'IX'}_${t.name.toUpperCase()}_${i + 1}`;
      return `CREATE ${ix.unique ? 'UNIQUE ' : ''}INDEX ${quote(nm, d, q)} ON ${fq} (${cols});`;
    });
  if (idxLines.length) lines.push('', ...idxLines);

  return lines.join('\n');
}

// 여러 테이블 DDL
export function generateDDL(tables: Table[], d: Dialect, opt: DdlOptions): string {
  const blocks = tables.map((t) => generateTableDDL(t, d, opt)).filter(Boolean);
  return blocks.join('\n\n');
}

// ── ERD 관계선 → FOREIGN KEY 제약 DDL ───────────────────────
// from(자식, FK 보유) → to(부모, PK 참조). 다중 컬럼 / 자기참조 지원.
export interface Relation {
  fromTable: string; fromSchema?: string; fromColumns: string[];
  toTable: string;   toSchema?: string;   toColumns: string[];
  index?: number;    // 같은 두 테이블 간 FK가 여러 개일 때 제약명 충돌 방지
}

function qual(name: string, schema: string | undefined, d: Dialect, on: boolean): string {
  const tbl = quote(name, d, on);
  return schema && schema.trim() ? `${quote(schema.trim(), d, on)}.${tbl}` : tbl;
}

export function generateFkDDL(rels: Relation[], d: Dialect, opt: DdlOptions): string {
  const q = opt.quoteIdentifiers;
  const lines: string[] = [];
  rels.forEach((r) => {
    // 빈 컬럼 쌍 제거 (from/to 둘 다 채워진 쌍만)
    const pairs: [string, string][] = [];
    const len = Math.min(r.fromColumns.length, r.toColumns.length);
    for (let i = 0; i < len; i++) {
      if (r.fromColumns[i] && r.toColumns[i]) pairs.push([r.fromColumns[i], r.toColumns[i]]);
    }
    if (!r.fromTable || !r.toTable || pairs.length === 0) return;
    const fromFq = qual(r.fromTable, r.fromSchema, d, q);
    const toFq = qual(r.toTable, r.toSchema, d, q);
    const suffix = r.index && r.index > 0 ? `_${r.index}` : '';
    const cn = quote(`FK_${r.fromTable.toUpperCase()}_${r.toTable.toUpperCase()}${suffix}`, d, q);
    const fromCols = pairs.map((p) => quote(p[0], d, q)).join(', ');
    const toCols = pairs.map((p) => quote(p[1], d, q)).join(', ');
    lines.push(`ALTER TABLE ${fromFq} ADD CONSTRAINT ${cn} FOREIGN KEY (${fromCols}) REFERENCES ${toFq} (${toCols});`);
  });
  return lines.join('\n');
}

// 고유 ID 생성 (Math.random 사용 — 클라이언트 전용이라 무방)
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newColumn(partial?: Partial<Column>): Column {
  return {
    id: uid(),
    name: '',
    type: 'VARCHAR',
    length: '',
    pk: false,
    notNull: false,
    unique: false,
    defaultValue: '',
    comment: '',
    ...partial,
  };
}

export function newIndex(partial?: Partial<TableIndex>): TableIndex {
  return { id: uid(), name: '', columns: [], unique: false, ...partial };
}

export function newTable(name = 'NEW_TABLE'): Table {
  return {
    name,
    schema: '',
    comment: '',
    columns: [
      newColumn({ name: 'ID', type: 'INT', pk: true, notNull: true }),
    ],
    indexes: [],
  };
}
