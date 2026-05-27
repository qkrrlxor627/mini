import { defineConfig } from 'vitest/config';
import path from 'node:path';

// vite 플러그인(react/tailwind)은 import하지 않음 — vitest 번들 vite와의
// Plugin 타입 충돌 회피. TSX는 esbuild가 tsconfig jsx 설정으로 변환.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
