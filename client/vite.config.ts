import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forward API and websocket traffic to the Express server so the browser sees one origin.
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split big, rarely-changing libraries into their own long-cached chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('katex')) return 'katex';
          if (id.includes('socket.io') || id.includes('engine.io')) return 'realtime';
          if (id.includes('react')) return 'react';
        },
      },
    },
  },
});
