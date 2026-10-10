// @ts-nocheck
/* eslint-disable */
// ============================================================
// SQL 자동 정렬기 — i-AUD 보고서(REP94454857...)의 포매터 로직을 그대로 포팅.
// 원본: report.mtsd ScriptText (tokenizeSql + SqlFormatter + formatSQL).
// i-AUD 바인딩 변수(:VS_, @:, %:, $), <@TOKEN@> 지시자, 주석/문자열 보존 규칙을
// 100% 동일하게 유지한다. UI(initUI/CSS/HTML) 부분만 제거하고 React로 대체.
// ============================================================

// 문자열 선두의 공백 부분만 반환 (선두 주석을 "바로 아래 줄"의 시작 컬럼에 맞추는 데 사용)
function leadingSpaces(s) {
    var m = /^[ \t]*/.exec(s);
    return m ? m[0] : "";
}
function isWordStart(c) {
    return /[A-Za-z_$#]/.test(c);
}
function isWordCont(c) {
    return /[A-Za-z0-9_$#]/.test(c);
}
function tokenizeSql(sql) {
    var out = [];
    var len = sql.length;
    var i = 0;
    while (i < len) {
        var c = sql.charAt(i);
        // whitespace
        if (c === " " || c === "\t" || c === "\r" || c === "\n") {
            i++;
            continue;
        }
        // line comment
        if (c === "-" && sql.charAt(i + 1) === "-") {
            var s = i;
            while (i < len && sql.charAt(i) !== "\n")
                i++;
            var v = sql.substring(s, i);
            // strip trailing whitespace at end of comment
            var trimmed = v.replace(/[ \t\r]+$/, "");
            out.push({ type: "cmt-line", value: trimmed, upper: "", start: s, end: i });
            continue;
        }
        // block comment
        if (c === "/" && sql.charAt(i + 1) === "*") {
            var s = i;
            i += 2;
            while (i < len - 1 && !(sql.charAt(i) === "*" && sql.charAt(i + 1) === "/"))
                i++;
            i = Math.min(i + 2, len);
            out.push({ type: "cmt-block", value: sql.substring(s, i), upper: "", start: s, end: i });
            continue;
        }
        // single-quoted string
        if (c === "'") {
            var s = i;
            i++;
            while (i < len) {
                if (sql.charAt(i) === "'" && sql.charAt(i + 1) === "'") {
                    i += 2;
                    continue;
                }
                if (sql.charAt(i) === "'") {
                    i++;
                    break;
                }
                i++;
            }
            out.push({ type: "string", value: sql.substring(s, i), upper: "", start: s, end: i });
            continue;
        }
        // double-quoted identifier
        if (c === "\"") {
            var s = i;
            i++;
            while (i < len && sql.charAt(i) !== "\"")
                i++;
            if (i < len)
                i++;
            var v = sql.substring(s, i);
            out.push({ type: "word", value: v, upper: v.toUpperCase(), start: s, end: i });
            continue;
        }
        // <@TOKEN@> i-AUD 특수 지시자
        if (c === "<" && sql.charAt(i + 1) === "@") {
            var s = i;
            i += 2;
            while (i < len - 1 && !(sql.charAt(i) === "@" && sql.charAt(i + 1) === ">"))
                i++;
            if (i < len)
                i += 2;
            var v = sql.substring(s, i);
            out.push({ type: "word", value: v, upper: v.toUpperCase(), start: s, end: i });
            continue;
        }
        if (c === "(") {
            out.push({ type: "po", value: "(", upper: "(", start: i, end: i + 1 });
            i++;
            continue;
        }
        if (c === ")") {
            out.push({ type: "pc", value: ")", upper: ")", start: i, end: i + 1 });
            i++;
            continue;
        }
        if (c === ",") {
            out.push({ type: "comma", value: ",", upper: ",", start: i, end: i + 1 });
            i++;
            continue;
        }
        // number
        if (c >= "0" && c <= "9") {
            var s = i;
            while (i < len && /[0-9.]/.test(sql.charAt(i)))
                i++;
            if (i < len && (sql.charAt(i) === "e" || sql.charAt(i) === "E")) {
                i++;
                if (i < len && (sql.charAt(i) === "+" || sql.charAt(i) === "-"))
                    i++;
                while (i < len && /[0-9]/.test(sql.charAt(i)))
                    i++;
            }
            out.push({ type: "number", value: sql.substring(s, i), upper: "", start: s, end: i });
            continue;
        }
        // i-AUD 바인딩 변수: @:VS_FOO, %:VS_FOO, :VS_FOO, :VS_FOO$
        if (c === "@" || c === "%" || c === ":") {
            var s = i;
            if (c === "@" || c === "%") {
                i++;
                if (sql.charAt(i) === ":")
                    i++;
            }
            else {
                i++;
            }
            while (i < len && isWordCont(sql.charAt(i)))
                i++;
            if (i < len && sql.charAt(i) === "$")
                i++;
            // 트레일링 % (LIKE 와일드카드: %:VS_KEYWORD%)
            if (i < len && sql.charAt(i) === "%" && sql.charAt(s) === "%")
                i++;
            var v = sql.substring(s, i);
            out.push({ type: "word", value: v, upper: v.toUpperCase(), start: s, end: i });
            continue;
        }
        // word (identifier or keyword), 도트 표기법 지원: T1.COL, SCHEMA.TBL.COL
        if (isWordStart(c)) {
            var s = i;
            i++;
            while (i < len && isWordCont(sql.charAt(i)))
                i++;
            // dotted parts
            while (i < len && sql.charAt(i) === "." && i + 1 < len && (/[A-Za-z_*]/.test(sql.charAt(i + 1)))) {
                i++;
                if (sql.charAt(i) === "*") {
                    i++;
                    break;
                }
                while (i < len && isWordCont(sql.charAt(i)))
                    i++;
            }
            var v = sql.substring(s, i);
            out.push({ type: "word", value: v, upper: v.toUpperCase(), start: s, end: i });
            continue;
        }
        // multi-char operators
        if (c === "<" || c === ">" || c === "!" || c === "|" || c === "&") {
            var s = i;
            var j = i + 1;
            if (j < len && (sql.charAt(j) === "=" || sql.charAt(j) === ">" || sql.charAt(j) === "|" || sql.charAt(j) === "&" || sql.charAt(j) === "<"))
                j++;
            out.push({ type: "punct", value: sql.substring(s, j), upper: "", start: s, end: j });
            i = j;
            continue;
        }
        // single punctuation
        out.push({ type: "punct", value: c, upper: "", start: i, end: i + 1 });
        i++;
    }
    return out;
}
var SqlFormatter = /** @class */ (function () {
    function SqlFormatter(sql) {
        // SELECT 컬럼 리스트의 AS 를 세로 정렬할지 여부 (MERGE USING 서브쿼리 범위에서만 true)
        this.alignSelectAs = false;
        this.sql = sql;
        this.tokens = tokenizeSql(sql);
    }
    SqlFormatter.prototype.format = function () {
        if (!this.sql)
            return "";
        if (this.tokens.length === 0)
            return this.sql;
        // 선두 코멘트 분리
        var firstIdx = 0;
        var prelude = [];
        while (firstIdx < this.tokens.length && this.isComment(this.tokens[firstIdx])) {
            prelude.push(this.tokens[firstIdx].value);
            firstIdx++;
        }
        if (firstIdx >= this.tokens.length) {
            return prelude.join("\n");
        }
        var stmt = this.tokens[firstIdx].upper;
        // SELECT문 단편(fragment)으로도 인식 — FROM/WHERE/GROUP/ORDER 등으로 시작해도 정렬.
        var SELECT_FRAG_STARTS = [
            "SELECT", "WITH",
            "FROM", "WHERE", "HAVING", "GROUP", "ORDER",
            "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS",
            "UNION", "INTERSECT", "EXCEPT", "MINUS",
            "START", "CONNECT", "LIMIT", "OFFSET"
        ];
        var body = "";
        if (stmt === "INSERT") {
            body = this.formatInsertStmt(firstIdx, this.tokens.length, 0);
        }
        else if (stmt === "UPDATE") {
            body = this.formatUpdateStmt(firstIdx, this.tokens.length, 0);
        }
        else if (stmt === "DELETE") {
            body = this.formatDeleteStmt(firstIdx, this.tokens.length, 0);
        }
        else if (stmt === "MERGE") {
            body = this.formatMergeStmt(firstIdx, this.tokens.length, 0);
        }
        else if (SELECT_FRAG_STARTS.indexOf(stmt) >= 0) {
            body = this.formatSelectStmt(firstIdx, this.tokens.length, 0);
        }
        else {
            return this.sql;
        }
        if (prelude.length > 0)
            return prelude.join("\n") + "\n" + body;
        return body;
    };
    SqlFormatter.prototype.isComment = function (t) {
        return t.type === "cmt-line" || t.type === "cmt-block";
    };
    SqlFormatter.prototype.getRawText = function (startIdx, endIdx) {
        if (startIdx >= endIdx)
            return "";
        var s = this.tokens[startIdx].start;
        var e = this.tokens[endIdx - 1].end;
        return this.sql.substring(s, e);
    };
    /**
     * 토큰 범위의 텍스트를 한 줄로 정규화합니다 (공백 압축, 코멘트 제거).
     */
    SqlFormatter.prototype.normalize = function (startIdx, endIdx) {
        if (startIdx >= endIdx)
            return "";
        var parts = [];
        for (var i = startIdx; i < endIdx; i++) {
            var t = this.tokens[i];
            if (this.isComment(t))
                continue;
            parts.push(this.appendToken(parts.length > 0 ? parts[parts.length - 1] : "", t));
        }
        // Re-assemble with smart spacing.
        // 표현식 내부에 박힌 주석은 삭제하지 않고 인라인 블록주석(/* */)으로 보존한다.
        // (라인 주석 `--`는 한 줄로 합쳐지는 normalize 결과에서 뒷부분을 통째로 주석처리하므로 블록으로 변환)
        var out = "";
        var prev = null;
        for (var i = startIdx; i < endIdx; i++) {
            var t = this.tokens[i];
            if (this.isComment(t)) {
                var cmt = this.commentToInline(t);
                if (cmt) { out += (out.length > 0 && !/\s$/.test(out) ? " " : "") + cmt; prev = t; }
                continue;
            }
            out += this.spaceBetween(prev, t) + this.renderTokenValue(t);
            prev = t;
        }
        return out.trim();
    };
    /** 코멘트 토큰을 단일 라인 안전한 인라인 블록주석 문자열로 변환 */
    SqlFormatter.prototype.commentToInline = function (t) {
        if (t.type === "cmt-block")
            return t.value;
        if (t.type === "cmt-line") {
            var body = t.value.replace(/^--/, "").replace(/\s+$/, "").replace(/\*\//g, "* /");
            return "/*" + body + " */";
        }
        return "";
    };
    /**
     * 토큰을 출력 문자열로 변환합니다. 일반 식별자/키워드는 대문자화하고,
     * 문자열 리터럴('...'), 코멘트, 숫자, 바인드 변수(:foo / @:VS_X / %:VS_X),
     * 큰따옴표 식별자("Col"), i-AUD 지시자(<@...@>)는 원본 케이스를 유지합니다.
     */
    SqlFormatter.prototype.renderTokenValue = function (t) {
        if (t.type !== "word")
            return t.value;
        var v = t.value;
        if (!v)
            return v;
        // 일반 식별자/키워드만 대문자화 (대소문자 알파벳, _, $, # 으로 시작)
        return /^[A-Za-z_$#]/.test(v) ? v.toUpperCase() : v;
    };
    /** 두 토큰 사이에 들어갈 공백 결정 */
    SqlFormatter.prototype.spaceBetween = function (prev, cur) {
        if (prev === null)
            return "";
        // no space before/after
        if (cur.type === "pc")
            return "";
        if (cur.type === "comma")
            return "";
        if (prev.type === "po")
            return "";
        // 함수 호출: 식별자 직후 ( 는 공백 없음. 단 IN/EXISTS 등 키워드는 공백 유지
        if (cur.type === "po" && prev.type === "word") {
            return this.isKeywordBeforeParen(prev.upper) ? " " : "";
        }
        // 도트는 토큰 안에 포함되어 있으므로 별도 처리 불필요
        // 기본은 공백 1
        return " ";
    };
    /** `(` 앞에 공백을 유지해야 하는 키워드 (함수가 아닌 연산자/술어) */
    SqlFormatter.prototype.isKeywordBeforeParen = function (upper) {
        return upper === "IN" || upper === "EXISTS"
            || upper === "ALL" || upper === "ANY" || upper === "SOME";
    };
    /** (legacy helper; appendToken은 위 normalize 내부에서 사용 안 함) */
    SqlFormatter.prototype.appendToken = function (_acc, _t) {
        return "";
    };
    // ------------------------------------------------------------
    // 절(clause) 식별
    // ------------------------------------------------------------
    SqlFormatter.prototype.matchClauseKeyword = function (i, end) {
        var t = this.tokens[i];
        if (t.type !== "word")
            return null;
        var u = t.upper;
        var n = i + 1 < end ? this.tokens[i + 1].upper : "";
        var n2 = i + 2 < end ? this.tokens[i + 2].upper : "";
        if (u === "LEFT" && n === "OUTER" && n2 === "JOIN")
            return { keyword: "LEFT OUTER JOIN", contentStart: i + 3 };
        if (u === "RIGHT" && n === "OUTER" && n2 === "JOIN")
            return { keyword: "RIGHT OUTER JOIN", contentStart: i + 3 };
        if (u === "FULL" && n === "OUTER" && n2 === "JOIN")
            return { keyword: "FULL OUTER JOIN", contentStart: i + 3 };
        if (u === "WHEN" && n === "NOT" && n2 === "MATCHED")
            return { keyword: "WHEN NOT MATCHED", contentStart: i + 3 };
        if (u === "INNER" && n === "JOIN")
            return { keyword: "INNER JOIN", contentStart: i + 2 };
        if (u === "LEFT" && n === "JOIN")
            return { keyword: "LEFT JOIN", contentStart: i + 2 };
        if (u === "RIGHT" && n === "JOIN")
            return { keyword: "RIGHT JOIN", contentStart: i + 2 };
        if (u === "FULL" && n === "JOIN")
            return { keyword: "FULL JOIN", contentStart: i + 2 };
        if (u === "CROSS" && n === "JOIN")
            return { keyword: "CROSS JOIN", contentStart: i + 2 };
        if (u === "GROUP" && n === "BY")
            return { keyword: "GROUP BY", contentStart: i + 2 };
        if (u === "ORDER" && n === "BY")
            return { keyword: "ORDER BY", contentStart: i + 2 };
        if (u === "UNION" && n === "ALL")
            return { keyword: "UNION ALL", contentStart: i + 2 };
        if (u === "INSERT" && n === "INTO")
            return { keyword: "INSERT INTO", contentStart: i + 2 };
        if (u === "MERGE" && n === "INTO")
            return { keyword: "MERGE INTO", contentStart: i + 2 };
        if (u === "WHEN" && n === "MATCHED")
            return { keyword: "WHEN MATCHED", contentStart: i + 2 };
        if (u === "START" && n === "WITH")
            return { keyword: "START WITH", contentStart: i + 2 };
        if (u === "CONNECT" && n === "BY")
            return { keyword: "CONNECT BY", contentStart: i + 2 };
        var SINGLE = [
            "SELECT", "INTO", "FROM", "WHERE", "HAVING", "JOIN", "ON", "USING",
            "UNION", "INTERSECT", "EXCEPT", "MINUS",
            "VALUES", "SET", "UPDATE", "DELETE", "WITH", "LIMIT", "OFFSET",
            "FETCH"
        ];
        if (SINGLE.indexOf(u) >= 0)
            return { keyword: u, contentStart: i + 1 };
        return null;
    };
    SqlFormatter.prototype.getClauses = function (start, end) {
        var found = [];
        var depth = 0;
        var i = start;
        while (i < end) {
            var t = this.tokens[i];
            if (t.type === "po") {
                depth++;
                i++;
                continue;
            }
            if (t.type === "pc") {
                depth--;
                i++;
                continue;
            }
            if (depth !== 0) {
                i++;
                continue;
            }
            var m = this.matchClauseKeyword(i, end);
            if (m) {
                found.push({ keyword: m.keyword, kwStart: i, contentStart: m.contentStart });
                i = m.contentStart;
            }
            else {
                i++;
            }
        }
        var result = [];
        for (var k = 0; k < found.length; k++) {
            var cur = found[k];
            var nextStart = k + 1 < found.length ? found[k + 1].kwStart : end;
            result.push({
                keyword: cur.keyword,
                kwStart: cur.kwStart,
                contentStart: cur.contentStart,
                contentEnd: nextStart
            });
        }
        return result;
    };
    /**
     * MERGE 전용 절 분리. MERGE 레벨 키워드만 인식한다.
     * (UPDATE/SET/VALUES/INSERT 는 절 경계로 보지 않고 WHEN 분기 내부 컨텐츠로 유지)
     */
    SqlFormatter.prototype.getMergeClauses = function (start, end) {
        var found = [];
        var depth = 0;
        var i = start;
        while (i < end) {
            var t = this.tokens[i];
            if (t.type === "po") {
                depth++;
                i++;
                continue;
            }
            if (t.type === "pc") {
                depth--;
                i++;
                continue;
            }
            if (depth !== 0) {
                i++;
                continue;
            }
            var m = this.matchMergeClauseKeyword(i, end);
            if (m) {
                found.push({ keyword: m.keyword, kwStart: i, contentStart: m.contentStart });
                i = m.contentStart;
            }
            else {
                i++;
            }
        }
        var result = [];
        for (var k = 0; k < found.length; k++) {
            var cur = found[k];
            var nextStart = k + 1 < found.length ? found[k + 1].kwStart : end;
            result.push({
                keyword: cur.keyword,
                kwStart: cur.kwStart,
                contentStart: cur.contentStart,
                contentEnd: nextStart
            });
        }
        return result;
    };
    SqlFormatter.prototype.matchMergeClauseKeyword = function (i, end) {
        var t = this.tokens[i];
        if (t.type !== "word")
            return null;
        var u = t.upper;
        var n = i + 1 < end ? this.tokens[i + 1].upper : "";
        var n2 = i + 2 < end ? this.tokens[i + 2].upper : "";
        if (u === "MERGE" && n === "INTO")
            return { keyword: "MERGE INTO", contentStart: i + 2 };
        if (u === "WHEN" && n === "NOT" && n2 === "MATCHED")
            return { keyword: "WHEN NOT MATCHED", contentStart: i + 3 };
        if (u === "WHEN" && n === "MATCHED")
            return { keyword: "WHEN MATCHED", contentStart: i + 2 };
        if (u === "USING")
            return { keyword: "USING", contentStart: i + 1 };
        if (u === "ON")
            return { keyword: "ON", contentStart: i + 1 };
        return null;
    };
    // ------------------------------------------------------------
    // 분할 헬퍼
    // ------------------------------------------------------------
    SqlFormatter.prototype.splitByCommas = function (start, end) {
        var result = [];
        var depth = 0;
        var segStart = start;
        for (var i = start; i < end; i++) {
            var t = this.tokens[i];
            if (t.type === "po") {
                depth++;
                continue;
            }
            if (t.type === "pc") {
                depth--;
                continue;
            }
            if (depth === 0 && t.type === "comma") {
                result.push({ start: segStart, end: i });
                segStart = i + 1;
            }
        }
        if (segStart < end)
            result.push({ start: segStart, end: end });
        return result;
    };
    SqlFormatter.prototype.splitByAndOr = function (start, end) {
        var result = [];
        var depth = 0;
        var caseDepth = 0;
        var betweenPending = false;
        var segStart = start;
        var currentConnector = "";
        for (var i = start; i < end; i++) {
            var t = this.tokens[i];
            if (t.type === "po") {
                depth++;
                continue;
            }
            if (t.type === "pc") {
                depth--;
                continue;
            }
            if (depth !== 0)
                continue;
            if (t.type !== "word")
                continue;
            var u = t.upper;
            if (u === "CASE") {
                caseDepth++;
                continue;
            }
            if (u === "END" && caseDepth > 0) {
                caseDepth--;
                continue;
            }
            if (u === "BETWEEN") {
                betweenPending = true;
                continue;
            }
            if (caseDepth === 0 && (u === "AND" || u === "OR")) {
                if (betweenPending && u === "AND") {
                    betweenPending = false;
                    continue;
                }
                result.push({ start: segStart, end: i, connector: currentConnector });
                currentConnector = u;
                segStart = i + 1;
            }
        }
        if (segStart < end)
            result.push({ start: segStart, end: end, connector: currentConnector });
        return result;
    };
    SqlFormatter.prototype.findEqualsAtDepth0 = function (start, end) {
        var depth = 0;
        for (var i = start; i < end; i++) {
            var t = this.tokens[i];
            if (t.type === "po") {
                depth++;
                continue;
            }
            if (t.type === "pc") {
                depth--;
                continue;
            }
            if (depth === 0 && t.type === "punct" && t.value === "=")
                return i;
        }
        return -1;
    };
    SqlFormatter.prototype.findFirstAtDepth0 = function (start, end, predicate) {
        var depth = 0;
        for (var i = start; i < end; i++) {
            var t = this.tokens[i];
            if (t.type === "po") {
                depth++;
                continue;
            }
            if (t.type === "pc") {
                depth--;
                continue;
            }
            if (depth === 0 && predicate(t))
                return i;
        }
        return -1;
    };
    // ------------------------------------------------------------
    // 아이템 리스트 (SELECT/GROUP BY/ORDER BY/FROM 등의 콤마 분리 리스트)
    // ------------------------------------------------------------
    SqlFormatter.prototype.formatItemList = function (start, end, firstPrefix, contPrefix, addImplicitAs) {
        var segments = this.splitByCommas(start, end);
        var commentIndent = " ".repeat(Math.max(0, contPrefix.length - 2));
        var lines = [];
        var emittedContent = false;
        // AS 세로 정렬 (MERGE USING 서브쿼리의 SELECT 컬럼 리스트 전용)
        var doAlignAs = !!addImplicitAs && this.alignSelectAs;
        var asPadLen = 0;
        if (doAlignAs) {
            var maxExpr = 0;
            for (var s = 0; s < segments.length; s++) {
                var split = this.splitSegmentCommentsAndContent(segments[s].start, segments[s].end);
                if (!split.content)
                    continue;
                var ra = split.content;
                if (this.findSubqueryInExpr(ra.start, ra.end))
                    continue;
                var sa = this.splitColumnAliasStr(this.normalize(ra.start, ra.end));
                if (sa.alias !== null && sa.expr.length > maxExpr)
                    maxExpr = sa.expr.length;
            }
            if (maxExpr > 0)
                asPadLen = maxExpr + 1;
        }
        for (var s = 0; s < segments.length; s++) {
            var seg = segments[s];
            var split = this.splitSegmentCommentsAndContent(seg.start, seg.end);
            // 선두 코멘트: 절 키워드 바로 뒤 같은 줄 주석은 키워드 줄에 인라인 유지(첫 컨텐츠는 다음 줄로 정렬),
            //             나머지 단독 줄 주석은 "바로 아래 항목"의 시작 컬럼에 정렬
            var leadFrom = 0;
            var lead0Hint = split.leading.length > 0 && this.isHintComment(this.tokens[split.leadingIdx[0]]);
            // 힌트는 줄바꿈 위치와 무관하게 항상 인라인, 그 외 블록/라인주석은 같은 줄일 때만 인라인
            if (s === 0 && !emittedContent && split.content && split.leading.length > 0
                && (lead0Hint || this.isInlineAfter(split.leadingIdx[0], start - 1))) {
                if (this.tokens[split.leadingIdx[0]].type === "cmt-block") {
                    // 블록주석(옵티마이저 힌트 /*+ ... */ 등): 키워드에 붙이고 첫 컬럼도 같은 줄 유지
                    // 힌트는 여러 줄로 쓰였어도 한 줄로 정규화(SELECT와 첫 컬럼 사이에 배치)
                    var blk = lead0Hint ? split.leading[0].replace(/\s+/g, " ") : split.leading[0];
                    firstPrefix = firstPrefix.replace(/\s+$/, "") + " " + blk + " ";
                }
                else {
                    // 라인주석: 키워드 줄에 인라인, 첫 컨텐츠는 다음 줄
                    lines.push(firstPrefix.replace(/\s+$/, "") + " " + split.leading[0]);
                    firstPrefix = " ".repeat(firstPrefix.length);
                }
                leadFrom = 1;
            }
            var leadIndent = leadingSpaces(emittedContent ? contPrefix : firstPrefix);
            for (var c = leadFrom; c < split.leading.length; c++) {
                lines.push(leadIndent + split.leading[c]);
            }
            // 컨텐츠 emit
            if (split.content) {
                var ra = split.content;
                var prefix = emittedContent ? contPrefix : firstPrefix;
                var subq = this.findSubqueryInExpr(ra.start, ra.end);
                if (subq) {
                    var preText = this.normalize(ra.start, subq.openParen);
                    var afterText = this.normalize(subq.closeParen + 1, ra.end);
                    if (addImplicitAs && afterText)
                        afterText = this.addAliasAs(afterText);
                    lines.push(this.renderSubqueryBlock(prefix, preText, subq.openParen, subq.closeParen, afterText));
                    emittedContent = true;
                }
                else {
                    // SELECT 컬럼의 CASE 식은 멀티라인 규칙(2/3/6/7)으로 렌더링 시도
                    var caseRender = (addImplicitAs && !doAlignAs) ? this.renderCaseItem(ra.start, ra.end, prefix) : null;
                    if (caseRender !== null) {
                        lines.push(caseRender);
                        emittedContent = true;
                    }
                    else {
                        var text = this.normalize(ra.start, ra.end);
                        if (text) {
                            if (doAlignAs && asPadLen > 0) {
                                var sa = this.splitColumnAliasStr(text);
                                if (sa.alias !== null) {
                                    text = this.padRight(sa.expr, asPadLen) + "AS " + sa.alias;
                                }
                                else if (addImplicitAs) {
                                    text = this.maybeAddAsInColumn(text);
                                }
                            }
                            else if (addImplicitAs) {
                                text = this.maybeAddAsInColumn(text);
                            }
                            lines.push(prefix + text);
                            emittedContent = true;
                        }
                    }
                }
            }
            // 말미 코멘트 (라인 코멘트는 같은 물리적 라인이면 인라인 처리)
            this.emitTrailingComments(lines, commentIndent, split.content ? split.content.end - 1 : -1, split.trailing, split.trailingIdx);
        }
        return lines.join("\n");
    };
    // ------------------------------------------------------------
    // SELECT 컬럼의 CASE 식 멀티라인 정렬 (규칙 2/3/6/7)
    //  - WHEN/ELSE/END 는 "CASE " 다음 컬럼(=caseCol+5)에 세로 정렬
    //  - END 뒤 별칭에는 반드시 AS 부여 (규칙 3)
    //  - THEN 의 값이 또 다른 CASE면 다음 줄에 "THEN" 한 칸 뒤 컬럼부터 중첩 렌더 (규칙 7)
    //  - DECODE/이항 조건 등은 형태가 안 맞아 null → 호출부가 한 줄 normalize (규칙 1/4/5 유지)
    // ------------------------------------------------------------
    /** caseIdx의 CASE에 대응하는 END 토큰 인덱스(없으면 -1). */
    SqlFormatter.prototype.matchCaseEnd = function (caseIdx, end) {
        var depth = 0;
        for (var i = caseIdx; i < end; i++) {
            if (this.isComment(this.tokens[i])) continue;
            var u = this.tokens[i].upper;
            if (u === "CASE") depth++;
            else if (u === "END") { depth--; if (depth === 0) return i; }
        }
        return -1;
    };
    /**
     * SELECT 컬럼 아이템을 CASE 멀티라인으로 렌더링. 지원 형태:
     *   (a) CASE ... END [AS] alias
     *   (b) FUNC( CASE ... END ) [AS] alias   (MAX/SUM/AVG 등 집계 포함)
     * 해당 형태가 아니면 null.
     */
    SqlFormatter.prototype.renderCaseItem = function (start, end, prefix) {
        // 뒤쪽 alias 분리
        var coreEnd = end;
        var alias = null;
        var last = end - 1;
        if (last > start && this.tokens[last].type === "word"
            && !this.isAliasKeyword(this.tokens[last].upper) && this.tokens[last].upper !== "END") {
            var prev = this.tokens[last - 1];
            if (prev.upper === "AS") { alias = this.renderTokenValue(this.tokens[last]); coreEnd = last - 1; }
            else if (prev.upper === "END" || prev.type === "pc") { alias = this.renderTokenValue(this.tokens[last]); coreEnd = last; }
        }
        if (coreEnd <= start) return null;
        var first = this.tokens[start];
        // (a) 직접 CASE
        if (first.upper === "CASE") {
            if (this.matchCaseEnd(start, coreEnd) !== coreEnd - 1) return null;
            var body = this.renderCase(start, coreEnd - 1, prefix.length);
            return prefix + body + (alias ? " AS " + alias : "");
        }
        // (b) FUNC( CASE ... END )
        if (first.type === "word" && start + 2 < coreEnd
            && this.tokens[start + 1].type === "po"
            && this.tokens[coreEnd - 1].type === "pc"
            && this.tokens[start + 2].upper === "CASE"
            && this.matchCaseEnd(start + 2, coreEnd - 1) === coreEnd - 2) {
            var fn = this.renderTokenValue(first) + "(";
            var body2 = this.renderCase(start + 2, coreEnd - 2, prefix.length + fn.length);
            return prefix + fn + body2 + ")" + (alias ? " AS " + alias : "");
        }
        return null;
    };
    /**
     * CASE..END 블록을 멀티라인 문자열로 반환(첫 줄에는 prefix 없음 — 호출부가 caseCol 위치에 배치).
     * caseCol = "CASE" 시작 절대 컬럼. WHEN/ELSE/END 는 caseCol+5 에 정렬.
     */
    SqlFormatter.prototype.renderCase = function (caseStart, endIdx, caseCol) {
        var alignCol = caseCol + 5; // "CASE " 다음
        var align = " ".repeat(alignCol);
        // depth1(이 CASE)의 WHEN/THEN/ELSE 마커 수집 (중첩 CASE는 건너뜀)
        var markers = [];
        var depth = 1;
        for (var p = caseStart + 1; p < endIdx; p++) {
            if (this.isComment(this.tokens[p])) continue;
            var u = this.tokens[p].upper;
            if (u === "CASE") depth++;
            else if (u === "END") depth--;
            else if (depth === 1 && (u === "WHEN" || u === "THEN" || u === "ELSE")) markers.push({ type: u, idx: p });
        }
        var firstWhen = markers.length > 0 ? markers[0].idx : endIdx;
        var operand = this.normalize(caseStart + 1, firstWhen);
        var firstLine = "CASE " + (operand ? operand + " " : "");
        var lines = [];
        var branchNo = 0;
        var m = 0;
        while (m < markers.length) {
            if (markers[m].type === "WHEN" && m + 1 < markers.length && markers[m + 1].type === "THEN") {
                var cond = this.normalize(markers[m].idx + 1, markers[m + 1].idx);
                var resStart = markers[m + 1].idx + 1;
                var resEnd = (m + 2 < markers.length) ? markers[m + 2].idx : endIdx;
                var head = (branchNo === 0) ? firstLine : align;
                var lineStr = head + "WHEN " + cond + " THEN";
                this.pushCaseResult(lines, lineStr, resStart, resEnd, caseCol);
                branchNo++;
                m += 2;
            }
            else if (markers[m].type === "ELSE") {
                var resEnd2 = (m + 1 < markers.length) ? markers[m + 1].idx : endIdx;
                var lineStr2 = align + "ELSE";
                this.pushCaseResult(lines, lineStr2, markers[m].idx + 1, resEnd2, caseCol);
                m += 1;
            }
            else m++;
        }
        lines.push(align + "END");
        return lines.join("\n");
    };
    /** WHEN..THEN / ELSE 의 결과를 lines에 추가. 결과가 중첩 CASE면 규칙7(다음 줄, THEN+1칸)로 렌더. */
    SqlFormatter.prototype.pushCaseResult = function (lines, lineStr, resStart, resEnd, caseCol) {
        // resStart..resEnd 가 정확히 하나의 CASE..END 인지 검사
        var s = resStart;
        while (s < resEnd && this.isComment(this.tokens[s])) s++;
        if (s < resEnd && this.tokens[s].upper === "CASE" && this.matchCaseEnd(s, resEnd) === resEnd - 1) {
            var innerCol = lineStr.length + 1; // "THEN" 다음 한 칸
            lines.push(lineStr);
            lines.push(" ".repeat(innerCol) + this.renderCase(s, resEnd - 1, innerCol));
        }
        else {
            lines.push(lineStr + " " + this.normalize(resStart, resEnd));
        }
    };
    /**
     * 조건식(WHERE/HAVING/ON)에 들어간 CASE를 규칙 8에 따라 처리.
     * 로직이 길면(WHEN 3개+ 또는 서브쿼리 포함 또는 한 줄 100자 초과) 멀티라인으로 렌더, 아니면 null(호출부가 한 줄 처리 → 규칙 1/4 유지).
     */
    SqlFormatter.prototype.renderConditionWithCase = function (start, end, prefix) {
        var caseIdx = -1;
        for (var i = start; i < end; i++) {
            if (this.isComment(this.tokens[i])) continue;
            if (this.tokens[i].upper === "CASE") { caseIdx = i; break; }
        }
        if (caseIdx < 0) return null;
        var ce = this.matchCaseEnd(caseIdx, end);
        if (ce < 0) return null;
        if (!this.isLongCase(caseIdx, ce)) return null;
        var beforeStr = this.normalize(start, caseIdx);
        beforeStr = beforeStr.replace(/^(\d+)\s*=\s*/, "$1=");   // 선두 "숫자 =" 붙임 (예: 1=(CASE ...)
        if (beforeStr && beforeStr.charAt(beforeStr.length - 1) !== "(") beforeStr += " ";
        var caseCol = prefix.length + beforeStr.length;
        var body = this.renderCase(caseIdx, ce, caseCol);
        var after = this.normalize(ce + 1, end);
        var tail = "";
        if (after) tail = (after.charAt(0) === ")" || after.charAt(0) === ",") ? after : " " + after;
        return prefix + beforeStr + body + tail;
    };
    /** CASE가 '긴 로직'인지: depth1 WHEN 3개 이상 / 내부 서브쿼리(SELECT) 포함 / 한 줄 길이 100자 초과. */
    SqlFormatter.prototype.isLongCase = function (caseIdx, ce) {
        var depth = 0, whenCount = 0, hasSubq = false;
        for (var i = caseIdx; i <= ce; i++) {
            if (this.isComment(this.tokens[i])) continue;
            var u = this.tokens[i].upper;
            if (u === "CASE") depth++;
            else if (u === "END") depth--;
            else if (depth === 1 && u === "WHEN") whenCount++;
            if (this.tokens[i].type === "po" && i + 1 <= ce && this.tokens[i + 1] && this.tokens[i + 1].upper === "SELECT") hasSubq = true;
        }
        if (whenCount >= 3 || hasSubq) return true;
        return this.normalize(caseIdx, ce + 1).length > 100;
    };
    /**
     * SELECT 컬럼 표현식의 끝이 `... 식별자 별칭` 패턴이면 (AS 없음)
     * `... 식별자 AS 별칭` 으로 보정한다.
     * 단, 별칭이 SQL 키워드(ASC/DESC/END 등)이면 보정하지 않는다.
     */
    SqlFormatter.prototype.maybeAddAsInColumn = function (text) {
        // 선두에 DISTINCT/ALL/UNIQUE 수식자가 있으면 분리해서 재귀
        var modMatch = text.match(/^(DISTINCT|ALL|UNIQUE)\s+(.+)$/i);
        if (modMatch) {
            return modMatch[1] + " " + this.maybeAddAsInColumn(modMatch[2]);
        }
        var m = text.match(/^(.*\S)\s+([A-Za-z_$#][A-Za-z0-9_$#]*)$/);
        if (!m)
            return text;
        var before = m[1];
        var alias = m[2];
        if (this.isAliasKeyword(alias.toUpperCase()))
            return text;
        // before가 이미 AS 또는 정렬 키워드로 끝나면 스킵
        if (/(?:^|\s)(?:AS|ASC|DESC)$/i.test(before))
            return text;
        return before + " AS " + alias;
    };
    /**
     * 컬럼 표현식 텍스트를 `expr` + `alias`로 분리한다 (AS 정렬용).
     * maybeAddAsInColumn으로 먼저 AS를 보정한 뒤, 괄호 깊이 0의 마지막 ` AS `에서 분리.
     * 별칭이 없으면 alias=null. (CAST(x AS y) 처럼 괄호 안의 AS는 무시)
     */
    SqlFormatter.prototype.splitColumnAliasStr = function (text) {
        var withAs = this.maybeAddAsInColumn(text);
        var idx = this.findAliasAsIndex(withAs);
        if (idx < 0)
            return { expr: withAs, alias: null };
        var expr = withAs.substring(0, idx).replace(/\s+$/, "");
        var alias = withAs.substring(idx + 4).replace(/^\s+/, "");
        return { expr: expr, alias: alias };
    };
    /** 괄호 깊이 0 / 문자열 밖에서 마지막 ` AS ` 위치(선행 공백 인덱스) 반환. 없으면 -1 */
    SqlFormatter.prototype.findAliasAsIndex = function (s) {
        var depth = 0;
        var inStr = false;
        var result = -1;
        for (var i = 0; i + 3 < s.length; i++) {
            var c = s.charAt(i);
            if (inStr) {
                if (c === "'")
                    inStr = false;
                continue;
            }
            if (c === "'") {
                inStr = true;
                continue;
            }
            if (c === "(") {
                depth++;
                continue;
            }
            if (c === ")") {
                depth--;
                continue;
            }
            if (depth === 0 && c === " ") {
                var a = s.charAt(i + 1), b = s.charAt(i + 2), d = s.charAt(i + 3);
                if ((a === "A" || a === "a") && (b === "S" || b === "s") && d === " ") {
                    result = i;
                }
            }
        }
        return result;
    };
    /** "alias" 형태인 afterText 앞에 AS를 붙인다 (이미 AS면 스킵) */
    SqlFormatter.prototype.addAliasAs = function (afterText) {
        var trimmed = afterText.replace(/^\s+/, "");
        if (/^AS\b/i.test(trimmed))
            return afterText;
        if (this.isSimpleColumnRef(trimmed)) {
            var upper = trimmed.toUpperCase();
            if (this.isAliasKeyword(upper))
                return afterText;
            return "AS " + trimmed;
        }
        return afterText;
    };
    SqlFormatter.prototype.isAliasKeyword = function (upper) {
        var NOT_ALIAS = [
            "AS", "ASC", "DESC", "NULLS", "FIRST", "LAST",
            "AND", "OR", "NOT", "IS", "NULL", "IN", "BETWEEN", "LIKE", "EXISTS",
            "ANY", "ALL", "SOME",
            "WHEN", "THEN", "ELSE", "END", "CASE",
            "OVER", "PARTITION", "BY",
            "DISTINCT", "UNIQUE",
            "FROM", "WHERE", "GROUP", "ORDER", "HAVING",
            "UNION", "INTERSECT", "EXCEPT", "MINUS",
            "JOIN", "ON", "USING", "INNER", "LEFT", "RIGHT", "FULL", "CROSS"
        ];
        return NOT_ALIAS.indexOf(upper) >= 0;
    };
    /**
     * `(SELECT ...)` / `(WITH ...)` 서브쿼리 블록을 prefix 뒤에 줄바꿈 + 재귀 정렬해서 렌더링.
     * 규칙:
     *   - `(`는 linePrefix 직후(원래 자리)
     *   - 서브쿼리 SELECT는 prefix.length 컬럼에서 시작 (절 본문 컬럼 = "   AND " 의 'D' 다음 칸)
     *   - `)`는 prefix.length - 2 컬럼에서 닫음 (= 절 키워드의 마지막 글자 컬럼)
     * 예: prefix="   AND ", preText="A.ITEM IN" 인 경우
     *     "   AND A.ITEM IN ("   (`(` at col 15)
     *     "       SELECT ..."    (SELECT at col 7)
     *     "     )"               (`)` at col 5)
     */
    SqlFormatter.prototype.renderSubqueryBlock = function (prefix, preText, openParen, closeParen, afterText) {
        var linePrefix;
        if (preText) {
            linePrefix = prefix.replace(/\s+$/, "") + " " + preText + " ";
        }
        else {
            linePrefix = (prefix.length > 0 && prefix.charAt(prefix.length - 1) === " ") ? prefix : prefix + " ";
        }
        var subqIndent = prefix.length;
        var closeCol = Math.max(0, prefix.length - 2);
        var closeIndentStr = " ".repeat(closeCol);
        var subqText = this.formatSelectStmt(openParen + 1, closeParen, subqIndent);
        return linePrefix + "(\n" + subqText + "\n" + closeIndentStr + ")" + (afterText ? " " + afterText : "");
    };
    /**
     * 세그먼트의 선두/말미 코멘트만 떼어내고, 내부 박힌 코멘트는 content range 안에 남긴다.
     * 이렇게 해야 `(` ... 중간코멘트 ... `)` 처럼 코멘트가 표현식 안에 박혀 있어도
     * findSubqueryInExpr가 짝맞춤에 성공하고, 재귀 포매터가 코멘트를 자기 클로즈 안에서 처리할 수 있다.
     */
    SqlFormatter.prototype.splitSegmentCommentsAndContent = function (start, end) {
        var leading = [];
        var leadingIdx = [];
        var trailing = [];
        var trailingIdx = [];
        var cs = start, ce = end;
        while (cs < ce && this.isComment(this.tokens[cs])) {
            leading.push(this.tokens[cs].value);
            leadingIdx.push(cs);
            cs++;
        }
        while (ce > cs && this.isComment(this.tokens[ce - 1])) {
            trailing.unshift(this.tokens[ce - 1].value);
            trailingIdx.unshift(ce - 1);
            ce--;
        }
        if (cs >= ce)
            return { leading: leading, leadingIdx: leadingIdx, content: null, trailing: trailing, trailingIdx: trailingIdx };
        return { leading: leading, leadingIdx: leadingIdx, content: { start: cs, end: ce }, trailing: trailing, trailingIdx: trailingIdx };
    };
    /**
     * Trailing 코멘트를 lines 배열에 추가합니다.
     * 첫 번째 트레일링 코멘트가 라인 코멘트이고 직전 컨텐츠와 같은 물리적 라인이면
     * 마지막 출력 라인 끝에 인라인으로 붙입니다. 그 외에는 별도 라인으로 추가합니다.
     */
    SqlFormatter.prototype.emitTrailingComments = function (lines, commentIndent, contentEndTokIdx, trailing, trailingIdx) {
        for (var c = 0; c < trailing.length; c++) {
            var canInline = c === 0
                && contentEndTokIdx >= 0
                && lines.length > 0
                && this.tokens[trailingIdx[c]].type === "cmt-line"
                && this.sql.substring(this.tokens[contentEndTokIdx].end, this.tokens[trailingIdx[c]].start).indexOf("\n") < 0;
            if (canInline) {
                lines[lines.length - 1] = lines[lines.length - 1] + "  " + trailing[c];
            }
            else {
                lines.push(commentIndent + trailing[c]);   // 단독 줄 주석: 아래 항목 시작 컬럼에 정렬
            }
        }
    };
    // 주석 토큰이 직전 토큰과 같은 물리적 라인에 있는 주석(=인라인)인지 판정.
    // 라인주석(--)뿐 아니라 블록주석도 포함 — 특히 SELECT 뒤 옵티마이저 힌트는
    // 키워드에 붙어 있어야 유효하므로 반드시 인라인으로 판정해야 한다.
    SqlFormatter.prototype.isInlineAfter = function (commentTokIdx, prevTokIdx) {
        if (prevTokIdx < 0 || commentTokIdx < 0)
            return false;
        var ct = this.tokens[commentTokIdx].type;
        if (ct !== "cmt-line" && ct !== "cmt-block")
            return false;
        return this.sql.substring(this.tokens[prevTokIdx].end, this.tokens[commentTokIdx].start).indexOf("\n") < 0;
    };
    // 옵티마이저 힌트(/*+ ... */)인지 판정. 힌트는 주석이 아니라 실행계획 지시어이므로
    // 줄바꿈 위치와 무관하게 항상 키워드(SELECT/INSERT/UPDATE/DELETE) 바로 뒤에 붙여야 유효하다.
    SqlFormatter.prototype.isHintComment = function (t) {
        return !!t && t.type === "cmt-block" && /^\/\*\+/.test(t.value);
    };
    /** WHERE/HAVING/ON 의 조건 리스트 */
    SqlFormatter.prototype.formatConditionList = function (start, end, firstPrefix, andPrefix, orPrefix) {
        // 1) 선두/말미 코멘트 분리 (코멘트가 절 전체를 감쌀 수 있음)
        var cs = start, ce = end;
        var leadComments = [];
        while (cs < ce && this.isComment(this.tokens[cs])) {
            leadComments.push(this.tokens[cs].value);
            cs++;
        }
        var trailComments = [];
        while (ce > cs && this.isComment(this.tokens[ce - 1])) {
            trailComments.unshift(this.tokens[ce - 1].value);
            ce--;
        }
        var commentIndent = " ".repeat(Math.max(0, andPrefix.length - 4));
        var lines = [];
        for (var i = 0; i < leadComments.length; i++)
            lines.push(commentIndent + leadComments[i]);   // 단독 줄 주석: 조건 시작 컬럼에 정렬
        var segments = this.splitByAndOr(cs, ce);
        var firstEmitted = false;
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            // 세그먼트 내 코멘트/컨텐츠 분리
            var segComments = [];
            var cStart = -1;
            var contentRanges = [];
            for (var j = seg.start; j < seg.end; j++) {
                var t = this.tokens[j];
                if (this.isComment(t)) {
                    if (cStart >= 0) {
                        contentRanges.push({ start: cStart, end: j });
                        cStart = -1;
                    }
                    segComments.push(t.value);
                }
                else {
                    if (cStart < 0)
                        cStart = j;
                }
            }
            if (cStart >= 0)
                contentRanges.push({ start: cStart, end: seg.end });
            for (var c = 0; c < segComments.length; c++)
                lines.push(commentIndent + segComments[c]);   // 단독 줄 주석: 조건/항목 시작 컬럼에 정렬
            for (var r = 0; r < contentRanges.length; r++) {
                var text = this.compactTautology(this.normalize(contentRanges[r].start, contentRanges[r].end));
                if (!text)
                    continue;
                if (!firstEmitted) {
                    lines.push(firstPrefix + text);
                    firstEmitted = true;
                }
                else if (seg.connector === "OR")
                    lines.push(orPrefix + text);
                else
                    lines.push(andPrefix + text);
            }
        }
        for (var i = 0; i < trailComments.length; i++)
            lines.push(commentIndent + trailComments[i]);   // 단독 줄 주석: 조건 시작 컬럼에 정렬
        return lines.join("\n");
    };
    // ------------------------------------------------------------
    // SELECT statement
    // ------------------------------------------------------------
    SqlFormatter.prototype.formatSelectStmt = function (start, end, indent) {
        var ind = " ".repeat(indent);
        var clauses = this.getClauses(start, end);
        var lines = [];
        // 첫 절(SELECT/WITH) 앞의 선두 주석 보존 (서브쿼리 내부 `( -- 주석 \n SELECT …` 등)
        var firstKw = clauses.length > 0 ? clauses[0].kwStart : end;
        for (var p = start; p < firstKw; p++) {
            if (this.isComment(this.tokens[p]))
                lines.push(ind + this.tokens[p].value);
        }
        for (var i = 0; i < clauses.length; i++) {
            var cl = clauses[i];
            lines.push(this.formatSelectClause(cl, indent));
        }
        return lines.join("\n");
    };
    SqlFormatter.prototype.formatSelectClause = function (cl, indent) {
        var ind = " ".repeat(indent);
        var cs = cl.contentStart, ce = cl.contentEnd;
        switch (cl.keyword) {
            case "WITH":
                return this.formatWithClause(cs, ce, indent);
            case "SELECT":
                return this.formatItemList(cs, ce, ind + "SELECT ", ind + "     , ", true);
            case "INTO":
                // PL/SQL SELECT ... INTO : SELECT 리버에 맞춰 우측정렬 (SELECT 6칸, INTO 4칸 → 2칸 들여쓰기)
                return this.formatItemList(cs, ce, ind + "  INTO ", ind + "     , ");
            case "FROM":
                return this.formatFromClause(cs, ce, indent);
            case "WHERE":
                return this.formatSelectWhereLike(cs, ce, ind + " WHERE ", ind + "   AND ", ind + "    OR ");
            case "HAVING":
                return this.formatSelectWhereLike(cs, ce, ind + " HAVING ", ind + "    AND ", ind + "     OR ");
            case "GROUP BY":
                return this.formatItemList(cs, ce, ind + " GROUP BY ", ind + "        , ");
            case "ORDER BY":
                return this.formatItemList(cs, ce, ind + " ORDER BY ", ind + "        , ");
            case "JOIN":
            case "INNER JOIN":
            case "LEFT JOIN":
            case "LEFT OUTER JOIN":
            case "RIGHT JOIN":
            case "RIGHT OUTER JOIN":
            case "FULL JOIN":
            case "FULL OUTER JOIN":
            case "CROSS JOIN": {
                // 파생 테이블 서브쿼리 JOIN ( SELECT ... ) alias 는 서브쿼리 블록으로 펼친다
                var jPrefix = ind + "  " + cl.keyword + " ";
                var jsub = this.findSubqueryInExpr(cs, ce);
                if (jsub) {
                    var jPre = this.normalize(cs, jsub.openParen);
                    var jAfter = this.normalize(jsub.closeParen + 1, ce);
                    return this.renderSubqueryBlock(jPrefix, jPre, jsub.openParen, jsub.closeParen, jAfter);
                }
                return jPrefix + this.normalize(cs, ce);
            }
            case "ON":
                return this.formatSelectWhereLike(cs, ce, ind + "    ON ", ind + "   AND ", ind + "    OR ");
            case "UNION":
            case "UNION ALL":
            case "INTERSECT":
            case "EXCEPT":
            case "MINUS": {
                // set 연산자는 1칸 들여쓰기 ( UNION ALL / 다음 SELECT 는 컬럼0)
                // UNION ALL 과 다음 SELECT 사이의 주석을 제자리에 보존한다.
                var setLines = [ind + " " + cl.keyword];
                for (var uci = cs; uci < ce; uci++) {
                    if (this.isComment(this.tokens[uci]))
                        setLines.push(ind + this.tokens[uci].value);
                }
                return setLines.join("\n");
            }
            case "START WITH":
                return this.formatSelectWhereLike(cs, ce, ind + " START WITH ", ind + "         AND ", ind + "          OR ");
            case "CONNECT BY":
                return this.formatSelectWhereLike(cs, ce, ind + " CONNECT BY ", ind + "         AND ", ind + "          OR ");
            case "LIMIT":
                return ind + " LIMIT " + this.normalize(cs, ce);
            case "OFFSET":
                return ind + "OFFSET " + this.normalize(cs, ce);
            default:
                return ind + cl.keyword + " " + this.normalize(cs, ce);
        }
    };
    /**
     * SELECT의 WHERE/HAVING/ON처럼 AND/OR로 묶인 조건 리스트.
     * 단순 `col = val` 패턴이 2개 이상이면 `=`를 세로 정렬한다.
     * (UPDATE SET의 패딩보다 좁은 max+1 padding을 사용 — 새 예시 파일 스타일)
     */
    SqlFormatter.prototype.formatSelectWhereLike = function (start, end, firstPrefix, andPrefix, orPrefix) {
        var segs = this.splitByAndOr(start, end);
        var maxCol = 0, simpleEqCount = 0;
        for (var j = 0; j < segs.length; j++) {
            var eq = this.findEqualsAtDepth0(segs[j].start, segs[j].end);
            if (eq < 0)
                continue;
            var c = this.normalize(segs[j].start, eq);
            if (this.isSimpleColumnRef(c)) {
                simpleEqCount++;
                if (c.length > maxCol)
                    maxCol = c.length;
            }
        }
        var padLen = simpleEqCount >= 2 ? (maxCol + 1) : 0;
        return this.formatAlignedConditionList(start, end, firstPrefix, andPrefix, orPrefix, padLen);
    };
    // ------------------------------------------------------------
    // WITH 절(CTE) 포매터
    // ------------------------------------------------------------
    SqlFormatter.prototype.formatWithClause = function (start, end, indent) {
        var ctes = this.splitByCommas(start, end);
        var lines = [];
        for (var i = 0; i < ctes.length; i++) {
            var cte = ctes[i];
            if (cte.end <= cte.start)
                continue;
            lines.push(this.formatCte(cte.start, cte.end, indent, i === 0));
        }
        return lines.join("\n");
    };
    SqlFormatter.prototype.formatCte = function (start, end, indent, isFirst) {
        var ind = " ".repeat(indent);
        var prefix = isFirst ? "WITH " : ", ";
        // 선두 코멘트 분리
        var cursor = start;
        var leadComments = [];
        while (cursor < end && this.isComment(this.tokens[cursor])) {
            leadComments.push(this.tokens[cursor].value);
            cursor++;
        }
        var lines = [];
        for (var c = 0; c < leadComments.length; c++)
            lines.push(ind + leadComments[c]);
        if (cursor >= end)
            return lines.join("\n");
        // CTE 이름
        var nameToken = this.tokens[cursor];
        if (nameToken.type !== "word") {
            lines.push(ind + prefix + this.normalize(start, end));
            return lines.join("\n");
        }
        var cteName = this.renderTokenValue(nameToken);
        cursor++;
        // 옵션 컬럼 리스트: WITH name ( col1, col2 ) AS (...)
        var colListStart = -1, colListEnd = -1;
        if (cursor < end && this.tokens[cursor].type === "po") {
            var closeIdx = this.findMatchingClose(cursor, end);
            if (closeIdx > 0 && closeIdx + 1 < end
                && this.tokens[closeIdx + 1].type === "word"
                && this.tokens[closeIdx + 1].upper === "AS") {
                colListStart = cursor;
                colListEnd = closeIdx;
                cursor = closeIdx + 1;
            }
        }
        // AS 키워드
        if (cursor < end && this.tokens[cursor].type === "word" && this.tokens[cursor].upper === "AS") {
            cursor++;
        }
        // 서브쿼리 괄호
        while (cursor < end && this.tokens[cursor].type !== "po")
            cursor++;
        if (cursor >= end) {
            lines.push(ind + prefix + cteName + " " + this.normalize(start + 1, end));
            return lines.join("\n");
        }
        var subqStart = cursor;
        var subqEnd = this.findMatchingClose(subqStart, end);
        if (subqEnd < 0) {
            lines.push(ind + prefix + cteName + " AS " + this.normalize(subqStart, end));
            return lines.join("\n");
        }
        if (colListStart > 0 && colListEnd > 0) {
            lines.push(ind + prefix + cteName + " (");
            lines.push(this.formatItemList(colListStart + 1, colListEnd, ind + "       ", ind + "     , "));
            lines.push(ind + ") AS (");
        }
        else {
            lines.push(ind + prefix + cteName + " AS (");
        }
        var subqueryFormatted = this.formatSelectStmt(subqStart + 1, subqEnd, indent + 2);
        lines.push(subqueryFormatted);
        lines.push(ind + ")");
        // CTE 닫는 `)` 이후 ~ 세그먼트 끝(다음 콤마 직전)의 트레일링 주석 보존 (CTE 사이 주석)
        for (var tc = subqEnd + 1; tc < end; tc++) {
            if (this.isComment(this.tokens[tc]))
                lines.push(ind + this.tokens[tc].value);
        }
        return lines.join("\n");
    };
    /** 조건 표현식 안에서 깊이 0의 첫 `(SELECT ...)` 또는 `(WITH ...)` 서브쿼리 위치 찾기 */
    SqlFormatter.prototype.findSubqueryInExpr = function (start, end) {
        var depth = 0;
        for (var i = start; i < end; i++) {
            var t = this.tokens[i];
            if (t.type === "po") {
                if (depth === 0) {
                    var closeIdx = this.findMatchingClose(i, end);
                    // `(` 직후의 코멘트를 건너뛰고 첫 의미 토큰이 SELECT/WITH 인지 확인
                    var firstIdx = i + 1;
                    while (firstIdx < closeIdx && this.isComment(this.tokens[firstIdx]))
                        firstIdx++;
                    if (closeIdx > 0 && firstIdx < closeIdx
                        && this.tokens[firstIdx].type === "word"
                        && (this.tokens[firstIdx].upper === "SELECT" || this.tokens[firstIdx].upper === "WITH")) {
                        return { openParen: i, closeParen: closeIdx };
                    }
                }
                depth++;
            }
            else if (t.type === "pc") {
                depth--;
            }
        }
        return null;
    };
    /** FROM 절: 콤마 분리된 테이블 목록 */
    SqlFormatter.prototype.formatFromClause = function (start, end, indent) {
        var ind = " ".repeat(indent);
        return this.formatItemList(start, end, ind + "  FROM ", ind + "     , ");
    };
    // ------------------------------------------------------------
    // UPDATE statement
    // ------------------------------------------------------------
    SqlFormatter.prototype.formatUpdateStmt = function (start, end, indent) {
        var ind = " ".repeat(indent);
        var clauses = this.getClauses(start, end);
        // SET / WHERE의 col 길이 측정해 = 정렬 폭 계산
        var maxCol = 0;
        for (var i = 0; i < clauses.length; i++) {
            var cl = clauses[i];
            if (cl.keyword === "SET") {
                var items = this.splitByCommas(cl.contentStart, cl.contentEnd);
                for (var j = 0; j < items.length; j++) {
                    var eq = this.findEqualsAtDepth0(items[j].start, items[j].end);
                    if (eq < 0)
                        continue;
                    var c = this.normalize(items[j].start, eq);
                    if (c.length > maxCol)
                        maxCol = c.length;
                }
            }
            else if (cl.keyword === "WHERE") {
                var segs = this.splitByAndOr(cl.contentStart, cl.contentEnd);
                for (var j = 0; j < segs.length; j++) {
                    var eq = this.findEqualsAtDepth0(segs[j].start, segs[j].end);
                    if (eq < 0)
                        continue;
                    var c = this.normalize(segs[j].start, eq);
                    if (c.length > maxCol)
                        maxCol = c.length;
                }
            }
        }
        var padLen = this.calcAlignWidth(maxCol);
        var lines = [];
        for (var i = 0; i < clauses.length; i++) {
            var cl = clauses[i];
            var cs = cl.contentStart, ce = cl.contentEnd;
            if (cl.keyword === "UPDATE") {
                lines.push(ind + "UPDATE " + this.normalize(cs, ce));
            }
            else if (cl.keyword === "SET") {
                lines.push(this.formatAssignList(cs, ce, ind + "   SET ", ind + "     , ", padLen));
            }
            else if (cl.keyword === "WHERE") {
                lines.push(this.formatAlignedConditionList(cs, ce, ind + " WHERE ", ind + "   AND ", ind + "    OR ", padLen));
            }
            else {
                lines.push(this.formatSelectClause(cl, indent));
            }
        }
        return lines.join("\n");
    };
    SqlFormatter.prototype.calcAlignWidth = function (maxCol) {
        if (maxCol <= 0)
            return 0;
        // 4의 배수 + 2로 반올림하여 안정적인 컬럼 폭 확보
        return Math.ceil((maxCol + 2) / 4) * 4 + 2;
    };
    /** SET col = val, col = val ... — = 정렬 */
    SqlFormatter.prototype.formatAssignList = function (start, end, firstPrefix, contPrefix, padLen) {
        var items = this.splitByCommas(start, end);
        var commentIndent = " ".repeat(Math.max(0, contPrefix.length - 2));
        var lines = [];
        var firstEmitted = false;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            // 코멘트 분리
            var segComments = [];
            var cStart = -1;
            var contentRanges = [];
            for (var j = it.start; j < it.end; j++) {
                var t = this.tokens[j];
                if (this.isComment(t)) {
                    if (cStart >= 0) {
                        contentRanges.push({ start: cStart, end: j });
                        cStart = -1;
                    }
                    segComments.push(t.value);
                }
                else {
                    if (cStart < 0)
                        cStart = j;
                }
            }
            if (cStart >= 0)
                contentRanges.push({ start: cStart, end: it.end });
            for (var c = 0; c < segComments.length; c++)
                lines.push(commentIndent + segComments[c]);   // 단독 줄 주석: 조건/항목 시작 컬럼에 정렬
            for (var r = 0; r < contentRanges.length; r++) {
                var ra = contentRanges[r];
                var eq = this.findEqualsAtDepth0(ra.start, ra.end);
                var line = void 0;
                if (eq < 0) {
                    line = (firstEmitted ? contPrefix : firstPrefix) + this.normalize(ra.start, ra.end);
                }
                else {
                    var colText = this.normalize(ra.start, eq);
                    var valText = this.normalize(eq + 1, ra.end);
                    var padded = padLen > 0 ? this.padRight(colText, padLen) : colText + " ";
                    line = (firstEmitted ? contPrefix : firstPrefix) + padded + "= " + valText;
                }
                lines.push(line);
                firstEmitted = true;
            }
        }
        return lines.join("\n");
    };
    /** WHERE 절(UPDATE/DELETE) — = 정렬 (col = val 패턴에 한해 정렬) */
    SqlFormatter.prototype.formatAlignedConditionList = function (start, end, firstPrefix, andPrefix, orPrefix, padLen) {
        var segs = this.splitByAndOr(start, end);
        var commentIndent = " ".repeat(Math.max(0, andPrefix.length - 4));
        var lines = [];
        var firstEmitted = false;
        for (var i = 0; i < segs.length; i++) {
            var seg = segs[i];
            var split = this.splitSegmentCommentsAndContent(seg.start, seg.end);
            // 선두 코멘트: 절 키워드 바로 뒤 같은 줄 주석은 키워드 줄에 인라인 유지, 나머지 단독 줄 주석은 "바로 아래 조건" 시작 컬럼에 정렬
            var leadFrom = 0;
            if (!firstEmitted && split.content && split.leading.length > 0
                && this.isInlineAfter(split.leadingIdx[0], start - 1)) {
                if (this.tokens[split.leadingIdx[0]].type === "cmt-block") {
                    // 블록주석: 키워드에 붙이고 첫 조건도 같은 줄 유지
                    firstPrefix = firstPrefix.replace(/\s+$/, "") + " " + split.leading[0] + " ";
                }
                else {
                    lines.push(firstPrefix.replace(/\s+$/, "") + " " + split.leading[0]);
                    firstPrefix = " ".repeat(firstPrefix.length);
                }
                leadFrom = 1;
            }
            var condLeadIndent = leadingSpaces(!firstEmitted ? firstPrefix : andPrefix);
            for (var c = leadFrom; c < split.leading.length; c++)
                lines.push(condLeadIndent + split.leading[c]);
            // 컨텐츠
            if (split.content) {
                var ra = split.content;
                var prefix = !firstEmitted ? firstPrefix : (seg.connector === "OR" ? orPrefix : andPrefix);
                var line = void 0;
                // 규칙 8: WHERE/조건절의 CASE라도 로직이 길면 멀티라인(규칙 2)으로 정렬
                var caseCond = this.renderConditionWithCase(ra.start, ra.end, prefix);
                if (caseCond !== null) {
                    line = caseCond;
                    lines.push(line);
                    firstEmitted = true;
                    this.emitTrailingComments(lines, commentIndent, split.content ? split.content.end - 1 : -1, split.trailing, split.trailingIdx);
                    continue;
                }
                var subq = this.findSubqueryInExpr(ra.start, ra.end);
                if (subq) {
                    var preText = this.normalize(ra.start, subq.openParen);
                    var afterText = this.normalize(subq.closeParen + 1, ra.end);
                    line = this.renderSubqueryBlock(prefix, preText, subq.openParen, subq.closeParen, afterText);
                }
                else {
                    var eq = this.findEqualsAtDepth0(ra.start, ra.end);
                    if (eq >= 0 && padLen > 0) {
                        var colText = this.normalize(ra.start, eq);
                        var valText = this.normalize(eq + 1, ra.end);
                        if (this.isSimpleColumnRef(colText)) {
                            line = prefix + this.padRight(colText, padLen) + "= " + valText;
                        }
                        else {
                            line = prefix + this.compactTautology(this.normalize(ra.start, ra.end));
                        }
                    }
                    else {
                        line = prefix + this.compactTautology(this.normalize(ra.start, ra.end));
                    }
                }
                lines.push(line);
                firstEmitted = true;
            }
            // 말미 코멘트 (라인 코멘트는 같은 물리적 라인이면 인라인 처리)
            this.emitTrailingComments(lines, commentIndent, split.content ? split.content.end - 1 : -1, split.trailing, split.trailingIdx);
        }
        return lines.join("\n");
    };
    SqlFormatter.prototype.isSimpleColumnRef = function (s) {
        return /^[A-Za-z_$#][A-Za-z0-9_$#]*(\.[A-Za-z_$#][A-Za-z0-9_$#]*)*$/.test(s);
    };
    /** `1 = 1` 같은 숫자=숫자 더미 조건은 `1=1` 로 압축 (공백 제거) */
    SqlFormatter.prototype.compactTautology = function (text) {
        // 선두가 "숫자 = ..." 인 제어/더미 조건은 '=' 공백을 제거해 붙인다: 1=1, 1=2, 1=(CASE ...)
        return text.replace(/^(\d+)\s*=\s*/, "$1=");
    };
    SqlFormatter.prototype.padRight = function (s, len) {
        if (s.length >= len)
            return s + " ";
        return s + " ".repeat(len - s.length);
    };
    // ------------------------------------------------------------
    // DELETE statement
    // ------------------------------------------------------------
    SqlFormatter.prototype.formatDeleteStmt = function (start, end, indent) {
        var ind = " ".repeat(indent);
        var clauses = this.getClauses(start, end);
        // WHERE col=val 정렬 폭
        var maxCol = 0;
        for (var i = 0; i < clauses.length; i++) {
            var cl = clauses[i];
            if (cl.keyword === "WHERE") {
                var segs = this.splitByAndOr(cl.contentStart, cl.contentEnd);
                for (var j = 0; j < segs.length; j++) {
                    var eq = this.findEqualsAtDepth0(segs[j].start, segs[j].end);
                    if (eq < 0)
                        continue;
                    var c = this.normalize(segs[j].start, eq);
                    if (this.isSimpleColumnRef(c) && c.length > maxCol)
                        maxCol = c.length;
                }
            }
        }
        var padLen = this.calcAlignWidth(maxCol);
        var lines = [];
        for (var i = 0; i < clauses.length; i++) {
            var cl = clauses[i];
            var cs = cl.contentStart, ce = cl.contentEnd;
            if (cl.keyword === "DELETE") {
                lines.push(ind + "DELETE");
                // DELETE 뒤에 곧바로 컨텐츠가 있을 경우(예: DELETE FROM의 'FROM'은 별도 절로 잡힘)
                if (cs < ce) {
                    var txt = this.normalize(cs, ce);
                    if (txt)
                        lines.push(ind + "       " + txt);
                }
            }
            else if (cl.keyword === "FROM") {
                lines.push(ind + "  FROM " + this.normalize(cs, ce));
            }
            else if (cl.keyword === "WHERE") {
                lines.push(this.formatAlignedConditionList(cs, ce, ind + " WHERE ", ind + "   AND ", ind + "    OR ", padLen));
            }
            else {
                lines.push(this.formatSelectClause(cl, indent));
            }
        }
        return lines.join("\n");
    };
    // ------------------------------------------------------------
    // INSERT statement
    // ------------------------------------------------------------
    SqlFormatter.prototype.formatInsertStmt = function (start, end, indent) {
        var ind = " ".repeat(indent);
        var clauses = this.getClauses(start, end);
        var lines = [];
        var intoIdx = this.findClauseIdx(clauses, "INSERT INTO");
        if (intoIdx < 0)
            return this.sql;
        var intoCl = clauses[intoIdx];
        var i = intoCl.contentStart;
        // 테이블명: VALUES/SELECT/WITH/( 이전까지
        var tableEnd = i;
        var depth = 0;
        while (tableEnd < intoCl.contentEnd) {
            var t = this.tokens[tableEnd];
            if (depth === 0) {
                if (t.type === "po")
                    break;
                if (t.type === "word") {
                    var u = t.upper;
                    if (u === "VALUES" || u === "SELECT" || u === "WITH")
                        break;
                }
            }
            if (t.type === "po")
                depth++;
            else if (t.type === "pc")
                depth--;
            tableEnd++;
        }
        lines.push(ind + "INSERT INTO " + this.normalize(i, tableEnd));
        i = tableEnd;
        // 컬럼 리스트 (괄호로 묶임)
        if (i < intoCl.contentEnd && this.tokens[i].type === "po") {
            var closeIdx = this.findMatchingClose(i, intoCl.contentEnd);
            if (closeIdx > 0) {
                lines.push(ind + "(");
                lines.push(this.formatItemList(i + 1, closeIdx, ind + "       ", ind + "     , "));
                lines.push(ind + ")");
                i = closeIdx + 1;
            }
        }
        // INSERT INTO 다음 절: VALUES / WITH / SELECT 중 가장 먼저 등장하는 것을 시작점으로.
        // (else if 로 SELECT만 보면 INSERT INTO ... WITH ... SELECT 패턴에서 WITH가 누락됨)
        var nextIdx = -1;
        var nextKind = "";
        for (var j = intoIdx + 1; j < clauses.length; j++) {
            var kw = clauses[j].keyword;
            if (kw === "VALUES" || kw === "WITH" || kw === "SELECT") {
                nextIdx = j;
                nextKind = kw;
                break;
            }
        }
        if (nextKind === "VALUES") {
            var vcl = clauses[nextIdx];
            // VALUES (...), (...), ... — 다중 행 가능
            var vs = vcl.contentStart;
            var ve = vcl.contentEnd;
            var groups = this.splitByCommas(vs, ve);
            for (var g = 0; g < groups.length; g++) {
                var gr = groups[g];
                // gr 안에서 ( ) 찾기
                var gs = gr.start;
                var ge = gr.end;
                while (gs < ge && this.tokens[gs].type !== "po")
                    gs++;
                if (gs >= ge) {
                    lines.push(ind + "VALUES " + this.normalize(gr.start, gr.end));
                    continue;
                }
                var closeIdx = this.findMatchingClose(gs, ge);
                if (closeIdx < 0) {
                    lines.push(ind + "VALUES " + this.normalize(gr.start, gr.end));
                    continue;
                }
                var prefix = (g === 0 ? "VALUES (" : "     , (");
                lines.push(ind + prefix);
                lines.push(this.formatItemList(gs + 1, closeIdx, ind + "       ", ind + "     , "));
                lines.push(ind + ")");
            }
        }
        else if (nextKind === "SELECT" || nextKind === "WITH") {
            // INSERT ... SELECT 또는 INSERT ... WITH ... SELECT
            // 둘 다 formatSelectStmt에 위임 (WITH는 그 안의 첫 절로 정상 처리됨)
            var sub = this.formatSelectStmt(clauses[nextIdx].kwStart, end, indent);
            lines.push(sub);
        }
        return lines.join("\n");
    };
    SqlFormatter.prototype.findClauseIdx = function (clauses, keyword) {
        for (var i = 0; i < clauses.length; i++)
            if (clauses[i].keyword === keyword)
                return i;
        return -1;
    };
    SqlFormatter.prototype.findClauseIdxAfter = function (clauses, from, keyword) {
        for (var i = from; i < clauses.length; i++)
            if (clauses[i].keyword === keyword)
                return i;
        return -1;
    };
    /** 토큰 인덱스 i가 "(" 일 때 매칭되는 ")" 인덱스 반환. 못 찾으면 -1 */
    SqlFormatter.prototype.findMatchingClose = function (i, end) {
        if (this.tokens[i].type !== "po")
            return -1;
        var depth = 1;
        for (var j = i + 1; j < end; j++) {
            if (this.tokens[j].type === "po")
                depth++;
            else if (this.tokens[j].type === "pc") {
                depth--;
                if (depth === 0)
                    return j;
            }
        }
        return -1;
    };
    // ------------------------------------------------------------
    // MERGE statement
    // ------------------------------------------------------------
    SqlFormatter.prototype.formatMergeStmt = function (start, end, indent) {
        var ind = " ".repeat(indent);
        var clauses = this.getMergeClauses(start, end);
        var lines = [];
        for (var i = 0; i < clauses.length; i++) {
            var cl = clauses[i];
            var cs = cl.contentStart, ce = cl.contentEnd;
            switch (cl.keyword) {
                case "MERGE INTO":
                    lines.push(ind + " MERGE INTO " + this.normalize(cs, ce));
                    break;
                case "USING": {
                    // USING (subquery) alias  또는  USING table alias
                    if (cs < ce && this.tokens[cs].type === "po") {
                        var closeIdx = this.findMatchingClose(cs, ce);
                        if (closeIdx > 0) {
                            // USING 서브쿼리 SELECT 컬럼 리스트는 AS 를 세로 정렬
                            var prevAlign = this.alignSelectAs;
                            this.alignSelectAs = true;
                            var innerSub = this.formatSelectStmt(cs + 1, closeIdx, indent + 8);
                            this.alignSelectAs = prevAlign;
                            var afterAlias = this.normalize(closeIdx + 1, ce);
                            lines.push(ind + " USING (");
                            lines.push(innerSub);
                            lines.push(ind + "       )" + (afterAlias ? " " + afterAlias : ""));
                        }
                        else {
                            lines.push(ind + " USING " + this.normalize(cs, ce));
                        }
                    }
                    else {
                        lines.push(ind + " USING " + this.normalize(cs, ce));
                    }
                    break;
                }
                case "ON":
                    // ON ( 만 단독 줄, 조건은 다음 줄부터 (내용 col 7, AND col 3) — = 정렬
                    if (cs < ce && this.tokens[cs].type === "po") {
                        var closeIdx = this.findMatchingClose(cs, ce);
                        if (closeIdx > 0) {
                            lines.push(ind + "    ON (");
                            lines.push(this.formatSelectWhereLike(cs + 1, closeIdx, ind + "       ", ind + "   AND ", ind + "    OR "));
                            var afterClose = this.normalize(closeIdx + 1, ce);
                            lines.push(ind + "     )" + (afterClose ? " " + afterClose : ""));
                        }
                        else {
                            lines.push(ind + "    ON " + this.normalize(cs, ce));
                        }
                    }
                    else {
                        lines.push(this.formatSelectWhereLike(cs, ce, ind + "    ON ", ind + "   AND ", ind + "    OR "));
                    }
                    break;
                case "WHEN MATCHED": {
                    // WHEN MATCHED THEN UPDATE SET col1 = v1, ...
                    // contents: [THEN UPDATE SET ...] 또는 [UPDATE SET ...]
                    var ic = cs;
                    if (ic < ce && this.tokens[ic].upper === "THEN")
                        ic++;
                    if (ic < ce && this.tokens[ic].upper === "UPDATE") {
                        lines.push(ind + "  WHEN MATCHED THEN");
                        lines.push(ind + "UPDATE");
                        // SET 절 찾기
                        if (ic + 1 < ce && this.tokens[ic + 1].upper === "SET") {
                            var setStart = ic + 2;
                            var setEnd = this.findNextClauseStart(setStart, ce);
                            lines.push(this.formatMergeSetClause(setStart, setEnd, indent));
                            // SET 이후 잔여 (WHERE 등) 처리
                            if (setEnd < ce) {
                                var rest = this.formatConditionList(this.skipKw(setEnd, ce, "WHERE"), ce, ind + " WHERE ", ind + "   AND ", ind + "    OR ");
                                if (rest)
                                    lines.push(rest);
                            }
                        }
                    }
                    else {
                        lines.push(ind + "  WHEN MATCHED THEN " + this.normalize(ic, ce));
                    }
                    break;
                }
                case "WHEN NOT MATCHED": {
                    // WHEN NOT MATCHED THEN INSERT (cols) VALUES (vals)
                    var ic = cs;
                    if (ic < ce && this.tokens[ic].upper === "THEN")
                        ic++;
                    if (ic < ce && this.tokens[ic].upper === "INSERT") {
                        ic++;
                        lines.push(ind + "  WHEN NOT MATCHED THEN");
                        lines.push(ind + "INSERT");
                        // optional column list (cols)
                        if (ic < ce && this.tokens[ic].type === "po") {
                            var closeIdx = this.findMatchingClose(ic, ce);
                            if (closeIdx > 0) {
                                lines.push(ind + "     (");
                                lines.push(this.formatItemList(ic + 1, closeIdx, ind + "       ", ind + "     , "));
                                lines.push(ind + ")");
                                ic = closeIdx + 1;
                            }
                        }
                        // VALUES (vals)
                        if (ic < ce && this.tokens[ic].upper === "VALUES") {
                            ic++;
                            if (ic < ce && this.tokens[ic].type === "po") {
                                var closeIdx = this.findMatchingClose(ic, ce);
                                if (closeIdx > 0) {
                                    lines.push(ind + "VALUES (");
                                    lines.push(this.formatItemList(ic + 1, closeIdx, ind + "       ", ind + "     , "));
                                    lines.push(ind + ")");
                                    ic = closeIdx + 1;
                                }
                            }
                        }
                    }
                    else {
                        lines.push(ind + "  WHEN NOT MATCHED THEN " + this.normalize(ic, ce));
                    }
                    break;
                }
                default:
                    lines.push(this.formatSelectClause(cl, indent));
            }
        }
        return lines.join("\n");
    };
    /** start 이후 처음 만나는 절의 시작 인덱스 (없으면 end) */
    SqlFormatter.prototype.findNextClauseStart = function (start, end) {
        var depth = 0;
        for (var i = start; i < end; i++) {
            var t = this.tokens[i];
            if (t.type === "po") {
                depth++;
                continue;
            }
            if (t.type === "pc") {
                depth--;
                continue;
            }
            if (depth !== 0)
                continue;
            if (this.matchClauseKeyword(i, end))
                return i;
        }
        return end;
    };
    /** keyword가 start에 있으면 그 다음 인덱스 반환 */
    SqlFormatter.prototype.skipKw = function (start, end, keyword) {
        if (start < end && this.tokens[start].type === "word" && this.tokens[start].upper === keyword)
            return start + 1;
        return start;
    };
    /** MERGE 의 SET 절 — UPDATE SET 동일 정렬 */
    SqlFormatter.prototype.formatMergeSetClause = function (start, end, indent) {
        var ind = " ".repeat(indent);
        var items = this.splitByCommas(start, end);
        var maxCol = 0;
        for (var i = 0; i < items.length; i++) {
            var eq = this.findEqualsAtDepth0(items[i].start, items[i].end);
            if (eq < 0)
                continue;
            var c = this.normalize(items[i].start, eq);
            if (c.length > maxCol)
                maxCol = c.length;
        }
        var padLen = this.calcAlignWidth(maxCol);
        return this.formatAssignList(start, end, ind + "   SET ", ind + "     , ", padLen);
    };
    return SqlFormatter;
}());
// i-AUD 문장 구분 지시자 <@r@> 위치에서 소스를 분할한다(문자열/주석 안의 것은 무시).
// ============================================================
// PL/SQL 프로시저/함수/익명블록 정렬기
// CREATE [OR REPLACE] PROCEDURE|FUNCTION ... IS/AS <선언부> BEGIN <본문> [EXCEPTION ...] END;
// - 파라미터/변수 선언을 컬럼 정렬
// - IF/LOOP/BEGIN/EXCEPTION/WHEN 블록 구조에 따라 2칸 단위로 들여쓰기
// - 내부 DML(SELECT INTO/INSERT/UPDATE/DELETE/MERGE)은 기존 DML 정렬기에 위임 후 재들여쓰기
// 구조 해석 실패 시(중첩 서브프로그램 등) 원본을 그대로 반환한다(무손상 폴백).
// ============================================================
var PL_STRUCT = { IF: 1, ELSIF: 1, ELSE: 1, END: 1, LOOP: 1, WHILE: 1, FOR: 1, BEGIN: 1, EXCEPTION: 1, WHEN: 1, CASE: 1 };
var PL_DML = { SELECT: 1, INSERT: 1, UPDATE: 1, DELETE: 1, MERGE: 1, WITH: 1 };

function plIsWordStart(c) { return /[A-Za-z_]/.test(c); }
function plIsWordCont(c) { return /[A-Za-z0-9_$#.]/.test(c); }

// 공백을 단일 스페이스로 축약(문자열/블록주석 보존). 내부 라인주석은 블록주석으로,
// 문장 맨 끝의 라인주석은 트레일링 주석으로 유지한다.
function plCollapse(s) {
    var out = "", i = 0, n = s.length;
    while (i < n) {
        var c = s.charAt(i), d = s.charAt(i + 1);
        if (c === "'") {
            var j = i + 1;
            while (j < n) { if (s.charAt(j) === "'" && s.charAt(j + 1) === "'") { j += 2; continue; } if (s.charAt(j) === "'") { j++; break; } j++; }
            out += s.slice(i, j); i = j; continue;
        }
        if (c === "\"") { var j2 = i + 1; while (j2 < n && s.charAt(j2) !== "\"") j2++; if (j2 < n) j2++; out += s.slice(i, j2); i = j2; continue; }
        if (c === "/" && d === "*") { var j3 = i + 2; while (j3 < n - 1 && !(s.charAt(j3) === "*" && s.charAt(j3 + 1) === "/")) j3++; j3 = Math.min(j3 + 2, n); out += s.slice(i, j3); i = j3; continue; }
        if (c === "-" && d === "-") {
            var j4 = i + 2; while (j4 < n && s.charAt(j4) !== "\n") j4++;
            var body = s.slice(i + 2, j4).replace(/\s+$/, "");
            var k = j4; while (k < n && /\s/.test(s.charAt(k))) k++;
            if (k < n) { out = out.replace(/ $/, ""); out += " /*" + body + " */ "; }   // 내부 주석 → 블록
            else { out = out.replace(/\s+$/, ""); out += "  --" + body; }               // 트레일링 주석 유지
            i = j4; continue;
        }
        if (/\s/.test(c)) { out += " "; i++; while (i < n && /\s/.test(s.charAt(i))) i++; continue; }
        out += c; i++;
    }
    return out.replace(/^\s+/, "").replace(/\s+$/, "");
}

// s[pos]에서 시작하는 식별자 반환
function plWordAt(s, pos) {
    if (pos >= s.length || !plIsWordStart(s.charAt(pos))) return null;
    var j = pos + 1, n = s.length;
    while (j < n && /[A-Za-z0-9_$#]/.test(s.charAt(j))) j++;
    return { raw: s.slice(pos, j), upper: s.slice(pos, j).toUpperCase(), end: j };
}

// pos부터 공백/주석을 건너뛴 첫 위치
function plSkipTrivia(s, pos) {
    var n = s.length, i = pos;
    while (i < n) {
        var c = s.charAt(i), d = s.charAt(i + 1);
        if (/\s/.test(c)) { i++; continue; }
        if (c === "-" && d === "-") { while (i < n && s.charAt(i) !== "\n") i++; continue; }
        if (c === "/" && d === "*") { i += 2; while (i < n - 1 && !(s.charAt(i) === "*" && s.charAt(i + 1) === "/")) i++; i += 2; continue; }
        break;
    }
    return i;
}

// pos부터 스캔하여 지정한 종료 키워드(THEN/LOOP)를 만나면 그 뒤 위치 반환(문자열/주석/괄호 인식)
function plScanToKeyword(s, pos, stopWords) {
    var n = s.length, i = pos, depth = 0;
    while (i < n) {
        var c = s.charAt(i), d = s.charAt(i + 1);
        if (c === "'") { i++; while (i < n) { if (s.charAt(i) === "'" && s.charAt(i + 1) === "'") { i += 2; continue; } if (s.charAt(i) === "'") { i++; break; } i++; } continue; }
        if (c === "\"") { i++; while (i < n && s.charAt(i) !== "\"") i++; i++; continue; }
        if (c === "-" && d === "-") { while (i < n && s.charAt(i) !== "\n") i++; continue; }
        if (c === "/" && d === "*") { i += 2; while (i < n - 1 && !(s.charAt(i) === "*" && s.charAt(i + 1) === "/")) i++; i += 2; continue; }
        if (c === "(") { depth++; i++; continue; }
        if (c === ")") { depth--; i++; continue; }
        if (depth === 0 && plIsWordStart(c)) {
            var w = plWordAt(s, i);
            if (w && stopWords[w.upper]) return w.end;
            i = w ? w.end : i + 1; continue;
        }
        i++;
    }
    return i;
}

// pos부터 depth0 ';'까지 스캔(문자열/주석/괄호 인식). 종료 ';' 뒤 위치 + 같은 줄 트레일링 주석까지 포함.
function plScanToSemicolon(s, pos) {
    var n = s.length, i = pos, depth = 0;
    while (i < n) {
        var c = s.charAt(i), d = s.charAt(i + 1);
        if (c === "'") { i++; while (i < n) { if (s.charAt(i) === "'" && s.charAt(i + 1) === "'") { i += 2; continue; } if (s.charAt(i) === "'") { i++; break; } i++; } continue; }
        if (c === "\"") { i++; while (i < n && s.charAt(i) !== "\"") i++; i++; continue; }
        if (c === "-" && d === "-") { while (i < n && s.charAt(i) !== "\n") i++; continue; }
        if (c === "/" && d === "*") { i += 2; while (i < n - 1 && !(s.charAt(i) === "*" && s.charAt(i + 1) === "/")) i++; i += 2; continue; }
        if (c === "(") { depth++; i++; continue; }
        if (c === ")") { depth--; i++; continue; }
        if (c === ";" && depth === 0) {
            i++;
            // 같은 줄 트레일링 주석 흡수
            var k = i; while (k < n && (s.charAt(k) === " " || s.charAt(k) === "\t")) k++;
            if (s.charAt(k) === "-" && s.charAt(k + 1) === "-") { while (k < n && s.charAt(k) !== "\n") k++; return k; }
            return i;
        }
        i++;
    }
    return i;
}

// 본문(BEGIN...END;)을 세그먼트 배열로 분해
function plSegments(s) {
    var segs = [], i = 0, n = s.length;
    while (i < n) {
        while (i < n && /\s/.test(s.charAt(i))) i++;   // 공백만 스킵 — 주석은 아래에서 세그먼트로 포착
        if (i >= n) break;
        var c = s.charAt(i), d = s.charAt(i + 1);
        // 독립 주석(문장 경계에서 만난 주석) → 자체 세그먼트
        if (c === "-" && d === "-") { var e = i + 2; while (e < n && s.charAt(e) !== "\n") e++; segs.push({ kind: "comment", text: s.slice(i, e).replace(/\s+$/, "") }); i = e; continue; }
        if (c === "/" && d === "*") { var e2 = i + 2; while (e2 < n - 1 && !(s.charAt(e2) === "*" && s.charAt(e2 + 1) === "/")) e2++; e2 = Math.min(e2 + 2, n); segs.push({ kind: "comment", text: s.slice(i, e2) }); i = e2; continue; }
        var w = plWordAt(s, i);
        var u = w ? w.upper : "";
        if (w && PL_STRUCT[u]) {
            if (u === "IF" || u === "ELSIF") { var end = plScanToKeyword(s, w.end, { THEN: 1 }); segs.push({ kind: u === "IF" ? "if" : "elsif", text: plCollapse(s.slice(i, end)) }); i = end; continue; }
            if (u === "WHEN") { var end2 = plScanToKeyword(s, w.end, { THEN: 1 }); segs.push({ kind: "when", text: plCollapse(s.slice(i, end2)) }); i = end2; continue; }
            if (u === "FOR" || u === "WHILE") { var end3 = plScanToKeyword(s, w.end, { LOOP: 1 }); segs.push({ kind: "loop", text: plCollapse(s.slice(i, end3)) }); i = end3; continue; }
            if (u === "LOOP") { segs.push({ kind: "loop", text: w.raw }); i = w.end; continue; }
            if (u === "ELSE") { segs.push({ kind: "else", text: w.raw }); i = w.end; continue; }
            if (u === "BEGIN") { segs.push({ kind: "begin", text: w.raw }); i = w.end; continue; }
            if (u === "EXCEPTION") { segs.push({ kind: "exception", text: w.raw }); i = w.end; continue; }
            if (u === "CASE") { segs.push({ kind: "case", text: w.raw }); i = w.end; continue; }
            if (u === "END") {
                var nw = plWordAt(s, plSkipTrivia(s, w.end));
                var nu = nw ? nw.upper : "";
                var end4 = plScanToSemicolon(s, w.end);
                var kind = (nu === "IF") ? "endif" : (nu === "LOOP") ? "endloop" : (nu === "CASE") ? "endcase" : "end";
                segs.push({ kind: kind, text: plCollapse(s.slice(i, end4)) });
                i = end4; continue;
            }
        }
        // 일반 문장 또는 DML
        var stEnd = plScanToSemicolon(s, i);
        var text = plCollapse(s.slice(i, stEnd));
        var firstWord = plWordAt(text, 0);
        var kindGen = (firstWord && PL_DML[firstWord.upper]) ? "dml" : "stmt";
        segs.push({ kind: kindGen, text: text });
        i = stEnd;
    }
    return segs;
}

// 헤더의 파라미터 목록 정렬
function plFormatParams(inner) {
    // top-level 콤마로 분리
    var parts = [], depth = 0, start = 0, n = inner.length;
    for (var i = 0; i < n; i++) {
        var c = inner.charAt(i);
        if (c === "'") { i++; while (i < n) { if (inner.charAt(i) === "'" && inner.charAt(i + 1) === "'") { i += 2; continue; } if (inner.charAt(i) === "'") break; i++; } continue; }
        if (c === "(") depth++;
        else if (c === ")") depth--;
        else if (c === "," && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1; }
    }
    parts.push(inner.slice(start));
    var params = [];
    for (var p = 0; p < parts.length; p++) {
        var t = plCollapse(parts[p]);
        if (!t) continue;
        var fw = plWordAt(t, 0);
        var name = fw ? fw.raw : t;
        var rest = fw ? t.slice(fw.end).replace(/^\s+/, "") : "";
        params.push({ name: name, rest: rest });
    }
    if (params.length === 0) return null;
    var maxLen = 0;
    for (var q = 0; q < params.length; q++) if (params[q].name.length > maxLen) maxLen = params[q].name.length;
    var lines = [];
    for (var r = 0; r < params.length; r++) {
        var pre = r === 0 ? "    " : "  , ";
        var nm = params[r].name;
        while (nm.length < maxLen) nm += " ";
        lines.push(pre + nm + "   " + params[r].rest);
    }
    return lines;
}

// 선언부 정렬
function plFormatDeclarations(declBody) {
    var decls = [], i = 0, n = declBody.length;
    while (i < n) {
        i = plSkipTrivia(declBody, i);
        if (i >= n) break;
        var c = declBody.charAt(i), d = declBody.charAt(i + 1);
        if (c === "-" && d === "-") { var e = i + 2; while (e < n && declBody.charAt(e) !== "\n") e++; decls.push({ comment: true, text: declBody.slice(i, e).replace(/\s+$/, "") }); i = e; continue; }
        if (c === "/" && d === "*") { var e2 = i + 2; while (e2 < n - 1 && !(declBody.charAt(e2) === "*" && declBody.charAt(e2 + 1) === "/")) e2++; e2 = Math.min(e2 + 2, n); decls.push({ comment: true, text: declBody.slice(i, e2) }); i = e2; continue; }
        var end = plScanToSemicolon(declBody, i);
        var text = plCollapse(declBody.slice(i, end));
        if (text) decls.push({ comment: false, text: text });
        i = end;
    }
    // 정렬 대상(단순 식별자로 시작하고 예약 선언어가 아닌 것)의 이름 최대 길이
    var RESERVED = { CURSOR: 1, TYPE: 1, PRAGMA: 1, SUBTYPE: 1, FUNCTION: 1, PROCEDURE: 1 };
    var maxLen = 0;
    for (var k = 0; k < decls.length; k++) {
        if (decls[k].comment) continue;
        var fw = plWordAt(decls[k].text, 0);
        if (fw && !RESERVED[fw.upper]) { decls[k]._name = fw.raw; decls[k]._rest = decls[k].text.slice(fw.end).replace(/^\s+/, ""); if (fw.raw.length > maxLen) maxLen = fw.raw.length; }
    }
    var lines = [];
    for (var m = 0; m < decls.length; m++) {
        if (decls[m].comment) { lines.push("  " + decls[m].text); continue; }
        if (decls[m]._name != null) {
            var nm = decls[m]._name;
            while (nm.length < maxLen) nm += " ";
            lines.push("  " + nm + " " + decls[m]._rest);
        } else {
            lines.push("  " + decls[m].text);
        }
    }
    return lines;
}

// DML 세그먼트를 정렬 후 indent 만큼 재들여쓰기
function plIndentDml(text, indent) {
    var formatted;
    try { formatted = formatSQL(text); } catch (e) { formatted = text; }
    var rows = formatted.split("\n");
    var out = [];
    for (var i = 0; i < rows.length; i++) out.push(rows[i].length ? indent + rows[i] : rows[i]);
    return out.join("\n");
}

function isPlSqlBlock(sql) {
    var i = plSkipTrivia(sql, 0);
    var w = plWordAt(sql, i);
    if (!w) return false;
    var u = w.upper;
    if (u === "DECLARE" || u === "BEGIN") return true;
    if (u === "CREATE") {
        var j = plSkipTrivia(sql, w.end);
        var w2 = plWordAt(sql, j);
        while (w2 && (w2.upper === "OR" || w2.upper === "REPLACE" || w2.upper === "EDITIONABLE" || w2.upper === "NONEDITIONABLE")) { j = plSkipTrivia(sql, w2.end); w2 = plWordAt(sql, j); }
        if (w2 && (w2.upper === "PROCEDURE" || w2.upper === "FUNCTION")) return true;
    }
    return false;
}

function formatPlSql(sql) {
    var s = sql.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    // 후행 슬래시(/) SQL*Plus 종결자 분리
    var trailingSlash = "";
    var mSlash = s.match(/\n\s*\/\s*$/);
    if (mSlash) { trailingSlash = "\n/"; s = s.slice(0, s.length - mSlash[0].length).replace(/\s+$/, ""); }

    var out = [];
    var bodyStart = 0;

    var head = plWordAt(s, plSkipTrivia(s, 0));
    if (head && head.upper === "CREATE") {
        // 헤더: CREATE ... (params) [RETURN t] IS/AS  까지
        // 첫 depth0 '(' 위치와 첫 depth0 IS/AS 위치를 찾는다
        var isPos = -1, parenOpen = -1, parenClose = -1, depth = 0, i = 0, n = s.length;
        while (i < n) {
            var c = s.charAt(i), dch = s.charAt(i + 1);
            if (c === "'") { i++; while (i < n) { if (s.charAt(i) === "'" && s.charAt(i + 1) === "'") { i += 2; continue; } if (s.charAt(i) === "'") { i++; break; } i++; } continue; }
            if (c === "-" && dch === "-") { while (i < n && s.charAt(i) !== "\n") i++; continue; }
            if (c === "/" && dch === "*") { i += 2; while (i < n - 1 && !(s.charAt(i) === "*" && s.charAt(i + 1) === "/")) i++; i += 2; continue; }
            if (c === "(") { if (depth === 0 && parenOpen < 0) parenOpen = i; depth++; i++; continue; }
            if (c === ")") { depth--; if (depth === 0 && parenClose < 0) parenClose = i; i++; continue; }
            if (depth === 0 && plIsWordStart(c)) {
                var ww = plWordAt(s, i);
                if (ww && (ww.upper === "IS" || ww.upper === "AS")) { isPos = i; break; }
                i = ww ? ww.end : i + 1; continue;
            }
            i++;
        }
        if (isPos < 0) throw new Error("no IS/AS");
        var isKw = s.slice(isPos, isPos + 2);   // 원본 대소문자 유지 (IS/AS/is/as)
        var sigEnd = parenOpen >= 0 ? parenOpen : isPos;
        var signature = plCollapse(s.slice(0, sigEnd));
        var afterParen = parenClose >= 0 ? plCollapse(s.slice(parenClose + 1, isPos)) : "";  // RETURN t 등
        out.push(signature);
        if (parenOpen >= 0 && parenClose > parenOpen) {
            var paramLines = plFormatParams(s.slice(parenOpen + 1, parenClose));
            if (paramLines) {
                out.push("(");
                for (var pl = 0; pl < paramLines.length; pl++) out.push(paramLines[pl]);
                out.push(")" + (afterParen ? " " + afterParen : "") + " " + isKw);
            } else {
                out.push((afterParen ? afterParen + " " : "") + isKw);
            }
        } else {
            out[out.length - 1] = signature + (afterParen ? " " + afterParen : "") + " " + isKw;
        }
        bodyStart = isPos + 2;
    } else if (head && head.upper === "DECLARE") {
        out.push("DECLARE");
        bodyStart = head.end;
    } else {
        bodyStart = 0;   // 익명 BEGIN 블록
    }

    // 선언부: bodyStart ~ 최초 depth0 BEGIN
    var beginPos = -1;
    {
        var i2 = bodyStart, n2 = s.length, depth2 = 0;
        while (i2 < n2) {
            var c2 = s.charAt(i2), d2 = s.charAt(i2 + 1);
            if (c2 === "'") { i2++; while (i2 < n2) { if (s.charAt(i2) === "'" && s.charAt(i2 + 1) === "'") { i2 += 2; continue; } if (s.charAt(i2) === "'") { i2++; break; } i2++; } continue; }
            if (c2 === "-" && d2 === "-") { while (i2 < n2 && s.charAt(i2) !== "\n") i2++; continue; }
            if (c2 === "/" && d2 === "*") { i2 += 2; while (i2 < n2 - 1 && !(s.charAt(i2) === "*" && s.charAt(i2 + 1) === "/")) i2++; i2 += 2; continue; }
            if (c2 === "(") { depth2++; i2++; continue; }
            if (c2 === ")") { depth2--; i2++; continue; }
            if (depth2 === 0 && plIsWordStart(c2)) {
                var w3 = plWordAt(s, i2);
                if (w3 && w3.upper === "BEGIN") { beginPos = i2; break; }
                i2 = w3 ? w3.end : i2 + 1; continue;
            }
            i2++;
        }
    }
    if (beginPos < 0) throw new Error("no BEGIN");

    var declPart = s.slice(bodyStart, beginPos);
    if (plCollapse(declPart)) {
        var declLines = plFormatDeclarations(declPart);
        for (var dl = 0; dl < declLines.length; dl++) out.push(declLines[dl]);
    }

    // 본문: BEGIN 부터 끝까지
    var segs = plSegments(s.slice(beginPos));
    var level = 0;
    var stack = [];   // {type}
    function pad(l) { var r = ""; for (var q = 0; q < l; q++) r += "  "; return r; }
    for (var si = 0; si < segs.length; si++) {
        var seg = segs[si], k = seg.kind;
        if (k === "comment") { out.push(pad(level) + seg.text); continue; }
        if (k === "if" || k === "loop" || k === "case") { out.push(pad(level) + seg.text); stack.push({ type: k === "if" ? "IF" : k === "loop" ? "LOOP" : "CASE" }); level++; continue; }
        if (k === "begin") { out.push(pad(level) + seg.text); stack.push({ type: "BEGIN" }); level++; continue; }
        if (k === "elsif" || k === "else") { out.push(pad(Math.max(0, level - 1)) + seg.text); continue; }
        if (k === "exception") { out.push(pad(Math.max(0, level - 1)) + seg.text); continue; }
        if (k === "when") {
            if (stack.length && stack[stack.length - 1].type === "WHEN") { stack.pop(); level = Math.max(0, level - 1); }
            out.push(pad(level) + seg.text); stack.push({ type: "WHEN" }); level++; continue;
        }
        if (k === "endif" || k === "endloop" || k === "endcase" || k === "end") {
            while (stack.length && stack[stack.length - 1].type === "WHEN") { stack.pop(); level = Math.max(0, level - 1); }
            if (stack.length) stack.pop();
            level = Math.max(0, level - 1);
            out.push(pad(level) + seg.text); continue;
        }
        if (k === "dml") { out.push(plIndentDml(seg.text, pad(level))); continue; }
        out.push(pad(level) + seg.text);   // 일반 문장
    }

    return out.join("\n") + trailingSlash;
}

function splitRunDirective(s) {
    var parts = [];
    var start = 0, i = 0, n = s.length;
    while (i < n) {
        var c = s.charAt(i), d = s.charAt(i + 1);
        if (c === "-" && d === "-") { while (i < n && s.charAt(i) !== "\n") i++; continue; }
        if (c === "/" && d === "*") { i += 2; while (i < n - 1 && !(s.charAt(i) === "*" && s.charAt(i + 1) === "/")) i++; i += 2; continue; }
        if (c === "'") { i++; while (i < n) { if (s.charAt(i) === "'" && s.charAt(i + 1) === "'") { i += 2; continue; } if (s.charAt(i) === "'") { i++; break; } i++; } continue; }
        if (c === "\"") { i++; while (i < n && s.charAt(i) !== "\"") i++; i++; continue; }
        if (c === "<" && s.slice(i, i + 5) === "<@r@>") { parts.push(s.slice(start, i)); start = i + 5; i += 5; continue; }
        i++;
    }
    parts.push(s.slice(start));
    return parts;
}

// 엑셀/웹에서 붙여넣을 때 섞여 들어오는 보이지 않는 문자를 정제한다.
// - NBSP(U+00A0)·전각공백(U+3000)·각종 유니코드 공백 → 일반 스페이스
// - 제로폭 문자(ZWSP/ZWNJ/ZWJ/BOM/word-joiner) → 제거
// 문자열 리터럴('...')과 식별자("...") 내부는 데이터 훼손을 막기 위해 원본 보존한다.
function sanitizeSql(sql) {
    var out = "", i = 0, n = sql.length;
    while (i < n) {
        var c = sql.charAt(i);
        // 문자열 리터럴 — 내부 원본 유지
        if (c === "'") {
            var s = i; i++;
            while (i < n) { if (sql.charAt(i) === "'" && sql.charAt(i + 1) === "'") { i += 2; continue; } if (sql.charAt(i) === "'") { i++; break; } i++; }
            out += sql.slice(s, i); continue;
        }
        // 따옴표 식별자 — 내부 원본 유지
        if (c === "\"") {
            var s2 = i; i++;
            while (i < n && sql.charAt(i) !== "\"") i++;
            if (i < n) i++;
            out += sql.slice(s2, i); continue;
        }
        var code = sql.charCodeAt(i);
        // 유니코드 공백류 → 일반 스페이스
        if (code === 0x00A0 || code === 0x1680 || (code >= 0x2000 && code <= 0x200A) || code === 0x202F || code === 0x205F || code === 0x3000) {
            out += " "; i++; continue;
        }
        // 폭 없는 문자 제거
        if (code === 0x200B || code === 0x200C || code === 0x200D || code === 0x2060 || code === 0xFEFF) {
            i++; continue;
        }
        out += c; i++;
    }
    return out;
}

// 선두의 비-SQL 텍스트(엑셀에서 딸려온 메모/제목 등)를 분리한다.
// 이런 줄이 맨 앞에 있으면 정렬기가 문장을 인식하지 못해 전체가 원본 반환된다.
// SQL 문장 시작 키워드나 주석을 만나기 전까지의 줄을 prelude로 떼어 보존한다.
function peelNonSqlPrelude(cleaned) {
    var lines = cleaned.split("\n");
    var STARTS = { WITH: 1, SELECT: 1, INSERT: 1, UPDATE: 1, DELETE: 1, MERGE: 1 };
    var k = 0;
    for (; k < lines.length; k++) {
        var t = lines[k].replace(/^\s+/, "");
        if (t === "") continue;                                  // 빈 줄은 넘김
        if (t.indexOf("--") === 0 || t.indexOf("/*") === 0) break; // 주석 → 본문 처리에 위임
        var mw = t.match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (mw && STARTS[mw[0].toUpperCase()]) break;             // SQL 문장 시작
        // 그 외(비-SQL 텍스트) → prelude로 흡수
    }
    if (k === 0) return { prelude: "", body: cleaned };
    var prelude = lines.slice(0, k).map(function (l) { return l.replace(/\s+$/, ""); }).join("\n").replace(/\n+$/, "");
    var body = lines.slice(k).join("\n");
    return { prelude: prelude, body: body };
}

function formatSQLCore(sql) {
    if (!sql)
        return "";
    var cleaned = sanitizeSql(sql).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!cleaned)
        return "";
    // <@r@> 는 문장 구분 지시자 — 각 문장을 개별 정렬하고 <@r@>는 단독 줄로 유지
    var runParts = splitRunDirective(cleaned);
    if (runParts.length > 1) {
        return runParts.map(function (p) { return formatSQLCore(p); }).join("\n<@r@>\n");
    }
    // PL/SQL 프로시저/함수/익명블록은 전용 정렬기로 처리(실패 시 원본 반환)
    if (isPlSqlBlock(cleaned)) {
        try { return formatPlSql(cleaned); } catch (e) { return sql; }
    }
    // 선두 비-SQL 텍스트(메모 등) 분리 후 본문만 정렬
    var peeled = peelNonSqlPrelude(cleaned);
    if (peeled.prelude) {
        var pbody = peeled.body.replace(/^\s+/, "");
        return pbody ? peeled.prelude + "\n" + formatSQLCore(pbody) : peeled.prelude;
    }
    var trailingSemi = "";
    while (cleaned.length > 0 && cleaned.charAt(cleaned.length - 1) === ";") {
        trailingSemi = ";" + trailingSemi;
        cleaned = cleaned.substring(0, cleaned.length - 1).replace(/[ \t\r\n]+$/, "");
    }
    try {
        var result = new SqlFormatter(cleaned).format();
        return result + trailingSemi;
    }
    catch (e) {
        return sql;
    }
}

// 주석 손실 안전망 ─────────────────────────────────────────────
// 대부분의 주석은 정렬기가 제자리에 보존하지만, 드문 경로(INSERT VALUES 등)에서 놓칠 수 있다.
// "주석은 절대 삭제되지 않는다"를 보장하기 위해, 코어가 누락한 주석을 감지해 말미에 보존한다.
var LOST_COMMENT_MARK = "[정렬:보존된 주석] ";

function commentInnerText(v) {
    return v.replace(/^--/, "").replace(/^\/\*/, "").replace(/\*\/\s*$/, "").trim().replace(/\s+/g, " ");
}
// 주석 내용 목록. 마커 접두사는 벗겨서 원문과 동일 기준으로 대조(→ 재정렬 시 멱등).
function collectComments(sql) {
    var toks = tokenizeSql(sql);
    var arr = [];
    for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (t.type !== "cmt-line" && t.type !== "cmt-block") continue;
        var inner = commentInnerText(t.value);
        if (inner.indexOf(LOST_COMMENT_MARK) === 0) inner = inner.slice(LOST_COMMENT_MARK.length);
        arr.push(inner);
    }
    return arr;
}

function formatSQL(sql) {
    var result = formatSQLCore(sql);
    try {
        var want = collectComments(sql);
        if (want.length === 0) return result;
        var have = collectComments(result);
        var lost = [];
        for (var w = 0; w < want.length; w++) {
            var idx = have.indexOf(want[w]);
            if (idx >= 0) have.splice(idx, 1);
            else lost.push(want[w]);
        }
        if (lost.length > 0) {
            result += "\n" + lost.map(function (c) { return "-- " + LOST_COMMENT_MARK + c; }).join("\n");
        }
    } catch (e) { /* 안전망 실패는 무시 */ }
    return result;
}

// 괄호 균형 검사 — 문자열/주석을 무시하고 ( ) 짝을 확인한다.
// 정렬이 무너지는 대표 원인(괄호 불균형)을 사전 경고하기 위함. 정렬 로직과 독립.
function checkSqlParens(sql) {
    if (!sql) return { balanced: true, open: 0, close: 0, openLines: [], strayCloseLines: [] };
    var s = sql.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var i = 0, n = s.length, line = 1;
    var stack = [];        // 닫히지 않은 '(' 의 라인들
    var strayClose = [];   // 짝 없는 ')' 의 라인들
    function adv() { if (s.charAt(i) === "\n") line++; i++; }
    while (i < n) {
        var c = s.charAt(i), d = s.charAt(i + 1);
        if (c === "-" && d === "-") { while (i < n && s.charAt(i) !== "\n") adv(); continue; }
        if (c === "/" && d === "*") { adv(); adv(); while (i < n - 1 && !(s.charAt(i) === "*" && s.charAt(i + 1) === "/")) adv(); adv(); adv(); continue; }
        if (c === "'") { adv(); while (i < n) { if (s.charAt(i) === "'" && s.charAt(i + 1) === "'") { adv(); adv(); continue; } if (s.charAt(i) === "'") { adv(); break; } adv(); } continue; }
        if (c === "\"") { adv(); while (i < n && s.charAt(i) !== "\"") adv(); adv(); continue; }
        if (c === "(") { stack.push(line); adv(); continue; }
        if (c === ")") { if (stack.length > 0) stack.pop(); else strayClose.push(line); adv(); continue; }
        adv();
    }
    return {
        balanced: stack.length === 0 && strayClose.length === 0,
        open: stack.length,
        close: strayClose.length,
        openLines: stack,
        strayCloseLines: strayClose,
    };
}

var SAMPLE_SQL = "SELECT 'N' AS CHK, E.EMP_ID, E.EMP_NM, E.DEPT_CD, E.HIRE_DATE,\n       CASE WHEN E.RETIRE_DATE IS NOT NULL THEN 'Y' ELSE 'N' END AS RETIRED,\n       E.SALARY, E.EMAIL, E.CREATE_USER_CD, E.CREATE_DATE,\n       NVL(D.SORT_SEQ, 99) AS DEPT_SEQ\n  FROM EMPLOYEE E\n  LEFT OUTER JOIN DEPARTMENT D ON E.DEPT_CD = D.DEPT_CD\n  LEFT OUTER JOIN COMMON_CODE COMM ON COMM.GROUP_CD = 'GRADE' AND COMM.USE_YN = 'Y'\n                                  AND COMM.CODE = E.GRADE_CD\n WHERE 1=1 AND E.USE_YN = @:VS_USE_YN AND E.DEPT_CD = @:VS_DEPT_CD\n   AND E.GRADE_CD IN (@:VS_GRADE_CD)\n   AND UPPER(E.EMP_ID || E.EMP_NM) LIKE '%' || UPPER(@:VS_KEYWORD) || '%'\n   AND SUBSTR(E.EMP_ID, 1, 3) IN (@:VS_EMP_PREFIX)\n ORDER BY DEPT_SEQ, EMP_ID";

export { formatSQL, SAMPLE_SQL, checkSqlParens };
