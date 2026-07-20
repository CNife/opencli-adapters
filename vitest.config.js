import { defineConfig } from 'vitest/config';

// Adapter unit tests mock the page API (see clis/gemini/*.test.js for the seam).
// Tests import '@jackwener/opencli/registry', resolved via a dev symlink to the
// globally installed opencli (node_modules/@jackwener/opencli -> ~/.local/...).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['clis/**/*.test.js'],
  },
});
