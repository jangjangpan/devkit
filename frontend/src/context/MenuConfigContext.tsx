import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { menuConfigApi, type MenuConfig } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface Ctx {
  config: MenuConfig;
  reload: () => void;
  // TOOLS(전체 메뉴 키 배열) 기준으로 순서/숨김 적용한 표시 순서를 계산
  apply: <T extends { to: string }>(items: T[]) => T[];
}

const MenuConfigContext = createContext<Ctx>({
  config: { order: [], hidden: [] },
  reload: () => {},
  apply: (items) => items,
});

export function MenuConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<MenuConfig>({ order: [], hidden: [] });

  const reload = useCallback(() => {
    if (!user) return;
    menuConfigApi.get().then(setConfig).catch(() => {});
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  // 저장된 순서대로 정렬(미포함 신규 메뉴는 원래 순서로 뒤에) + 숨김 제외
  const apply = useCallback(<T extends { to: string }>(items: T[]): T[] => {
    const hidden = new Set(config.hidden);
    const order = config.order.length ? config.order : items.map((i) => i.to);
    const rank = new Map(order.map((k, i) => [k, i]));
    return items
      .filter((i) => !hidden.has(i.to))
      .slice()
      .sort((a, b) => (rank.has(a.to) ? rank.get(a.to)! : 999) - (rank.has(b.to) ? rank.get(b.to)! : 999));
  }, [config]);

  return <MenuConfigContext.Provider value={{ config, reload, apply }}>{children}</MenuConfigContext.Provider>;
}

export const useMenuConfig = () => useContext(MenuConfigContext);
