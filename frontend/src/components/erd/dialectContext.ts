import { createContext } from 'react';
import type { Dialect } from '../../lib/ddl';

// ERD 엔티티 노드가 현재 선택된 dialect를 읽어 물리 타입명을 표시하기 위한 컨텍스트.
export const ErdDialectContext = createContext<Dialect>('oracle');
