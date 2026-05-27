import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
// 테스트 설정은 vitest.config.ts (vitest 번들 vite와 타입 충돌 회피).
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        // PWA 하드닝 (ADR-0015): 앱셸 프리캐시 + 인증 GET NetworkOnly.
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'fonts/*.woff2'],
            manifest: {
                name: 'Mini Pay',
                short_name: 'Mini Pay',
                description: '간편 송금·결제 지갑',
                lang: 'ko',
                theme_color: '#3b63f5',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                // 앱셸: JS/CSS/HTML/폰트/아이콘 프리캐시. Pretendard(~2MB) 포함 위해 상한 상향.
                globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
                maximumFileSizeToCacheInBytes: 3.5 * 1024 * 1024,
                // SPA: 네비게이션은 index.html로 폴백, 단 API는 제외.
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [/^\/api\//],
                // 인증 GET(잔액·거래내역 등 돈 데이터)은 절대 캐시 금지 — 항상 네트워크 (ADR-0015).
                runtimeCaching: [
                    {
                        urlPattern: /\/api\/v1\//,
                        handler: 'NetworkOnly',
                    },
                ],
            },
            devOptions: {
                enabled: false, // SW는 빌드/프리뷰에서만. dev(HMR)에선 비활성.
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
    },
});
