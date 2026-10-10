import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** true면 본문 패딩 제거 + 전체 높이 사용 (다이어그램 캔버스용) */
  flush?: boolean;
  children: ReactNode;
}

export default function Layout({ title, subtitle, actions, flush, children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white border-b border-gray-100 flex items-center justify-between gap-4 px-6 dark:bg-[#162033] dark:border-[#243149]">
          <div className="min-w-0 shrink">
            <h1 className="text-lg font-bold text-gray-700 dark:text-gray-100 truncate">{title}</h1>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0 overflow-x-auto whitespace-nowrap">{actions}</div>
        </header>
        <main className={flush ? 'flex-1 min-h-0' : 'flex-1 min-h-0 overflow-auto p-6'}>
          {children}
        </main>
      </div>
    </div>
  );
}
