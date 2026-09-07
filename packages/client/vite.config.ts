import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No dev-server proxy anymore — the backend is Lambda behind API Gateway,
// not a local Express process on the same machine. Point VITE_API_URL /
// VITE_WS_URL (see .env.example) at a deployed stage instead.
export default defineConfig({
  plugins: [react()],
})
