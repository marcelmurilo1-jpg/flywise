import { useState, useEffect, useRef, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe2, Star, CheckCircle2, TrendingUp, MapPin, Plus, Minus, RotateCcw, X, Info } from 'lucide-react'
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
const DEFAULT_CENTER: [number, number] = [15, 10]

type CountryStatus = 'visited' | 'wishlist'

interface SelectedCard {
  alpha2: string
  name: string
  x: number
  y: number
}

interface HoverTooltip {
  alpha2: string
  name: string
  x: number
  y: number
}

function getDefaultFill(status: CountryStatus | null) {
  if (status === 'visited') return '#22c55e'
  if (status === 'wishlist') return '#f59e0b'
  return '#cbd5e1'
}

function getHoverFill(status: CountryStatus | null) {
  if (status === 'visited') return '#16a34a'
  if (status === 'wishlist') return '#d97706'
  return '#94a3b8'
}

export default function Mapa() {
  const { user } = useAuth()
  const [countries, setCountries] = useState<Record<string, CountryStatus>>({})
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null)
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

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
      const searchedCodes = [...new Set((buscas ?? []).map(b => IATA_TO_ALPHA2[b.destino]).filter(Boolean))]
      setRecommendations(searchedCodes.filter(c => !map[c]).slice(0, 5))
      setLoading(false)
    }
    load()
  }, [user])

  const applyStatus = useCallback(async (alpha2: string, status: CountryStatus | null) => {
    setCountries(prev => {
      if (!status) { const { [alpha2]: _, ...rest } = prev; return rest }
      return { ...prev, [alpha2]: status }
    })
    setSelectedCard(null)
    if (status) setRecommendations(prev => prev.filter(c => c !== alpha2))
    if (!status) {
      await supabase.from('visited_countries').delete().eq('user_id', user!.id).eq('country_code', alpha2)
    } else {
      await supabase.from('visited_countries').upsert(
        { user_id: user!.id, country_code: alpha2, status },
        { onConflict: 'user_id,country_code' }
      )
    }
  }, [user])

  const handleCountryClick = useCallback((geoId: string | number, evt: React.MouseEvent) => {
    if (isDraggingRef.current) return
    evt.stopPropagation()
    const alpha2 = ISO_NUMERIC_TO_ALPHA2[String(geoId)]
    if (!alpha2) return
    const rect = mapContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = evt.clientX - rect.left
    const y = evt.clientY - rect.top
    setHoverTooltip(null)
    setSelectedCard({ alpha2, name: ALPHA2_TO_NAME[alpha2] ?? alpha2, x, y })
  }, [])

  const handleMouseEnter = useCallback((geoId: string | number, evt: React.MouseEvent) => {
    if (selectedCard) return
    const alpha2 = ISO_NUMERIC_TO_ALPHA2[String(geoId)]
    if (!alpha2) return
    const rect = mapContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    setHoverTooltip({ alpha2, name: ALPHA2_TO_NAME[alpha2] ?? alpha2, x: evt.clientX - rect.left, y: evt.clientY - rect.top })
  }, [selectedCard])

  const handleMouseLeave = useCallback(() => setHoverTooltip(null), [])

  const visitedList = Object.entries(countries).filter(([, s]) => s === 'visited').map(([c]) => c)
  const wishlistList = Object.entries(countries).filter(([, s]) => s === 'wishlist').map(([c]) => c)
  const visitedContinents = [...new Set(visitedList.map(c => ALPHA2_TO_CONTINENT[c]).filter(Boolean))]
  const percentage = ((visitedList.length / TOTAL_COUNTRIES) * 100).toFixed(1)

  // Posição do popup card — fica dentro do container
  const getCardPosition = (x: number, y: number) => {
    const W = 210, H = 155
    const cW = mapContainerRef.current?.clientWidth ?? 600
    const cH = mapContainerRef.current?.clientHeight ?? 400
    let left = x + 16
    let top = y - H / 2
    if (left + W > cW - 8) left = x - W - 8
    if (top < 8) top = 8
    if (top + H > cH - 8) top = cH - H - 8
    return { left, top }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <Header variant="app" />

      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px 16px', width: '100%', flex: 1 }}>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Globe2 size={22} color="#0e2a55" strokeWidth={2.2} />
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0e2a55', margin: 0 }}>Meu Mapa de Viagens</h1>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Clique em qualquer país para marcar ou adicionar à wishlist. Use o scroll ou os botões para dar zoom.
            </p>
          </div>
          {/* Legenda */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {[{ color: '#22c55e', label: 'Visitado' }, { color: '#f59e0b', label: 'Quero ir' }, { color: '#cbd5e1', label: 'Não visitado' }].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Layout */}
        <div className="mapa-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '16px', alignItems: 'start' }}>

          {/* Mapa */}
          <div
            ref={mapContainerRef}
            style={{ background: '#dbeafe', borderRadius: '18px', border: '1px solid #bfdbfe', overflow: 'hidden', position: 'relative', minHeight: '480px' }}
            onClick={() => setSelectedCard(null)}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', flexDirection: 'column', gap: '10px' }}>
                <Globe2 size={32} color="#93c5fd" />
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Carregando mapa…</span>
              </div>
            ) : (
              <ComposableMap style={{ width: '100%', height: 'auto' }}>
                <ZoomableGroup
                  zoom={zoom}
                  center={center}
                  onMoveStart={() => { isDraggingRef.current = false }}
                  onMove={() => { isDraggingRef.current = true }}
                  onMoveEnd={({ zoom: z, coordinates }) => {
                    setZoom(Math.max(1, Math.min(8, z)))
                    setCenter(coordinates as [number, number])
                  }}
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map(geo => {
                        const alpha2 = ISO_NUMERIC_TO_ALPHA2[String(geo.id)]
                        const status = alpha2 ? (countries[alpha2] ?? null) : null
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={e => handleCountryClick(geo.id, e)}
                            onMouseEnter={e => handleMouseEnter(geo.id, e)}
                            onMouseLeave={handleMouseLeave}
                            style={{
                              default: { fill: getDefaultFill(status), stroke: '#fff', strokeWidth: 0.4, outline: 'none', cursor: 'pointer' },
                              hover: { fill: getHoverFill(status), stroke: '#fff', strokeWidth: 0.5, outline: 'none', cursor: 'pointer' },
                              pressed: { fill: getHoverFill(status), outline: 'none' },
                            }}
                          />
                        )
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            )}

            {/* Controles de zoom */}
            <div style={{ position: 'absolute', bottom: '14px', right: '14px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10 }}>
              {[
                { icon: <Plus size={14} />, action: () => setZoom(z => Math.min(8, +(z + 1).toFixed(1))), title: 'Aproximar' },
                { icon: <Minus size={14} />, action: () => setZoom(z => Math.max(1, +(z - 1).toFixed(1))), title: 'Afastar' },
                { icon: <RotateCcw size={13} />, action: () => { setZoom(1); setCenter(DEFAULT_CENTER) }, title: 'Resetar visão' },
              ].map(({ icon, action, title }, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); action() }}
                  title={title}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.8)',
                    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#0e2a55', boxShadow: '0 2px 8px rgba(14,42,85,0.1)',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>

            {/* Nível de zoom */}
            <div style={{ position: 'absolute', bottom: '14px', left: '14px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', color: '#64748b', fontWeight: 600, border: '1px solid rgba(255,255,255,0.8)' }}>
              {zoom.toFixed(1)}×
            </div>

            {/* Tooltip de hover */}
            <AnimatePresence>
              {hoverTooltip && !selectedCard && (
                <motion.div
                  key={hoverTooltip.alpha2 + '-hover'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    position: 'absolute',
                    left: Math.min(hoverTooltip.x + 12, (mapContainerRef.current?.clientWidth ?? 600) - 160),
                    top: hoverTooltip.y - 44,
                    background: 'rgba(15,30,60,0.88)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    pointerEvents: 'none',
                    zIndex: 8,
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: '12px', color: '#fff', margin: '0 0 2px' }}>{hoverTooltip.name}</p>
                  <p style={{ fontSize: '11px', margin: 0, color: countries[hoverTooltip.alpha2] === 'visited' ? '#86efac' : countries[hoverTooltip.alpha2] === 'wishlist' ? '#fcd34d' : '#94a3b8', fontWeight: 500 }}>
                    {countries[hoverTooltip.alpha2] === 'visited' ? '✓ Visitado' : countries[hoverTooltip.alpha2] === 'wishlist' ? '★ Quero ir' : 'Clique para marcar'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Popup de ação ao clicar num país */}
            <AnimatePresence>
              {selectedCard && (() => {
                const { left, top } = getCardPosition(selectedCard.x, selectedCard.y)
                const status = countries[selectedCard.alpha2] ?? null
                const continent = ALPHA2_TO_CONTINENT[selectedCard.alpha2]
                return (
                  <motion.div
                    key={selectedCard.alpha2 + '-card'}
                    initial={{ opacity: 0, scale: 0.92, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.15 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', left, top, width: '210px',
                      background: '#fff', borderRadius: '14px',
                      boxShadow: '0 8px 32px rgba(14,42,85,0.18)',
                      border: '1px solid #e2e8f0', zIndex: 20, overflow: 'hidden',
                    }}
                  >
                    {/* Header do card */}
                    <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '14px', color: '#0e2a55', margin: '0 0 2px' }}>{selectedCard.name}</p>
                        {continent && <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>{continent}</p>}
                        {status && (
                          <span style={{
                            display: 'inline-block', marginTop: '4px',
                            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                            background: status === 'visited' ? '#f0fdf4' : '#fffbeb',
                            color: status === 'visited' ? '#16a34a' : '#d97706',
                            border: `1px solid ${status === 'visited' ? '#bbf7d0' : '#fde68a'}`,
                          }}>
                            {status === 'visited' ? '✓ Visitado' : '★ Quero ir'}
                          </span>
                        )}
                      </div>
                      <button onClick={() => setSelectedCard(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0', flexShrink: 0 }}>
                        <X size={15} />
                      </button>
                    </div>
                    {/* Ações */}
                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {status !== 'visited' && (
                        <button
                          onClick={() => applyStatus(selectedCard.alpha2, 'visited')}
                          style={{ width: '100%', padding: '8px', borderRadius: '9px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <CheckCircle2 size={14} /> Já visitei!
                        </button>
                      )}
                      {status !== 'wishlist' && (
                        <button
                          onClick={() => applyStatus(selectedCard.alpha2, 'wishlist')}
                          style={{ width: '100%', padding: '8px', borderRadius: '9px', border: '1px solid #fde68a', background: '#fffbeb', color: '#b45309', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Star size={14} /> Quero ir
                        </button>
                      )}
                      {status && (
                        <button
                          onClick={() => applyStatus(selectedCard.alpha2, null)}
                          style={{ width: '100%', padding: '7px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#94a3b8', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                        >
                          Remover marcação
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Estatísticas */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                <TrendingUp size={15} color="#0e2a55" />
                <span style={{ fontWeight: 700, fontSize: '12px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suas estatísticas</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <StatRow icon="🌍" value={visitedList.length} label="países visitados" color="#22c55e" />
                <StatRow icon="📊" value={`${percentage}%`} label="do mundo explorado" color="#3b82f6" />
                <StatRow icon="🗺️" value={visitedContinents.length} label={`de 7 continentes`} color="#8b5cf6" />
                <StatRow icon="⭐" value={wishlistList.length} label="países na wishlist" color="#f59e0b" />
              </div>
              {visitedContinents.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {visitedContinents.map(c => (
                      <span key={c} style={{ fontSize: '10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 7px', fontWeight: 600 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Como usar */}
            <div style={{ background: '#eff6ff', borderRadius: '16px', border: '1px solid #bfdbfe', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                <Info size={14} color="#2563eb" />
                <span style={{ fontWeight: 700, fontSize: '12px', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Como usar</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {[
                  { icon: '👆', text: 'Clique em um país para ver as opções' },
                  { icon: '✅', text: '"Já visitei" marca o país em verde' },
                  { icon: '⭐', text: '"Quero ir" adiciona à sua wishlist em amarelo' },
                  { icon: '🔍', text: 'Scroll ou botões +/– para dar zoom' },
                  { icon: '✋', text: 'Arraste o mapa para navegar' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '13px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recomendações */}
            {recommendations.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                  <MapPin size={14} color="#f59e0b" />
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Você já buscou</span>
                </div>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 12px', lineHeight: 1.4 }}>Destinos das suas pesquisas ainda não marcados</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recommendations.map(code => (
                    <RecommendationItem key={code} code={code} onAdd={status => {
                      setCountries(prev => ({ ...prev, [code]: status }))
                      setRecommendations(prev => prev.filter(c => c !== code))
                      supabase.from('visited_countries').upsert({ user_id: user!.id, country_code: code, status }, { onConflict: 'user_id,country_code' })
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Wishlist */}
            {wishlistList.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wishlist ({wishlistList.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {wishlistList.slice(0, 7).map(code => (
                    <div key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '9px', background: '#fffbeb', border: '1px solid #fef3c7' }}>
                      <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>{ALPHA2_TO_NAME[code] ?? code}</span>
                      <button
                        onClick={() => {
                          setCountries(prev => { const { [code]: _, ...rest } = prev; return rest })
                          supabase.from('visited_countries').delete().eq('user_id', user!.id).eq('country_code', code)
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d97706', padding: '2px', display: 'flex' }}
                        title="Remover da wishlist"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {wishlistList.length > 7 && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0', textAlign: 'center' }}>+{wishlistList.length - 7} países</p>
                  )}
                </div>
              </div>
            )}

            {/* Visitados */}
            {visitedList.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
                  <CheckCircle2 size={14} color="#22c55e" />
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#0e2a55', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Visitados ({visitedList.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {visitedList.slice(0, 18).map(code => (
                    <span key={code} style={{ fontSize: '11px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 7px', fontWeight: 600 }}>
                      {ALPHA2_TO_NAME[code] ?? code}
                    </span>
                  ))}
                  {visitedList.length > 18 && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', padding: '2px 7px' }}>+{visitedList.length - 18}</span>
                  )}
                </div>
              </div>
            )}

            {/* Estado vazio */}
            {visitedList.length === 0 && wishlistList.length === 0 && !loading && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px 18px', textAlign: 'center', boxShadow: '0 2px 8px rgba(14,42,85,0.05)' }}>
                <Globe2 size={32} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                <p style={{ fontWeight: 700, color: '#0e2a55', fontSize: '14px', margin: '0 0 6px' }}>Seu mapa está vazio</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>Clique nos países que você já visitou ou quer visitar para começar a preencher seu mapa!</p>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .mapa-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function StatRow({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f8fafc', borderRadius: '9px' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <span style={{ fontSize: '18px', fontWeight: 800, color, minWidth: '36px' }}>{value}</span>
      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function RecommendationItem({ code, onAdd }: { code: string; onAdd: (s: CountryStatus) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '9px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <MapPin size={12} color="#94a3b8" />
        <span style={{ fontSize: '12px', color: '#0e2a55', fontWeight: 600 }}>{ALPHA2_TO_NAME[code] ?? code}</span>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => onAdd('visited')} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '5px', padding: '3px 7px', fontSize: '10px', color: '#15803d', fontWeight: 700, cursor: 'pointer' }}>✓</button>
        <button onClick={() => onAdd('wishlist')} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '5px', padding: '3px 7px', fontSize: '10px', color: '#b45309', fontWeight: 700, cursor: 'pointer' }}>★</button>
      </div>
    </div>
  )
}
