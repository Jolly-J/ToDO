import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'path'
import type { Plugin } from 'vite'

const serverPort = process.env.SERVER_PORT || '3000'
const clientPort = process.env.CLIENT_PORT || '8821'
const apiTarget = `http://localhost:${serverPort}`
const releaseFile = path.resolve(__dirname, 'release.json')

interface ReleaseManifest {
  version: string
  releasedAt: string
  whatsNew: {
    enabled: boolean
    title: string
    pages: Array<{
      image: string
      title: string
      description: string
    }>
  }
}

function readReleaseManifest(): ReleaseManifest {
  return JSON.parse(fs.readFileSync(releaseFile, 'utf8')) as ReleaseManifest
}

const releaseManifest = readReleaseManifest()

function releaseManifestPlugin(): Plugin {
  return {
    name: 'taskflow-release-manifest',
    buildStart() {
      this.addWatchFile(releaseFile)
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(readReleaseManifest(), null, 2))
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(readReleaseManifest(), null, 2),
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), releaseManifestPlugin()],
  define: {
    __TASKFLOW_RELEASE__: JSON.stringify(releaseManifest),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(clientPort, 10),
    strictPort: true, // 端口被占用时报错退出，不自动切换
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/p': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
