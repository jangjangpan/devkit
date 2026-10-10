import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'devkit_dark';

const Ctx = createContext<{ dark: boolean; toggle: () => void } | null>(null);

export function DarkProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem(KEY) === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(KEY, dark ? '1' : '0');
  }, [dark]);

  return <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</Ctx.Provider>;
}

export function useDark() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDark must be used within DarkProvider');
  return c;
}
