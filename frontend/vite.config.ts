import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// SPA를 Tomcat의 /devkit context에 통합 빌드.
// 빌드 결과는 ../src/main/resources/static 으로 직접 출력.
export default defineConfig({
  plugins: [react()],
  base: '/devkit/',
  build: {
    outDir: path.resolve(__dirname, '../src/main/resources/static'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/devkit/api': 'http://localhost:8087',
    },
  },
});
