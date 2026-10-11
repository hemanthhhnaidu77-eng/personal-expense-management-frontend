import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/personal-expense-management-frontend/',
  plugins: [react()],
  server: {
    port: 5173
  }
});
