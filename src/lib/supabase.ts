import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Guard: if env vars are missing, we create a dummy client that won't crash the app
// This allows the Landing page and Auth page to render while the user configures .env.local
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[FlyWise] Missing Supabase environment variables.\n' +
        'Create a .env.local file with:\n' +
        '  VITE_SUPABASE_URL=your_supabase_project_url\n' +
        '  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n'
    )
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
)

// Database types
export interface Busca {
    id: number
    user_id: string
    origem: string
    destino: string
    data_ida: string
    data_volta?: string
    passageiros: number
    bagagem: string
    banco?: string
    user_miles: Record<string, number>
    created_at: string
}

export interface ResultadoVoo {
    id: number
    busca_id: number
    user_id: string
    provider?: string
    companhia?: string
    preco_brl?: number
    preco_milhas?: number
    taxas_brl?: number
    cpm?: number
    partida?: string
    chegada?: string
    origem?: string
    destino?: string
    duracao_min?: number
    cabin_class?: string
    flight_key?: string
    estrategia_disponivel?: boolean
    moeda?: string
    segmentos?: unknown
    detalhes?: unknown
    created_at?: string
}

export interface Promocao {
    id: number
    titulo?: string
    url?: string
    valid_until?: string
    conteudo?: string
    imagens?: unknown
    created_at?: string
}

export interface Strategy {
    id?: number
    busca_id?: number
    user_id: string
    strategy_text?: string
    tags?: string[]
    economia_pct?: number
    preco_cash?: number
    preco_estrategia?: number
    created_at?: string
}
