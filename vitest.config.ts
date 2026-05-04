import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

const alias = {
  '~~': resolve(__dirname, '.'),
  '~': resolve(__dirname, '.'),
  '@': resolve(__dirname, 'app'),
  '#imports': resolve(__dirname, '.nuxt/imports'),
}

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'server',
          fileParallelism: false,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/server/**/*.test.ts'],
        },
        resolve: { alias },
      },
      {
        plugins: [vue()],
        test: {
          name: 'app',
          environment: 'happy-dom',
          setupFiles: ['./tests/vue-setup.ts'],
          include: ['tests/app/**/*.test.ts'],
        },
        resolve: { alias },
      },
    ],
  },
  resolve: { alias },
})
