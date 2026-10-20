import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'katex-woff2-only',
    enforce: 'pre',
    transform(source, id) {
      if (id.split('?')[0].endsWith('/katex/dist/katex.min.css')) {
        // Modern browsers need only WOFF2; omit duplicate WOFF/TTF assets.
        return source.replace(/,url\([^)]*\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g, '')
      }
    },
  }],
  base: "/LSM/",
  build: { rollupOptions: { output: { manualChunks: { katex: ['katex'] } } } },
})
