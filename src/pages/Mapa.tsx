import { useState, useEffect, useRef } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe2, Star, CheckCircle2, TrendingUp, X, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import {
  ISO_NUMERIC_TO_ALPHA2,
  ALPHA2_TO_NAME,
  ALPHA2_TO_CONTINENT,
  IATA_TO_ALPHA2,
  TOTAL_COUNTRIES,
} from '@/lib/country-utils'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

type CountryStatus = 'visited' | 'wishlist'

interface Tooltip {
  x: number
  y: number
  alpha2: string
  name: string
  status: CountryStatus | null
}

function getFill(status: CountryStatus | null, hovered: boolean) {
  if (status === 'visited') return hovered ? '#16a34a' : '#22c55e'
  if (status === 'wishlist') return hovered ? '#d97706' : '#f59e0b'
  return hovered ? '#94a3b8' : '#cbd5e1'
}

export default function Mapa() {
  const { user } = useAuth()
  const [countries, setCountries] = useState<Record<string, CountryStatus>>({})
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  // Busca países do usuário e recomendações
  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: visited }, { data: buscas }] = await Promise.all([
        supabase.from('visited_countries').select('country_code, status').eq('user_id', user!.id),
        supabase.from('buscas').select('destino').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(60),
      ])

      const map: Record<string, CountryStatus> = {}
      for (const row of visited ?? []) map[row.country_code] = row.status
      setCountries(map)

      // Recomendações: destinos buscados que ainda não foram visitados nem estão na wishlist
      const searchedCodes = [...new Set(
        (buscas ?? []).map(b => IATA_TO_ALPHA2[b.destino]).filter(Boolean)
      )]
      const recs = searchedCodes.filter(c => !map[c]).slice(0, 5)
      setRecommendations(recs)

      setLoading(false)
    }
    load()
  }, [user])

  const handleCountryClick = async (geoId: string | number, evt: React.MouseEvent) => {
    if (!user) return
    const alpha2 = ISO_NUMERIC_TO_ALPHA2[String(geoId)]
    if (!alpha2) return

    const current = countries[alpha2]
    const next: CountryStatus | null = !current ? 'visited' : current === 'visited' ? 'wishlist' : null

    // Atualização otimista
    setCountries(prev => {
      if (!next) { const { [alpha2]: _, ...rest } = prev; return rest }
      return { ...prev, [alpha2]: next }
    })

    // Atualiza tooltip inline
    setTooltip(prev => prev && prev.alpha2 === alpha2 ? { ...prev, status: next } : prev)

    // Sync Supabase
    if (!next) {
      await supabase.from('visited_countries').delete()
        .eq('user_id', user.id).eq('country_code', alpha2)
    } else {
      await supabase.from('visited_countries').upsert(
        { user_id: user.id, country_code: alpha2, status: next },
        { onConflict: 'user_id,country_code' }
      )
    }

    // Remove recomendação se marcou o país
    if (next) setRecommendations(prev => prev.filter(c => c !== alpha2))

    evt.stopPropagation()
  }

  const handleMouseEnter = (geoId: string | number, evt: React.MouseEvent) => {
    const alpha2 = ISO_NUMERIC_TO_ALPHA2[String(geoId)]
    if (!alpha2) return
    setHoveredCode(alpha2)
    const rect = mapContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      alpha2,
      name: ALPHA2_TO_NAME[alpha2] ?? alpha2,
      status: countries[alpha2] ?? null,
    })
  }

  const handleMouseLeave = () => {
    setHoveredCode(null)
    setTooltip(null)
  }

  // Stats
  const visitedList = Object.entries(countries).filter(([, s]) => s === 'visited').map(([c]) => c)
  const wishlistList = Object.entries(countries).filter(([, s]) => s === 'wishlist').map(([c]) => c)
  const visitedContinents = [...new Set(visitedList.map(c => ALPHA2_TO_CONTINENT[c]).filter(Boolean))]
  const percentage = ((visitedList.length / TOTAL_COUNTRIES) * 100).toFixed(1)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--snow, #f8fafc)', display: 'flex', flexDirection: 'column' }}>
      <Header variant="app" />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', width: '100%', flex: 1 }}>

        {/* Título */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Globe2 size={24} color="var(--primary, #0e2a55)" strokeWidth={2} />
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-dark, #0e2a55)', margin: 0 }}>
              Meu Mapa de Viagens
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
            Clique em um país para marcar como visitado. Clique novamente para adicionar à wishlist.
          </p>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { color: '#22c55e', label: 'Visitado' },
            { color: '#f59e0b', label: 'Quero ir' },
            { color: '#cbd5e1', label: 'Não visitado' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: color }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Layout principal */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'start' }}>

          {/* Mapa */}
          <div
            ref={mapContainerRef}
            style={{
              background: '#dbeafe',
              borderRadius: '16px',
              border: '1px solid #bfdbfe',
              overflow: 'hidden',
              position: 'relative',
              minHeight: '380px',
            }}
            onClick={() => setTooltip(null)}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '380px' }}>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Carregando mapa…</div>
              </div>
            ) : (
              <ComposableMap
                projectionConfig={{ scale: 145, center: [15, 10] }}
                style={{ width: '100%', height: 'auto' }}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => {
                      const alpha2 = ISO_NUMERIC_TO_ALPHA2[String(geo.id)]
                      const status = alpha2 ? (countries[alpha2] ?? null) : null
                      const hovered = alpha2 === hoveredCode
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={e => handleCountryClick(geo.id, e)}
                          onMouseEnter={e => handleMouseEnter(geo.id, e)}
                          onMouseLeave={handleMouseLeave}
                          style={{
                            default: {
                              fill: getFill(status, false),
                              stroke: '#fff',
                              strokeWidth: 0.4,
                              outline: 'none',
                              cursor: 'pointer',
                              transition: 'fill 0.15s ease',
                            },
                            hover: {
                              fill: getFill(status, true),
                              stroke: '#fff',
                              strokeWidth: 0.5,
                              outline: 'none',
                              cursor: 'pointer',
                            },
                            pressed: {
                              fill: getFill(status, true),
                              outline: 'none',
                            },
                          }}
                        />
                      )
                    })
                  }
                </Geographies>
              </ComposableMap>
            )}

            {/* Tooltip */}
            <AnimatePresence>
              {tooltip && (
                <motion.div
                  key={tooltip.alpha2}
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute',
                    left: Math.min(tooltip.x + 12, (mapContainerRef.current?.clientWidth ?? 600) - 200),
                    top: tooltip.y - 60,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    boxShadow: '0 4px 20px rgba(14,42,85,0.12)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    minWidth: '140px',
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: '13px', color: '#0e2a55', margin: '0 0 4px' }}>
                    {tooltip.name}
                  </p>
                  <p style={{ fontSize: '12px', color: tooltip.status ? (tooltip.status === 'visited' ? '#16a34a' : '#d97706') : '#94a3b8', margin: 0, fontWeight: 600 }}>
                    {tooltip.status === 'visited' ? '✓ Visitado'
                      : tooltip.status === 'wishlist' ? '★ Quero ir'
                      : 'Clique para marcar'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Stats */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={16} color="#0e2a55" />
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estatísticas</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <StatCard value={visitedList.length} label="países visitados" color="#22c55e" />
                <StatCard value={`${percentage}%`} label="do mundo" color="#3b82f6" />
                <StatCard value={visitedContinents.length} label="continentes" color="#8b5cf6" />
                <StatCard value={wishlistList.length} label="na wishlist" color="#f59e0b" />
              </div>

              {visitedContinents.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Continentes</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {visitedContinents.map(c => (
                      <span key={c} style={{ fontSize: '11px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recomendações */}
            {recommendations.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <TrendingUp size={16} color="#f59e0b" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Você já buscou</span>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', marginTop: '-8px' }}>Destinos das suas pesquisas que você ainda não visitou</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recommendations.map(code => (
                    <RecommendationItem
                      key={code}
                      code={code}
                      onAdd={(status) => {
                        setCountries(prev => ({ ...prev, [code]: status }))
                        setRecommendations(prev => prev.filter(c => c !== code))
                        supabase.from('visited_countries').upsert(
                          { user_id: user!.id, country_code: code, status },
                          { onConflict: 'user_id,country_code' }
                        )
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Wishlist */}
            {wishlistList.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Star size={16} color="#f59e0b" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quero ir</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {wishlistList.slice(0, 8).map(code => (
                    <div key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '8px', background: '#fffbeb' }}>
                      <span style={{ fontSize: '13px', color: '#0e2a55', fontWeight: 600 }}>
                        {ALPHA2_TO_NAME[code] ?? code}
                      </span>
                      <button
                        onClick={() => {
                          setCountries(prev => { const { [code]: _, ...rest } = prev; return rest })
                          supabase.from('visited_countries').delete().eq('user_id', user!.id).eq('country_code', code)
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {wishlistList.length > 8 && (
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', textAlign: 'center' }}>
                      +{wishlistList.length - 8} países
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Visitados (resumo) */}
            {visitedList.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <CheckCircle2 size={16} color="#22c55e" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visitados</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {visitedList.slice(0, 16).map(code => (
                    <span key={code} style={{
                      fontSize: '12px', background: '#f0fdf4', color: '#16a34a',
                      border: '1px solid #bbf7d0', borderRadius: '6px', padding: '3px 8px', fontWeight: 600
                    }}>
                      {ALPHA2_TO_NAME[code] ?? code}
                    </span>
                  ))}
                  {visitedList.length > 16 && (
                    <span style={{ fontSize: '12px', color: '#94a3b8', padding: '3px 8px' }}>
                      +{visitedList.length - 16}
                    </span>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Responsive mobile */}
      <style>{`
        @media (max-width: 768px) {
          .mapa-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '22px', fontWeight: 800, color, margin: '0 0 2px' }}>{value}</p>
      <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, margin: 0 }}>{label}</p>
    </div>
  )
}

function RecommendationItem({ code, onAdd }: { code: string; onAdd: (s: CountryStatus) => void }) {
  const name = ALPHA2_TO_NAME[code] ?? code
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <MapPin size={13} color="#94a3b8" />
        <span style={{ fontSize: '13px', color: '#0e2a55', fontWeight: 600 }}>{name}</span>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={() => onAdd('visited')}
          title="Marcar como visitado"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: '#16a34a', fontWeight: 700, cursor: 'pointer' }}
        >
          ✓ Visitei
        </button>
        <button
          onClick={() => onAdd('wishlist')}
          title="Adicionar à wishlist"
          style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: '#d97706', fontWeight: 700, cursor: 'pointer' }}
        >
          ★ Quero ir
        </button>
      </div>
    </div>
  )
}
