import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { Header } from '@/components/Header'
import { AirportInput } from '@/components/AirportInput'
import { DateRangePicker } from '@/components/DateRangePicker'
import { NotificationSurvey } from '@/components/NotificationSurvey'
import { useNotificationSurvey } from '@/hooks/useNotificationSurvey'
import type { Busca } from '@/lib/supabase'

export default function Home() {
    const [originLabel, setOriginLabel] = useState('')
    const [originIata, setOriginIata] = useState('')
    const [destLabel, setDestLabel] = useState('')
    const [destIata, setDestIata] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [dateBack, setDateBack] = useState('')
    const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('round-trip')
    const [pax, setPax] = useState(1)
    const [error, setError] = useState('')
    const [recentSearches, setRecentSearches] = useState<Busca[]>([])

    // Fullscreen overlay states
    const [overlayMounted, setOverlayMounted] = useState(false)
    const [overlayExpanded, setOverlayExpanded] = useState(false)
    const [startRect, setStartRect] = useState({ top: 0, left: 0, width: 0, height: 0 })

    const bannerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    const { user } = useAuth()
    const navigate = useNavigate()
    const { shouldShow, dismiss } = useNotificationSurvey()

    useEffect(() => {
        if (!user) return
        supabase.from('buscas').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3)
            .then(({ data }) => { if (data) setRecentSearches(data) })
    }, [user])

    const triggerOverlay = () => {
        const rect = bannerRef.current?.getBoundingClientRect()
        setStartRect({
            top: rect?.top ?? 64,
            left: rect?.left ?? 0,
            width: rect?.width ?? window.innerWidth,
            height: rect?.height ?? 480,
        })
        setOverlayMounted(true)
        // Double RAF: first paints the overlay at start position, second triggers transition
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setOverlayExpanded(true)
            videoRef.current?.play()
        }))
    }

    const resetOverlay = () => {
        setOverlayExpanded(false)
        setOverlayMounted(false)
        videoRef.current?.pause()
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        const originCode = originIata || originLabel.trim().toUpperCase()
        const destCode = destIata || destLabel.trim().toUpperCase()
        if (!originCode) return setError('Selecione a cidade ou aeroporto de origem.')
        if (!destCode) return setError('Selecione a cidade ou aeroporto de destino.')
        if (originCode.length !== 3) return setError('Selecione um aeroporto válido na origem.')
        if (destCode.length !== 3) return setError('Selecione um aeroporto válido no destino.')
        if (!dateGo) return setError('Informe a data de ida.')
        if (!user) return setError('Faça login para buscar voos.')

        triggerOverlay()

        try {
            const insertData: Record<string, unknown> = {
                user_id: user.id,
                origem: originCode,
                destino: destCode,
                data_ida: dateGo,
                passageiros: pax,
                bagagem: 'sem_bagagem',
                user_miles: {},
            }
            if (tripType === 'round-trip' && dateBack) insertData.data_volta = dateBack

            // Run DB insert and 3s minimum in parallel
            const [queryResult] = await Promise.all([
                supabase.from('buscas').insert(insertData).select().single(),
                new Promise<void>(resolve => setTimeout(resolve, 3000)),
            ])

            const { data: buscaData, error: buscaErr } = queryResult
            if (buscaErr) throw buscaErr

            const retParam = tripType === 'round-trip' && dateBack ? `&ret=${dateBack}` : ''
            navigate(`/resultados?buscaId=${buscaData.id}&orig=${originCode}&dest=${destCode}&date=${dateGo}${retParam}&pax=${pax}`)
        } catch (err: unknown) {
            resetOverlay()
            setError(err instanceof Error ? err.message : 'Erro ao buscar.')
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--snow)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Manrope, system-ui, sans-serif',
        }}>
            <style>{`
                @media (max-width: 768px) {
                    .fly-hero-banner { height: 300px !important; }
                    .fly-search-card { margin: -52px auto 0 !important; width: calc(100% - 32px) !important; padding: 20px !important; border-radius: 16px !important; }
                    .fly-search-grid { grid-template-columns: 1fr !important; }
                    .fly-search-grid > * { grid-column: 1 !important; }
                    .fly-recent-cards { flex-direction: column !important; }
                    .fly-hero-title { font-size: 24px !important; }
                    .fly-search-actions { flex-direction: column !important; }
                }
                @keyframes overlaySpinRing {
                    to { transform: rotate(360deg); }
                }
                @keyframes overlayPulseDots {
                    0%, 80%, 100% { opacity: 0.25; transform: scale(0.7); }
                    40% { opacity: 1; transform: scale(1); }
                }
            `}</style>

            <Header variant="app" />

            {/* ── FULLSCREEN SEARCH OVERLAY ──────────────────────────────── */}
            {overlayMounted && (
                <div
                    style={{
                        position: 'fixed',
                        top: overlayExpanded ? 0 : startRect.top,
                        left: overlayExpanded ? 0 : startRect.left,
                        width: overlayExpanded ? '100vw' : startRect.width,
                        height: overlayExpanded ? '100vh' : startRect.height,
                        zIndex: 9999,
                        overflow: 'hidden',
                        transition: 'top 0.65s cubic-bezier(0.4,0,0.2,1), left 0.65s cubic-bezier(0.4,0,0.2,1), width 0.65s cubic-bezier(0.4,0,0.2,1), height 0.65s cubic-bezier(0.4,0,0.2,1)',
                    }}
                >
                    {/* Video */}
                    <video
                        ref={videoRef}
                        src="/flywise-loading.mp4"
                        loop
                        muted
                        playsInline
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />

                    {/* Dark overlay + content — fades in after expansion starts */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(8, 16, 38, 0.72)',
                        backdropFilter: 'blur(2px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 24,
                        opacity: overlayExpanded ? 1 : 0,
                        transition: 'opacity 0.45s ease 0.35s',
                    }}>
                        {/* Logo */}
                        <img
                            src="/logo.png"
                            alt="FlyWise"
                            style={{
                                height: 52,
                                filter: 'brightness(0) invert(1)',
                                opacity: 0.92,
                                marginBottom: 4,
                            }}
                        />

                        {/* Spinner ring with plane icon */}
                        <div style={{ position: 'relative', width: 64, height: 64 }}>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                border: '3px solid rgba(255,255,255,0.12)',
                                borderTopColor: '#4A90E2',
                                borderRightColor: 'rgba(74,144,226,0.4)',
                                animation: 'overlaySpinRing 1s linear infinite',
                            }} />
                            <div style={{
                                position: 'absolute',
                                inset: 6,
                                borderRadius: '50%',
                                border: '1.5px solid rgba(255,255,255,0.06)',
                                borderBottomColor: 'rgba(74,144,226,0.3)',
                                animation: 'overlaySpinRing 1.8s linear infinite reverse',
                            }} />
                            <Plane
                                size={20}
                                color="#fff"
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    opacity: 0.9,
                                }}
                            />
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <p style={{
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: 18,
                                fontWeight: 600,
                                letterSpacing: '0.01em',
                                margin: '0 0 6px',
                            }}>
                                Buscando os melhores voos
                            </p>
                            <p style={{
                                color: 'rgba(255,255,255,0.45)',
                                fontSize: 14,
                                fontWeight: 400,
                                margin: 0,
                            }}>
                                Analisando preços e opções de milhas para você
                            </p>
                        </div>

                        {/* Animated dots */}
                        <div style={{ display: 'flex', gap: 8, marginTop: -8 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: '#4A90E2',
                                    animation: `overlayPulseDots 1.4s ease-in-out ${i * 0.2}s infinite`,
                                }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── HERO BANNER ────────────────────────────────────────────── */}
            <div style={{ position: 'relative' }}>
                <div
                    ref={bannerRef}
                    className="fly-hero-banner"
                    style={{
                        width: '100%',
                        height: 480,
                        backgroundImage: 'url(/aircraft-exterior.jpg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center 42%',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'flex-end',
                    }}
                >
                    {/* Gradient overlay — darkens bottom for readability */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, rgba(8,18,45,0.08) 0%, rgba(8,18,45,0.38) 50%, rgba(10,24,55,0.88) 100%)',
                    }} />

                    {/* Hero text */}
                    <div style={{
                        position: 'relative',
                        zIndex: 2,
                        width: '100%',
                        textAlign: 'center',
                        padding: '0 32px 92px',
                    }}>
                        <h1
                            className="fly-hero-title"
                            style={{
                                color: '#fff',
                                fontSize: 'clamp(26px, 3.5vw, 46px)',
                                fontWeight: 800,
                                margin: '0 0 10px',
                                lineHeight: 1.14,
                                letterSpacing: '-0.02em',
                                textShadow: '0 2px 24px rgba(0,0,0,0.4)',
                            }}
                        >
                            Voe mais longe com suas milhas
                        </h1>
                        <p style={{
                            color: 'rgba(255,255,255,0.72)',
                            fontSize: 16,
                            fontWeight: 400,
                            margin: 0,
                            letterSpacing: '0.01em',
                        }}>
                            Inteligência artificial que transforma pontos em passagens
                        </p>
                    </div>
                </div>

                {/* ── SEARCH CARD ─────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="fly-search-card"
                    style={{
                        position: 'relative',
                        margin: '-76px auto 0',
                        width: 'calc(100% - 48px)',
                        maxWidth: '880px',
                        background: '#fff',
                        borderRadius: '24px',
                        padding: '28px 32px',
                        boxShadow: '0 20px 70px rgba(14,42,85,0.20)',
                        border: '1px solid rgba(14,42,85,0.06)',
                        zIndex: 20,
                    }}
                >
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {/* Trip type toggle */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {(['round-trip', 'one-way'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTripType(t)}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: '999px',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        fontSize: '12.5px',
                                        fontWeight: 700,
                                        background: tripType === t ? '#0E2A55' : '#fff',
                                        color: tripType === t ? '#fff' : 'var(--text-muted)',
                                        border: tripType === t ? '1.5px solid #0E2A55' : '1.5px solid var(--border-light)',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {t === 'round-trip' ? '⇄ Ida e volta' : '→ Só ida'}
                                </button>
                            ))}
                        </div>

                        {/* Input grid */}
                        <div
                            className="fly-search-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: tripType === 'round-trip' ? '1fr 1fr 1fr 1fr auto' : '1fr 1fr auto auto',
                                gap: '12px',
                                alignItems: 'start',
                            }}
                        >
                            {/* Origin */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#FAFBFF', overflow: 'visible', position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Origem</label>
                                <AirportInput
                                    value={originLabel}
                                    iataCode={originIata}
                                    onChange={(label, iata) => { setOriginLabel(label); setOriginIata(iata) }}
                                    placeholder="São Paulo, GRU..."
                                    icon={<Plane size={13} color="var(--text-faint)" style={{ flexShrink: 0 }} />}
                                />
                            </div>

                            {/* Destination */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#FAFBFF', overflow: 'visible', position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Destino</label>
                                <AirportInput
                                    value={destLabel}
                                    iataCode={destIata}
                                    onChange={(label, iata) => { setDestLabel(label); setDestIata(iata) }}
                                    placeholder="Nova York, JFK..."
                                    icon={<Plane size={13} color="var(--text-faint)" style={{ transform: 'scaleX(-1)', flexShrink: 0 }} />}
                                />
                            </div>

                            {/* Dates */}
                            <div className="home-date-span" style={{ gridColumn: tripType === 'round-trip' ? 'span 2' : 'span 1' }}>
                                <DateRangePicker
                                    dateGo={dateGo}
                                    dateBack={dateBack}
                                    tripType={tripType}
                                    onDateGoChange={setDateGo}
                                    onDateBackChange={setDateBack}
                                />
                            </div>

                            {/* Passengers */}
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#FAFBFF' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Passageiros</label>
                                <select
                                    value={pax}
                                    onChange={e => setPax(Number(e.target.value))}
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontWeight: 500, color: 'var(--text-dark)', cursor: 'pointer' }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <option key={n} value={n}>{n} {n === 1 ? 'Passageiro' : 'Passageiros'}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="fly-search-actions" style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="submit"
                                disabled={overlayMounted}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    borderRadius: '12px',
                                    background: 'var(--blue-medium)',
                                    color: '#fff',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    letterSpacing: '0.02em',
                                    boxShadow: '0 8px 24px rgba(74,144,226,0.3)',
                                    border: 'none',
                                    cursor: overlayMounted ? 'not-allowed' : 'pointer',
                                    opacity: overlayMounted ? 0.7 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                Buscar Voos
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/busca-avancada')}
                                disabled={overlayMounted}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    borderRadius: '12px',
                                    background: 'transparent',
                                    color: 'var(--blue-medium)',
                                    border: '1.5px solid var(--blue-medium)',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    letterSpacing: '0.02em',
                                    cursor: overlayMounted ? 'not-allowed' : 'pointer',
                                    opacity: overlayMounted ? 0.7 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                ✨ Busca Inteligente IA
                            </button>
                        </div>

                        {error && (
                            <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', margin: 0 }}>
                                {error}
                            </p>
                        )}
                    </form>
                </motion.div>
            </div>

            {/* ── CONTENT AREA ───────────────────────────────────────────── */}
            <div style={{ flex: 1, padding: '48px 24px 80px' }}>
                {recentSearches.length > 0 && (
                    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '16px' }}>
                            Análises Recentes
                        </p>
                        <div className="fly-recent-cards" style={{ display: 'flex', gap: '16px' }}>
                            {recentSearches.map((busca, i) => (
                                <motion.div
                                    key={busca.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + i * 0.08 }}
                                    onClick={() => navigate(`/resultados?buscaId=${busca.id}`)}
                                    style={{
                                        flex: '1',
                                        minWidth: '200px',
                                        background: '#fff',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: '16px',
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(14,42,85,0.04)',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(14,42,85,0.08)' }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,42,85,0.04)' }}
                                >
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                        Análise Recente
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>{busca.origem}</span>
                                        <Plane size={14} color="var(--blue-medium)" />
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>{busca.destino}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>A partir de</p>
                                            <p style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                                                {busca.preco_minimo_brl != null
                                                    ? `R$ ${Math.round(busca.preco_minimo_brl).toLocaleString('pt-BR')}`
                                                    : 'R$ —'}
                                            </p>
                                        </div>
                                        <div style={{ width: '1px', height: '24px', background: 'var(--border-light)' }} />
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Ver em Milhas</p>
                                            <p style={{ fontWeight: 700, color: 'var(--blue-medium)' }}>→ abrir análise</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {shouldShow && <NotificationSurvey onClose={dismiss} />}
        </div>
    )
}
