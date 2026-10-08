import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Configuración de pruebas, independiente de la configuración de Next.js.
// Por defecto el entorno es Node (dominio y lógica pura). Las pruebas de
// componentes declaran `// @vitest-environment jsdom` en su primera línea.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup/canvas.ts'],
  },
});
