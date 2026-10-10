// flatuicolors.com 공식 팔레트 데이터.
// Flat UI Colors v1 (클래식 20색) + Flat UI Colors 2 국가별 컬렉션.
export interface Swatch {
  hex: string;
  name?: string;
}
export interface Palette {
  id: string;
  title: string;
  flag: string;
  colors: Swatch[];
}

export const PALETTES: Palette[] = [
  {
    id: 'flat-v1',
    title: 'Flat UI Colors (v1)',
    flag: '🎨',
    colors: [
      { hex: '#1ABC9C', name: 'Turquoise' }, { hex: '#16A085', name: 'Green Sea' },
      { hex: '#2ECC71', name: 'Emerald' }, { hex: '#27AE60', name: 'Nephritis' },
      { hex: '#3498DB', name: 'Peter River' }, { hex: '#2980B9', name: 'Belize Hole' },
      { hex: '#9B59B6', name: 'Amethyst' }, { hex: '#8E44AD', name: 'Wisteria' },
      { hex: '#34495E', name: 'Wet Asphalt' }, { hex: '#2C3E50', name: 'Midnight Blue' },
      { hex: '#F1C40F', name: 'Sun Flower' }, { hex: '#F39C12', name: 'Orange' },
      { hex: '#E67E22', name: 'Carrot' }, { hex: '#D35400', name: 'Pumpkin' },
      { hex: '#E74C3C', name: 'Alizarin' }, { hex: '#C0392B', name: 'Pomegranate' },
      { hex: '#ECF0F1', name: 'Clouds' }, { hex: '#BDC3C7', name: 'Silver' },
      { hex: '#95A5A6', name: 'Concrete' }, { hex: '#7F8C8D', name: 'Asbestos' },
    ],
  },
  {
    id: 'american',
    title: 'American',
    flag: '🇺🇸',
    colors: [
      { hex: '#55EFC4', name: 'Light Greenish Blue' }, { hex: '#00B894', name: 'Mint Leaf' },
      { hex: '#81ECEC', name: 'Green Darner Tail' }, { hex: '#00CEC9', name: "Robin's Egg Blue" },
      { hex: '#74B9FF', name: 'Soft Blue' }, { hex: '#0984E3', name: 'Electron Blue' },
      { hex: '#A29BFE', name: 'Shy Moment' }, { hex: '#6C5CE7', name: 'Exodus Fruit' },
      { hex: '#DFE6E9', name: 'City Lights' }, { hex: '#B2BEC3', name: 'Soothing Breeze' },
      { hex: '#FFEAA7', name: 'Sour Lemon' }, { hex: '#FDCB6E', name: 'First Date' },
      { hex: '#FAB1A0', name: 'Bright Yarrow' }, { hex: '#E17055', name: 'Orangeville' },
      { hex: '#FF7675', name: 'Pink Glamour' }, { hex: '#D63031', name: 'Chi-Gong' },
      { hex: '#FD79A8', name: 'Prunus Avium' }, { hex: '#E84393', name: 'Pico-8 Pink' },
      { hex: '#636E72', name: 'American River' }, { hex: '#2D3436', name: 'Dracula Orchid' },
    ],
  },
  {
    id: 'dutch',
    title: 'Dutch Field',
    flag: '🇳🇱',
    colors: [
      { hex: '#FFC312', name: 'Sunflower' }, { hex: '#F79F1F', name: 'Radiant Yellow' },
      { hex: '#C4E538', name: 'Energos' }, { hex: '#A3CB38', name: 'Android Green' },
      { hex: '#12CBC4', name: 'Blue Martina' }, { hex: '#1289A7', name: 'Mediterranean Sea' },
      { hex: '#FDA7DF', name: 'Lavender Rose' }, { hex: '#D980FA', name: 'Lavender Tea' },
      { hex: '#ED4C67', name: 'Bara Red' }, { hex: '#B53471', name: 'Very Berry' },
      { hex: '#EE5A24', name: "Puffin's Bill" }, { hex: '#009432', name: 'Pixelated Grass' },
      { hex: '#0652DD', name: 'Merchant Marine Blue' }, { hex: '#9980FA', name: 'Forgotten Purple' },
      { hex: '#833471', name: 'Hollyhock' }, { hex: '#EA2027', name: 'Red Pigment' },
      { hex: '#006266', name: 'Turkish Aqua' }, { hex: '#1B1464', name: '20000 Leagues Under the Sea' },
      { hex: '#5758BB', name: 'Circumorbital Ring' }, { hex: '#6F1E51', name: 'Magenta Purple' },
    ],
  },
  {
    id: 'british',
    title: 'British',
    flag: '🇬🇧',
    colors: [
      { hex: '#00A8FF', name: 'Protoss Pylon' }, { hex: '#0097E6', name: 'Vanadyl Blue' },
      { hex: '#9C88FF', name: 'Periwinkle' }, { hex: '#8C7AE6', name: 'Matt Purple' },
      { hex: '#FBC531', name: 'Rise-N-Shine' }, { hex: '#E1B12C', name: 'Nanohanacha Gold' },
      { hex: '#4CD137', name: 'Down Town Green' }, { hex: '#44BD32', name: 'Skirret Green' },
      { hex: '#487EB0', name: 'Seabrook' }, { hex: '#40739E', name: 'Naval' },
      { hex: '#E84118', name: 'Nasturcian Flower' }, { hex: '#C23616', name: 'Harley Davidson Orange' },
      { hex: '#F5F6FA', name: 'Lynx White' }, { hex: '#DCDDE1', name: 'Hint of Pensive' },
      { hex: '#7F8FA6', name: 'Blueberry Soda' }, { hex: '#718093', name: 'Chain Gang Grey' },
      { hex: '#273C75', name: 'Mazarine Blue' }, { hex: '#192A56', name: 'Pico Void' },
      { hex: '#353B48', name: 'Blue Nights' }, { hex: '#2F3640', name: 'Electromagnetic' },
    ],
  },
  {
    id: 'german',
    title: 'German',
    flag: '🇩🇪',
    colors: [
      { hex: '#FC5C65', name: 'Desire' }, { hex: '#EB3B5A', name: 'Fusion Red' },
      { hex: '#FD9644', name: 'Flirtatious' }, { hex: '#FA8231', name: 'Orange Hibiscus' },
      { hex: '#FED330', name: 'NYC Taxi' }, { hex: '#F7B731', name: 'Flame Pea' },
      { hex: '#26DE81', name: 'Algal Fuel' }, { hex: '#20BF6B', name: 'Reptile Green' },
      { hex: '#2BCBBA', name: 'Jade Dust' }, { hex: '#0FB9B1', name: 'Turquoise Topaz' },
      { hex: '#45AAF2', name: 'High Blue' }, { hex: '#2D98DA', name: 'Boyzone' },
      { hex: '#4B7BEC', name: 'C64 NTSC' }, { hex: '#3867D6', name: 'Royal Blue' },
      { hex: '#A55EEA', name: 'Lighter Purple' }, { hex: '#8854D0', name: 'Gloomy Purple' },
      { hex: '#D1D8E0', name: 'Twinkle Blue' }, { hex: '#A5B1C2', name: 'Blue Grey' },
      { hex: '#778CA3', name: 'Innuendo' }, { hex: '#4B6584', name: 'Blue Horizon' },
    ],
  },
  {
    id: 'french',
    title: 'French',
    flag: '🇫🇷',
    colors: [
      { hex: '#FEA47F' }, { hex: '#F97F51' }, { hex: '#25CCF7' }, { hex: '#1B9CFC' },
      { hex: '#EAB543' }, { hex: '#F8EFBA' }, { hex: '#55E6C1' }, { hex: '#58B19F' },
      { hex: '#CAD3C8' }, { hex: '#2C3A47' }, { hex: '#B33771' }, { hex: '#6D214F' },
      { hex: '#3B3B98' }, { hex: '#182C61' }, { hex: '#FD7272' }, { hex: '#FC427B' },
      { hex: '#9AECDB' }, { hex: '#BDC581' }, { hex: '#D6A2E8' }, { hex: '#82589F' },
    ],
  },
  {
    id: 'chinese',
    title: 'Chinese',
    flag: '🇨🇳',
    colors: [
      { hex: '#F6E58D' }, { hex: '#F9CA24' }, { hex: '#FFBE76' }, { hex: '#F0932B' },
      { hex: '#FF7979' }, { hex: '#EB4D4B' }, { hex: '#BADC58' }, { hex: '#6AB04C' },
      { hex: '#DFF9FB' }, { hex: '#C7ECEE' }, { hex: '#7ED6DF' }, { hex: '#22A6B3' },
      { hex: '#E056FD' }, { hex: '#BE2EDD' }, { hex: '#686DE0' }, { hex: '#4834D4' },
      { hex: '#30336B' }, { hex: '#130F40' }, { hex: '#95AFC0' }, { hex: '#535C68' },
    ],
  },
  {
    id: 'indian',
    title: 'Indian',
    flag: '🇮🇳',
    colors: [
      { hex: '#FF9FF3' }, { hex: '#F368E0' }, { hex: '#FECA57' }, { hex: '#FF9F43' },
      { hex: '#FF6B6B' }, { hex: '#EE5253' }, { hex: '#48DBFB' }, { hex: '#0ABDE3' },
      { hex: '#1DD1A1' }, { hex: '#10AC84' }, { hex: '#00D2D3' }, { hex: '#01A3A4' },
      { hex: '#54A0FF' }, { hex: '#2E86DE' }, { hex: '#5F27CD' }, { hex: '#341F97' },
      { hex: '#C8D6E5' }, { hex: '#8395A7' }, { hex: '#576574' }, { hex: '#222F3E' },
    ],
  },
  {
    id: 'spanish',
    title: 'Spanish',
    flag: '🇪🇸',
    colors: [
      { hex: '#40407A' }, { hex: '#2C2C54' }, { hex: '#706FD3' }, { hex: '#474787' },
      { hex: '#F7F1E3' }, { hex: '#AAA69D' }, { hex: '#34ACE0' }, { hex: '#227093' },
      { hex: '#33D9B2' }, { hex: '#218C74' }, { hex: '#FF5252' }, { hex: '#B33939' },
      { hex: '#FF793F' }, { hex: '#CD6133' }, { hex: '#D1CCC0' }, { hex: '#84817A' },
      { hex: '#FFB142' }, { hex: '#CC8E35' }, { hex: '#FFDA79' }, { hex: '#CCAE62' },
    ],
  },
  {
    id: 'russian',
    title: 'Russian',
    flag: '🇷🇺',
    colors: [
      { hex: '#F3A683' }, { hex: '#F19066' }, { hex: '#F7D794' }, { hex: '#F5CD79' },
      { hex: '#778BEB' }, { hex: '#546DE5' }, { hex: '#E77F67' }, { hex: '#E15F41' },
      { hex: '#CF6A87' }, { hex: '#C44569' }, { hex: '#574B90' }, { hex: '#786FA6' },
      { hex: '#F78FB3' }, { hex: '#F8A5C2' }, { hex: '#3DC1D3' }, { hex: '#63CDDA' },
      { hex: '#E66767' }, { hex: '#EA8685' }, { hex: '#303952' }, { hex: '#596275' },
    ],
  },
];

// HEX → "rgb(r, g, b)"
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// 텍스트 대비용: 배경이 밝으면 어두운 글자 반환
export function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  // YIQ 명도
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

// ── 색상 변환 (색상 휠용) ──────────────────────────────────
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// HSV(h:0~360, s:0~1, v:0~1) → "#RRGGBB"
export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) => clamp(Math.round((n + m) * 255), 0, 255).toString(16).padStart(2, '0');
  return ('#' + to(r) + to(g) + to(b)).toUpperCase();
}

// "#RRGGBB" → HSV
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const x = hex.replace('#', '');
  const r = parseInt(x.substring(0, 2), 16) / 255;
  const g = parseInt(x.substring(2, 4), 16) / 255;
  const b = parseInt(x.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

// "#RRGGBB" → "hsl(h, s%, l%)"
export function hexToHsl(hex: string): string {
  const x = hex.replace('#', '');
  const r = parseInt(x.substring(0, 2), 16) / 255;
  const g = parseInt(x.substring(2, 4), 16) / 255;
  const b = parseInt(x.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

// ── Color Hunt 스타일 색 조합 (4~5색 팔레트) ─────────────────
export interface Combo {
  id: string;
  title: string;
  colors: string[];
}

export const COMBOS: Combo[] = [
  { id: 'dark-teal', title: 'Dark Teal', colors: ['#222831', '#393E46', '#00ADB5', '#EEEEEE'] },
  { id: 'cyberpunk', title: 'Cyberpunk', colors: ['#252A34', '#08D9D6', '#FF2E63', '#EAEAEA'] },
  { id: 'navy-coral', title: 'Navy Coral', colors: ['#364F6B', '#3FC1C9', '#F5F5F5', '#FC5185'] },
  { id: 'mint-fresh', title: 'Mint Fresh', colors: ['#11999E', '#30E3CA', '#40514E', '#E4F9F5'] },
  { id: 'pink-mint', title: 'Pink & Mint', colors: ['#F6416C', '#FFDE7D', '#F8F3D4', '#00B8A9'] },
  { id: 'soft-pink', title: 'Soft Pink', colors: ['#F38181', '#FCE38A', '#EAFFD0', '#95E1D3'] },
  { id: 'pastel-warm', title: 'Pastel Warm', colors: ['#A8E6CE', '#DCEDC2', '#FFD3B5', '#FFAAA6'] },
  { id: 'red-plum', title: 'Red Plum', colors: ['#E84545', '#903749', '#2B2E4A', '#53354A'] },
  { id: 'retro-sunset', title: 'Retro Sunset', colors: ['#2D4059', '#EA5455', '#F07B3F', '#FFD460'] },
  { id: 'ocean', title: 'Ocean', colors: ['#05445E', '#189AB4', '#75E6DA', '#D4F1F4'] },
  { id: 'sunset', title: 'Sunset', colors: ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'] },
  { id: 'berry', title: 'Berry Pop', colors: ['#540D6E', '#EE4266', '#FFD23F', '#3BCEAC', '#0EAD69'] },
  { id: 'earthy', title: 'Earthy', colors: ['#5D5C61', '#379683', '#7395AE', '#557A95'] },
  { id: 'forest', title: 'Forest', colors: ['#1B4332', '#2D6A4F', '#40916C', '#74C69D', '#B7E4C7'] },
  { id: 'mono-blue', title: 'Mono Blue', colors: ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#6FFFE9'] },
  { id: 'rainbow', title: 'Primary Pop', colors: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'] },
  { id: 'coffee', title: 'Coffee', colors: ['#4B3832', '#854442', '#FFF4E6', '#3C2F2F', '#BE9B7B'] },
  { id: 'grape-soda', title: 'Grape Soda', colors: ['#2C003E', '#512B58', '#7B337D', '#C03A76'] },
  { id: 'autumn', title: 'Autumn', colors: ['#5C3D2E', '#B85C38', '#E0C097', '#2D2424'] },
  { id: 'lavender', title: 'Lavender', colors: ['#3D2C8D', '#916BBF', '#C996CC', '#FFE5F1'] },
  { id: 'nordic', title: 'Nordic', colors: ['#2E3440', '#3B4252', '#88C0D0', '#ECEFF4'] },
  { id: 'sand-sea', title: 'Sand & Sea', colors: ['#006D77', '#83C5BE', '#EDF6F9', '#FFDDD2', '#E29578'] },
  { id: 'peach-cream', title: 'Peach Cream', colors: ['#FF9A8B', '#FFB4A2', '#FFCDB2', '#E5989B', '#B5838D'] },
  { id: 'deep-space', title: 'Deep Space', colors: ['#0B0C10', '#1F2833', '#45A29E', '#66FCF1', '#C5C6C7'] },
  { id: 'matcha', title: 'Matcha', colors: ['#283618', '#606C38', '#FEFAE0', '#DDA15E', '#BC6C25'] },
  { id: 'blossom', title: 'Blossom', colors: ['#FFCAD4', '#F4ACB7', '#9D8189', '#D8E2DC', '#FFE5D9'] },
  { id: 'indigo-flame', title: 'Indigo Mist', colors: ['#22223B', '#4A4E69', '#9A8C98', '#C9ADA7', '#F2E9E4'] },
  { id: 'tropical', title: 'Tropical', colors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF'] },
  { id: 'wine-night', title: 'Wine Night', colors: ['#1A1423', '#372549', '#774C60', '#B75D69', '#EACDC2'] },
  { id: 'citrus', title: 'Citrus', colors: ['#F94144', '#F3722C', '#F8961E', '#F9C74F', '#90BE6D'] },
  { id: 'slate-rose', title: 'Slate Rose', colors: ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C', '#D90429'] },
  { id: 'emerald-night', title: 'Emerald Night', colors: ['#0D1B2A', '#1B263B', '#415A77', '#778DA9', '#E0E1DD'] },
  { id: 'candy', title: 'Candy', colors: ['#FF4D6D', '#FF8FA3', '#FFB3C1', '#FFCCD5', '#FFF0F3'] },
  { id: 'olive-grove', title: 'Olive Grove', colors: ['#344E41', '#3A5A40', '#588157', '#A3B18A', '#DAD7CD'] },
  { id: 'sunrise', title: 'Sunrise', colors: ['#03071E', '#9D0208', '#DC2F02', '#F48C06', '#FFBA08'] },
  { id: 'arctic', title: 'Arctic', colors: ['#CAF0F8', '#90E0EF', '#00B4D8', '#0077B6', '#03045E'] },
  { id: 'mocha', title: 'Mocha', colors: ['#2D2424', '#5C3D2E', '#B85C38', '#E0C097'] },
  { id: 'plum-haze', title: 'Plum Haze', colors: ['#231942', '#5E548E', '#9F86C0', '#BE95C4', '#E0B1CB'] },
  { id: 'fresh-lime', title: 'Fresh Lime', colors: ['#007F5F', '#2B9348', '#55A630', '#80B918', '#AACC00'] },
  { id: 'dusk', title: 'Dusk', colors: ['#355070', '#6D597A', '#B56576', '#E56B6F', '#EAAC8B'] },
];
