// 테마(스킨) 정의 + 적용. index.css 의 html[data-theme="X"] CSS 변수와 연동.
export interface ThemeDef {
  id: string;
  label: string;
  swatch: string; // 미리보기 색 (메인 blue)
}

export const THEMES: ThemeDef[] = [
  { id: 'BLUE', label: '블루', swatch: '#1A67A3' },
  { id: 'INDIGO', label: '인디고', swatch: '#4F46E5' },
  { id: 'GREEN', label: '그린', swatch: '#16A34A' },
  { id: 'TEAL', label: '틸', swatch: '#0D9488' },
  { id: 'PURPLE', label: '퍼플', swatch: '#7C3AED' },
  { id: 'ROSE', label: '로즈', swatch: '#E11D48' },
  { id: 'ORANGE', label: '오렌지', swatch: '#EA580C' },
  { id: 'SLATE', label: '슬레이트', swatch: '#475569' },
];

const VALID = new Set(THEMES.map((t) => t.id));

export function applyTheme(theme: string | undefined | null) {
  const t = theme && VALID.has(theme) ? theme : 'BLUE';
  document.documentElement.dataset.theme = t;
}
