import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    fileParallelism: false,
    maxWorkers: 1,
  },
});
