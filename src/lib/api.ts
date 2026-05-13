// Em dev: VITE_API_BASE_URL vazio → fetches relativos passam pelo proxy do Vite
// (vite.config.ts:server.proxy '/api' → localhost:3001).
// Em prod (Vercel + Railway separados): VITE_API_BASE_URL aponta pro Railway,
// então fetches viram cross-origin absolutos. CORS é liberado por app.use(cors())
// no server.js do backend.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export function apiUrl(path: string): string {
    return `${API_BASE}${path}`
}
