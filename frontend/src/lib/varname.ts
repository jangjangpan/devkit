// 변수명 추천 — 한글/영문 입력 → 영어 단어열 → 언어별 네이밍 컨벤션.
// 외부 번역 API 없이 내장 사전 + 한글 로마자 폴백으로 동작(폐쇄망 안전).

// 자주 쓰는 개발/업무(특히 제조·SCM) 용어 사전. 값은 소문자 영어(복수 단어는 공백 구분).
const DICT: Record<string, string> = {
  // 사용자/조직
  사용자: 'user', 회원: 'member', 고객: 'customer', 관리자: 'admin', 직원: 'employee', 사원: 'employee',
  이름: 'name', 성명: 'name', 별명: 'nickname', 비밀번호: 'password', 암호: 'password', 계정: 'account',
  권한: 'auth', 역할: 'role', 부서: 'dept', 조직: 'organization', 회사: 'company', 사번: 'emp no',
  직급: 'grade', 직책: 'position', 팀: 'team', 담당자: 'manager', 작성자: 'writer', 등록자: 'creator', 수정자: 'modifier',
  // 공통 속성
  번호: 'no', 코드: 'code', 구분: 'type', 종류: 'type', 유형: 'type', 상태: 'status', 값: 'value', 키: 'key',
  목록: 'list', 항목: 'item', 내용: 'content', 제목: 'title', 설명: 'desc', 비고: 'remark', 메모: 'memo',
  정보: 'info', 상세: 'detail', 요약: 'summary', 순번: 'seq', 순서: 'order', 우선순위: 'priority',
  레벨: 'level', 단계: 'step', 그룹: 'group', 분류: 'category', 태그: 'tag', 색상: 'color',
  // 날짜/시간
  날짜: 'date', 일시: 'datetime', 시간: 'time', 시각: 'time', 년: 'year', 월: 'month', 일: 'day',
  주: 'week', 주차: 'week', 분기: 'quarter', 기간: 'period', 시작: 'start', 종료: 'end',
  등록일: 'reg date', 수정일: 'mod date', 생성일: 'created date', 변경일: 'mod date',
  // 수량/금액
  수량: 'qty', 개수: 'count', 금액: 'amount', 가격: 'price', 단가: 'unit price', 합계: 'total', 소계: 'subtotal',
  총액: 'total amount', 비율: 'rate', 퍼센트: 'percent', 평균: 'avg', 최대: 'max', 최소: 'min', 합: 'sum',
  잔액: 'balance', 단위: 'unit', 규격: 'spec', 사양: 'spec', 용량: 'capacity', 무게: 'weight', 크기: 'size',
  // 거래/물류
  주문: 'order', 발주: 'purchase order', 구매: 'purchase', 판매: 'sales', 매출: 'sales', 매입: 'purchase',
  재고: 'stock', 입고: 'inbound', 출고: 'outbound', 배송: 'delivery', 상품: 'product', 제품: 'product',
  물품: 'goods', 자재: 'material', 모델: 'model', 창고: 'warehouse', 거래처: 'vendor', 공급사: 'supplier', 협력사: 'partner',
  // 생산/제조
  생산: 'production', 계획: 'plan', 실적: 'result', 공정: 'process', 설비: 'equipment', 라인: 'line',
  공장: 'factory', 수율: 'yield', 능력: 'capa', 가동: 'operation', 불량: 'defect', 검사: 'inspection', 품질: 'quality',
  // 동작
  조회: 'search', 검색: 'search', 등록: 'register', 입력: 'input', 수정: 'update', 변경: 'change', 삭제: 'delete',
  저장: 'save', 추가: 'add', 제거: 'remove', 처리: 'process', 실행: 'run', 확인: 'confirm', 취소: 'cancel',
  승인: 'approve', 반려: 'reject', 전송: 'send', 수신: 'receive', 출력: 'print', 다운로드: 'download', 업로드: 'upload',
  복사: 'copy', 이동: 'move', 정렬: 'sort', 필터: 'filter', 계산: 'calc', 검증: 'validate', 변환: 'convert',
  // 플래그/기타
  플래그: 'flag', 여부: 'yn', 사용여부: 'use yn', 사용: 'use', 활성: 'active', 비활성: 'inactive', 잠금: 'lock',
  공개: 'public', 기본: 'default', 임시: 'temp', 전체: 'all', 선택: 'select', 대상: 'target', 결과: 'result',
  오류: 'error', 에러: 'error', 메시지: 'message', 화면: 'screen', 보고서: 'report', 파일: 'file', 폴더: 'folder',
  경로: 'path', 주소: 'address', 전화번호: 'phone', 이메일: 'email', 우편번호: 'zip code', 국가: 'country', 지역: 'region',
};

const MAXKEY = 4; // 사전 키 최대 길이(글자)

const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];

const isHangul = (ch: string) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; };
function romanize(ch: string): string {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '';
  return CHO[Math.floor(code / 588)] + JUNG[Math.floor((code % 588) / 28)] + JONG[code % 28];
}

// 한글 토큰을 사전 최장일치로 분절 → 영어 단어 배열
function segKorean(tok: string): string[] {
  const words: string[] = [];
  let roman = '';
  const flush = () => { if (roman) { words.push(roman); roman = ''; } };
  let i = 0;
  while (i < tok.length) {
    let matched = false;
    for (let len = Math.min(MAXKEY, tok.length - i); len >= 1; len--) {
      const sub = tok.slice(i, i + len);
      if (DICT[sub]) { flush(); DICT[sub].split(/\s+/).forEach((w) => words.push(w)); i += len; matched = true; break; }
    }
    if (matched) continue;
    const ch = tok[i];
    if (isHangul(ch)) { roman += romanize(ch); i++; }
    else if (/[A-Za-z0-9]/.test(ch)) { roman += ch.toLowerCase(); i++; }
    else { flush(); i++; }
  }
  flush();
  return words;
}

function splitEnglish(tok: string): string[] {
  return tok.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());
}

// 입력(한글/영문/혼합) → 영어 base 단어 배열
export function toWords(input: string): string[] {
  return (input || '').trim().split(/\s+/).flatMap((tok) => {
    if (/^[\x00-\x7F]+$/.test(tok)) return splitEnglish(tok);
    return segKorean(tok);
  }).filter(Boolean);
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export interface Cases { camel: string; pascal: string; snake: string; upper: string; kebab: string; }
export function toCases(words: string[]): Cases {
  return {
    camel: words.map((w, i) => (i ? cap(w) : w)).join(''),
    pascal: words.map(cap).join(''),
    snake: words.join('_'),
    upper: words.join('_').toUpperCase(),
    kebab: words.join('-'),
  };
}

export interface Suggestion { use: string; value: string; }
export interface LangSuggest { lang: string; items: Suggestion[]; }

// 언어별 추천 (용도 + 값)
export function suggestByLang(words: string[]): LangSuggest[] {
  if (words.length === 0) return [];
  const c = toCases(words);
  return [
    { lang: 'SQL', items: [
      { use: '컬럼/변수 (snake_case)', value: c.snake },
      { use: '상수/대문자 컬럼', value: c.upper },
      { use: 'i-AUD 바인드 변수', value: ':VS_' + c.upper },
    ] },
    { lang: 'Java', items: [
      { use: '변수·메서드 (camelCase)', value: c.camel },
      { use: '클래스 (PascalCase)', value: c.pascal },
      { use: '상수 (UPPER_SNAKE)', value: c.upper },
    ] },
    { lang: 'JavaScript', items: [
      { use: '변수·함수 (camelCase)', value: c.camel },
      { use: '클래스·컴포넌트 (PascalCase)', value: c.pascal },
      { use: '상수 (UPPER_SNAKE)', value: c.upper },
    ] },
    { lang: 'Python', items: [
      { use: '변수·함수 (snake_case)', value: c.snake },
      { use: '클래스 (PascalCase)', value: c.pascal },
      { use: '상수 (UPPER_SNAKE)', value: c.upper },
    ] },
  ];
}
