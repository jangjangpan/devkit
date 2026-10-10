// PEP 8 기준 안전한 공백/들여쓰기 정리기 (문자열·주석 보존).
// 전체 재포매팅(black 수준)은 Python 런타임이 필요하므로, 깨질 위험이 없는 규칙만 적용한다:
//  - 콤마 뒤 한 칸 공백 / 콤마 앞 공백 제거 (닫는 괄호 앞은 공백 없음)
//  - 앞 들여쓰기 tab → 4칸 space
//  - 줄 끝 공백 제거
//  - 연속 빈 줄 3개 이상 → 2개
//  - 파일 끝 개행 1개

// 문자열/주석을 인지해 코드 영역에서만 콤마 공백 정리
function commaSpacing(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // 주석
    if (c === '#') {
      const nl = src.indexOf('\n', i);
      const end = nl < 0 ? n : nl;
      out += src.slice(i, end);
      i = end;
      continue;
    }
    // 문자열 (삼중/단일/이중)
    if (c === '"' || c === "'") {
      const triple = src.substr(i, 3);
      const q = (triple === '"""' || triple === "'''") ? triple : c;
      out += src.slice(i, i + q.length);
      i += q.length;
      while (i < n) {
        if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
        if (src.substr(i, q.length) === q) { out += q; i += q.length; break; }
        out += src[i]; i++;
      }
      continue;
    }
    // 콤마: 앞 공백 제거 + 뒤 한 칸(닫는 괄호 앞이면 생략)
    if (c === ',') {
      out = out.replace(/[ \t]+$/, '');
      out += ',';
      i++;
      // 뒤 공백 스킵
      let j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) j++;
      const next = src[j];
      if (next && next !== '\n' && next !== ')' && next !== ']' && next !== '}') {
        out += ' ';
      }
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export function formatPep8(src: string): string {
  let s = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = commaSpacing(s);
  s = s.split('\n').map((line) => {
    // 앞 들여쓰기 tab → 4 space
    const m = line.match(/^[\t ]+/);
    if (m) {
      const indent = m[0].replace(/\t/g, '    ');
      line = indent + line.slice(m[0].length);
    }
    return line.replace(/[ \t]+$/, ''); // 줄 끝 공백 제거
  }).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n');     // 빈 줄 최대 2
  s = s.replace(/\n+$/, '\n');          // 끝 개행 1개
  if (!s.endsWith('\n')) s += '\n';
  return s;
}
