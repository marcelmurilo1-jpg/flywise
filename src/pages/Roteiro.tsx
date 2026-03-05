import { useState } from 'react'
import {
    Loader2, MapPin, RefreshCw, Lightbulb, Sunrise, Sun, Moon, Sparkles,
    BookmarkPlus, Bookmark, ChevronLeft, ChevronDown, CalendarDays, Users,
    Search, Pencil, Trash2, Plus, Check, UtensilsCrossed, Landmark, TreePine, ShoppingBag, Clock,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'

// ─── Types ────────────────────────────────────────────────────────────────────

type TravelerType = 'solo' | 'casal' | 'familia' | 'amigos'
type TravelStyle = 'Econômico' | 'Cultural' | 'Gastronômico' | 'Aventura' | 'Compras'
type Step = 'form' | 'loading' | 'result' | 'list' | 'list-loading' | 'view'
type ExtraCategory = 'gastronomia' | 'cultura' | 'natureza' | 'compras'

interface ActivityExtra {
    horario: string
    atividade: string
    local: string
    dica: string
}

interface DayPeriod {
    horario?: string
    atividade: string
    local: string
    dica: string
    extras_atividades?: ActivityExtra[]
}

interface ItineraryDay {
    dia: number
    tema: string
    manha: DayPeriod
    tarde: DayPeriod
    noite: DayPeriod
}

interface ExtraItem {
    nome: string
    descricao: string
    dica: string
}

interface ItineraryExtras {
    gastronomia: ExtraItem[]
    cultura: ExtraItem[]
    natureza: ExtraItem[]
    compras: ExtraItem[]
}

interface ItineraryResult {
    titulo: string
    resumo: string
    dias: ItineraryDay[]
    dicas_gerais: string[]
    orcamento_estimado: string
    extras?: ItineraryExtras
}

interface SavedItinerary {
    id: number
    destination: string
    duration: number
    traveler_type: TravelerType
    travel_style: TravelStyle[]
    result: ItineraryResult
    is_saved: boolean
    created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRAVELER_OPTIONS: { value: TravelerType; label: string }[] = [
    { value: 'solo', label: 'Solo' },
    { value: 'casal', label: 'Casal' },
    { value: 'familia', label: 'Família' },
    { value: 'amigos', label: 'Amigos' },
]

const STYLE_OPTIONS: TravelStyle[] = ['Econômico', 'Cultural', 'Gastronômico', 'Aventura', 'Compras']

const PERIOD_CONFIG = [
    { key: 'manha' as const, label: 'Manhã', Icon: Sunrise, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    { key: 'tarde' as const, label: 'Tarde', Icon: Sun, color: '#4A90E2', bg: 'rgba(74,144,226,0.08)' },
    { key: 'noite' as const, label: 'Noite', Icon: Moon, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
]

const EXTRA_TABS: { key: ExtraCategory; label: string; Icon: React.ElementType }[] = [
    { key: 'gastronomia', label: 'Gastronomia', Icon: UtensilsCrossed },
    { key: 'cultura', label: 'Cultura', Icon: Landmark },
    { key: 'natureza', label: 'Natureza', Icon: TreePine },
    { key: 'compras', label: 'Compras', Icon: ShoppingBag },
]

const BLANK_PERIOD: DayPeriod = { horario: '', atividade: '', local: '', dica: '', extras_atividades: [] }
const BLANK_EXTRA: ActivityExtra = { horario: '', atividade: '', local: '', dica: '' }
const BLANK_DAY = (dia: number): ItineraryDay => ({
    dia,
    tema: '',
    manha: { ...BLANK_PERIOD },
    tarde: { ...BLANK_PERIOD },
    noite: { ...BLANK_PERIOD },
})

// ─── Component ────────────────────────────────────────────────────────────────

export default function Roteiro() {
    const { user } = useAuth()
    const navigate = useNavigate()

    // Form state
    const [destination, setDestination] = useState('')
    const [duration, setDuration] = useState(5)
    const [travelerType, setTravelerType] = useState<TravelerType>('casal')
    const [travelStyle, setTravelStyle] = useState<TravelStyle[]>(['Cultural'])
    const [error, setError] = useState('')

    // Result state
    const [step, setStep] = useState<Step>('form')
    const [itinerary, setItinerary] = useState<ItineraryResult | null>(null)
    const [currentRowId, setCurrentRowId] = useState<number | null>(null)
    const [isSaved, setIsSaved] = useState(false)
    const [savingTrip, setSavingTrip] = useState(false)

    // Edit state
    const [isEditing, setIsEditing] = useState(false)
    const [editableItinerary, setEditableItinerary] = useState<ItineraryResult | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

    // Extras sidebar
    const [activeTab, setActiveTab] = useState<ExtraCategory>('gastronomia')

    // List state
    const [savedTrips, setSavedTrips] = useState<SavedItinerary[]>([])
    const [viewingTrip, setViewingTrip] = useState<SavedItinerary | null>(null)

    const toggleStyle = (style: TravelStyle) => {
        setTravelStyle(prev =>
            prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!destination.trim()) return setError('Informe o destino da viagem.')
        if (travelStyle.length === 0) return setError('Selecione ao menos um estilo de viagem.')
        if (!user) return setError('Faça login para gerar roteiros.')

        setStep('loading')
        setIsSaved(false)
        setIsEditing(false)

        try {
            const { data: row, error: insertErr } = await supabase
                .from('itineraries')
                .insert({
                    user_id: user.id,
                    destination: destination.trim(),
                    duration,
                    traveler_type: travelerType,
                    travel_style: travelStyle,
                })
                .select()
                .single()

            if (insertErr) throw insertErr

            setCurrentRowId(row.id)

            const { data, error: fnErr } = await supabase.functions.invoke('itinerary', {
                body: { itinerary_id: row.id },
            })

            if (fnErr) throw new Error('Erro ao gerar roteiro. Tente novamente.')

            const { result } = data
            setItinerary(result)
            setActiveTab('gastronomia')
            setStep('result')
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro inesperado.')
            setStep('form')
        }
    }

    const handleAddTrip = async () => {
        if (!currentRowId || isSaved) return
        setError('')
        setSavingTrip(true)
        const { error: saveErr } = await supabase
            .from('itineraries')
            .update({ is_saved: true })
            .eq('id', currentRowId)
        setSavingTrip(false)
        if (saveErr) {
            console.error('Erro ao salvar viagem:', saveErr)
            setError(`Erro ao salvar viagem: ${saveErr.message}`)
            return
        }
        setIsSaved(true)
    }

    const handleLoadTrips = async () => {
        setStep('list-loading')
        const { data } = await supabase
            .from('itineraries')
            .select('*')
            .eq('is_saved', true)
            .order('created_at', { ascending: false })
        setSavedTrips((data as SavedItinerary[]) ?? [])
        setStep('list')
    }

    const handleReset = () => {
        setItinerary(null)
        setDestination('')
        setDuration(5)
        setTravelerType('casal')
        setTravelStyle(['Cultural'])
        setError('')
        setCurrentRowId(null)
        setIsSaved(false)
        setIsEditing(false)
        setEditableItinerary(null)
        setSaveStatus('idle')
        setStep('form')
    }

    const handleViewTrip = (trip: SavedItinerary) => {
        setViewingTrip(trip)
        setActiveTab('gastronomia')
        setStep('view')
    }

    // ── Edit helpers ────────────────────────────────────────────────────────

    const startEditing = () => {
        setEditableItinerary(structuredClone(itinerary))
        setIsEditing(true)
        setSaveStatus('idle')
    }

    const cancelEditing = () => {
        setEditableItinerary(null)
        setIsEditing(false)
        setSaveStatus('idle')
    }

    const updateDayTema = (dayIdx: number, value: string) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            dias[dayIdx] = { ...dias[dayIdx], tema: value }
            return { ...prev, dias }
        })
    }

    const updatePeriod = (dayIdx: number, period: 'manha' | 'tarde' | 'noite', field: string, value: string) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            dias[dayIdx] = {
                ...dias[dayIdx],
                [period]: { ...dias[dayIdx][period], [field]: value },
            }
            return { ...prev, dias }
        })
    }

    const addPeriodActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite') => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const p = dias[dayIdx][period]
            dias[dayIdx] = {
                ...dias[dayIdx],
                [period]: { ...p, extras_atividades: [...(p.extras_atividades ?? []), { ...BLANK_EXTRA }] },
            }
            return { ...prev, dias }
        })
    }

    const removePeriodActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite', extraIdx: number) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const p = dias[dayIdx][period]
            dias[dayIdx] = {
                ...dias[dayIdx],
                [period]: { ...p, extras_atividades: (p.extras_atividades ?? []).filter((_, i) => i !== extraIdx) },
            }
            return { ...prev, dias }
        })
    }

    const updatePeriodActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite', extraIdx: number, field: keyof ActivityExtra, value: string) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const p = dias[dayIdx][period]
            const extras = [...(p.extras_atividades ?? [])]
            extras[extraIdx] = { ...extras[extraIdx], [field]: value }
            dias[dayIdx] = { ...dias[dayIdx], [period]: { ...p, extras_atividades: extras } }
            return { ...prev, dias }
        })
    }

    const removeDay = (dayIdx: number) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = prev.dias.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, dia: i + 1 }))
            return { ...prev, dias }
        })
    }

    const addDay = () => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            return { ...prev, dias: [...prev.dias, BLANK_DAY(prev.dias.length + 1)] }
        })
    }

    const saveEdits = async () => {
        if (!editableItinerary || !currentRowId) return
        setSaveStatus('saving')
        await supabase.from('itineraries').update({ result: editableItinerary }).eq('id', currentRowId)
        setItinerary(editableItinerary)
        setIsEditing(false)
        setEditableItinerary(null)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
    }

    const displayItinerary = isEditing ? editableItinerary : itinerary

    // ── Main layout width ────────────────────────────────────────────────────

    const isWideStep = step === 'result' || step === 'view'

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <Header variant="app" />

            <main style={{
                flex: 1, width: '100%',
                maxWidth: isWideStep ? '1200px' : '720px',
                margin: '0 auto',
                padding: '40px 24px',
                transition: 'max-width 0.3s ease',
            }}>
                <AnimatePresence mode="wait">

                    {/* ── Form ─────────────────────────────────────────── */}
                    {step === 'form' && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4 }}
                        >
                            <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--blue-pale-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Sparkles size={18} color="var(--blue-vibrant)" />
                                        </div>
                                        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>
                                            Roteiro com IA
                                        </h1>
                                    </div>
                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                                        Preencha as informações e a IA monta um roteiro personalizado para você.
                                    </p>
                                </div>
                                <button
                                    onClick={handleLoadTrips}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '10px 16px', borderRadius: '12px', flexShrink: 0,
                                        border: '1.5px solid var(--border-light)', background: '#fff',
                                        color: 'var(--text-dark)', fontSize: '13px', fontWeight: 700,
                                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                        boxShadow: '0 2px 8px rgba(14,42,85,0.05)',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-medium)'; e.currentTarget.style.color = 'var(--blue-medium)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-dark)' }}
                                >
                                    <Bookmark size={14} />
                                    Minhas Viagens
                                </button>
                            </div>

                            <div className="card" style={{ padding: '32px', borderRadius: '24px', boxShadow: '0 12px 48px rgba(14,42,85,0.08)' }}>
                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                    <div>
                                        <label style={labelStyle}>Para onde você vai?</label>
                                        <div style={{ position: 'relative' }}>
                                            <MapPin size={15} color="var(--text-faint)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                                            <input
                                                type="text"
                                                value={destination}
                                                onChange={e => setDestination(e.target.value)}
                                                placeholder="Paris, França..."
                                                style={{
                                                    width: '100%', padding: '12px 14px 12px 38px',
                                                    border: '1px solid var(--border-light)', borderRadius: '12px',
                                                    fontSize: '15px', fontWeight: 500, color: 'var(--text-dark)',
                                                    background: '#fff', fontFamily: 'inherit', outline: 'none',
                                                    transition: 'border-color 0.2s', boxSizing: 'border-box',
                                                }}
                                                onFocus={e => e.target.style.borderColor = 'var(--blue-medium)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={labelStyle}>Duração da viagem</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}>
                                                <button type="button" onClick={() => setDuration(d => Math.max(1, d - 1))} style={stepperBtn}>–</button>
                                                <span style={{ flex: 1, textAlign: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)' }}>
                                                    {duration} {duration === 1 ? 'dia' : 'dias'}
                                                </span>
                                                <button type="button" onClick={() => setDuration(d => Math.min(30, d + 1))} style={stepperBtn}>+</button>
                                            </div>
                                        </div>

                                        <div>
                                            <label style={labelStyle}>Tipo de viajante</label>
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    value={travelerType}
                                                    onChange={e => setTravelerType(e.target.value as TravelerType)}
                                                    style={{
                                                        width: '100%', padding: '0 36px 0 14px', height: '48px',
                                                        border: '1px solid var(--border-light)', borderRadius: '12px',
                                                        fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)',
                                                        background: '#fff', fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
                                                        boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none',
                                                    }}
                                                >
                                                    {TRAVELER_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={15} color="var(--text-faint)" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Estilo de viagem <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(múltipla escolha)</span></label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {STYLE_OPTIONS.map(style => {
                                                const active = travelStyle.includes(style)
                                                return (
                                                    <button
                                                        key={style}
                                                        type="button"
                                                        onClick={() => toggleStyle(style)}
                                                        style={{
                                                            padding: '8px 16px', borderRadius: '999px',
                                                            border: `1.5px solid ${active ? 'var(--blue-vibrant)' : 'var(--border-light)'}`,
                                                            background: active ? 'var(--blue-pale-mid)' : '#fff',
                                                            color: active ? 'var(--blue-vibrant)' : 'var(--text-muted)',
                                                            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                                                            fontFamily: 'inherit', transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        {style}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {error && (
                                        <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', margin: 0 }}>{error}</p>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn"
                                        style={{
                                            width: '100%', padding: '16px', borderRadius: '14px',
                                            background: 'var(--blue-medium)', color: '#fff',
                                            fontSize: '16px', fontWeight: 700, letterSpacing: '0.02em',
                                            boxShadow: '0 8px 24px rgba(74,144,226,0.3)', cursor: 'pointer',
                                        }}
                                    >
                                        ✨ Gerar Roteiro com IA
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Loading ───────────────────────────────────────── */}
                    {(step === 'loading' || step === 'list-loading') && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '20px' }}
                        >
                            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--blue-pale-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 size={28} color="var(--blue-vibrant)" className="spin" />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '6px' }}>
                                    {step === 'list-loading' ? 'Carregando viagens...' : 'Gerando seu roteiro...'}
                                </p>
                                {step === 'loading' && (
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                                        A IA está elaborando seu roteiro e sugerindo atrações.<br />Isso pode levar alguns segundos.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Result ────────────────────────────────────────── */}
                    {step === 'result' && displayItinerary && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            {/* Top bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={isEditing ? cancelEditing : handleReset}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', padding: 0, fontFamily: 'inherit' }}
                                >
                                    <ChevronLeft size={16} /> {isEditing ? 'Cancelar edição' : 'Novo roteiro'}
                                </button>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {saveStatus === 'saved' && (
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Check size={14} /> Salvo!
                                        </span>
                                    )}
                                    {isEditing ? (
                                        <button
                                            onClick={saveEdits}
                                            disabled={saveStatus === 'saving'}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '10px 18px', borderRadius: '12px',
                                                background: 'var(--blue-medium)', color: '#fff',
                                                border: 'none', fontSize: '14px', fontWeight: 700,
                                                cursor: 'pointer', fontFamily: 'inherit', opacity: saveStatus === 'saving' ? 0.7 : 1,
                                            }}
                                        >
                                            {saveStatus === 'saving' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                            Salvar alterações
                                        </button>
                                    ) : (
                                        <button
                                            onClick={startEditing}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '10px 16px', borderRadius: '12px',
                                                border: '1.5px solid var(--border-light)', background: '#fff',
                                                color: 'var(--text-dark)', fontSize: '13px', fontWeight: 700,
                                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-medium)'; e.currentTarget.style.color = 'var(--blue-medium)' }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-dark)' }}
                                        >
                                            <Pencil size={14} /> Editar roteiro
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Two-column grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: itinerary?.extras ? 'minmax(0,1fr) 320px' : '1fr', gap: '28px', alignItems: 'flex-start' }}>

                                {/* LEFT — itinerary */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                    {/* Header card */}
                                    <div style={{ background: 'linear-gradient(135deg, #0E2A55 0%, #2A60C2 100%)', borderRadius: '24px', padding: '28px 32px', color: '#fff' }}>
                                        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                                            Roteiro Personalizado
                                        </p>
                                        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.3 }}>
                                            {displayItinerary.titulo}
                                        </h2>
                                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: '0 0 20px', lineHeight: 1.6 }}>
                                            {displayItinerary.resumo}
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            <MetaBadge label={`${duration} dia${duration > 1 ? 's' : ''}`} />
                                            <MetaBadge label={TRAVELER_OPTIONS.find(o => o.value === travelerType)?.label ?? travelerType} />
                                            {travelStyle.map(s => <MetaBadge key={s} label={s} />)}
                                        </div>
                                    </div>

                                    {/* Day cards */}
                                    {displayItinerary.dias.map((day, i) => (
                                        <EditableDayCard
                                            key={i}
                                            day={day}
                                            index={i}
                                            isEditing={isEditing}
                                            onUpdateTema={v => updateDayTema(i, v)}
                                            onUpdatePeriod={(p, f, v) => updatePeriod(i, p, f, v)}
                                            onRemove={() => removeDay(i)}
                                            onAddActivity={p => addPeriodActivity(i, p)}
                                            onRemoveActivity={(p, ei) => removePeriodActivity(i, p, ei)}
                                            onUpdateActivity={(p, ei, f, v) => updatePeriodActivity(i, p, ei, f, v)}
                                        />
                                    ))}

                                    {/* Add day button in edit mode */}
                                    {isEditing && (
                                        <button
                                            onClick={addDay}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                width: '100%', padding: '14px', borderRadius: '16px',
                                                border: '2px dashed var(--border-light)', background: 'transparent',
                                                color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700,
                                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-medium)'; e.currentTarget.style.color = 'var(--blue-medium)' }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                                        >
                                            <Plus size={16} /> Adicionar dia
                                        </button>
                                    )}

                                    {/* Tips + budget */}
                                    <TipsBudgetCard itinerary={displayItinerary} delayBase={displayItinerary.dias.length} />

                                    {/* Actions */}
                                    {!isEditing && error && (
                                        <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', margin: 0 }}>{error}</p>
                                    )}
                                    {!isEditing && (
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                onClick={handleAddTrip}
                                                disabled={isSaved || savingTrip}
                                                className="btn"
                                                style={{
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '14px', borderRadius: '14px',
                                                    background: isSaved ? 'rgba(74,144,226,0.08)' : 'var(--blue-medium)',
                                                    color: isSaved ? 'var(--blue-medium)' : '#fff',
                                                    border: isSaved ? '2px solid var(--blue-medium)' : '2px solid transparent',
                                                    fontSize: '15px', fontWeight: 700, cursor: isSaved ? 'default' : 'pointer',
                                                    opacity: savingTrip ? 0.7 : 1,
                                                }}
                                            >
                                                {savingTrip ? <Loader2 size={16} className="spin" /> : isSaved ? <><Bookmark size={16} /> Viagem salva</> : <><BookmarkPlus size={16} /> Adicionar viagem</>}
                                            </button>
                                            <button
                                                onClick={handleReset}
                                                className="btn"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '14px 20px', borderRadius: '14px',
                                                    background: 'transparent', color: 'var(--text-muted)',
                                                    border: '2px solid var(--border-light)', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                                            >
                                                <RefreshCw size={16} /> Novo
                                            </button>
                                            <button
                                                onClick={() => navigate('/home')}
                                                className="btn"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '14px 20px', borderRadius: '14px',
                                                    background: 'transparent', color: 'var(--text-muted)',
                                                    border: '2px solid var(--border-light)', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                                            >
                                                <Search size={16} /> Pesquisar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT — extras sidebar */}
                                {itinerary?.extras && (
                                    <div style={{ position: 'sticky', top: '24px' }}>
                                        <ExtrasSidebar extras={itinerary.extras} activeTab={activeTab} onTabChange={setActiveTab} />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── My Trips List ─────────────────────────────────── */}
                    {step === 'list' && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button
                                    onClick={handleReset}
                                    style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid var(--border-light)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                                >
                                    <ChevronLeft size={18} color="var(--text-dark)" />
                                </button>
                                <div>
                                    <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 2px' }}>Minhas Viagens</h1>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                                        {savedTrips.length === 0 ? 'Nenhuma viagem salva ainda' : `${savedTrips.length} viagem${savedTrips.length > 1 ? 's' : ''} salva${savedTrips.length > 1 ? 's' : ''}`}
                                    </p>
                                </div>
                            </div>

                            {savedTrips.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', borderRadius: '20px', border: '1px solid var(--border-light)' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--blue-pale-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <Bookmark size={24} color="var(--blue-vibrant)" />
                                    </div>
                                    <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '8px' }}>Nenhuma viagem salva</p>
                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 24px' }}>Gere um roteiro e clique em "Adicionar viagem" para salvá-lo aqui.</p>
                                    <button onClick={handleReset} className="btn" style={{ padding: '12px 24px', borderRadius: '12px', background: 'var(--blue-medium)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                                        ✨ Gerar meu primeiro roteiro
                                    </button>
                                </div>
                            ) : (
                                savedTrips.map((trip, i) => (
                                    <motion.div
                                        key={trip.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.06 }}
                                        onClick={() => handleViewTrip(trip)}
                                        style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '20px 24px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(14,42,85,0.05)', transition: 'border-color 0.2s' }}
                                        whileHover={{ scale: 1.01 }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--blue-medium)' }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-light)' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {trip.result?.titulo ?? trip.destination}
                                                </p>
                                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {trip.result?.resumo?.split('.')[0] ?? ''}
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    <TripBadge icon={<CalendarDays size={11} />} label={`${trip.duration} dia${trip.duration > 1 ? 's' : ''}`} />
                                                    <TripBadge icon={<Users size={11} />} label={TRAVELER_OPTIONS.find(o => o.value === trip.traveler_type)?.label ?? trip.traveler_type} />
                                                    {trip.travel_style?.slice(0, 2).map(s => <TripBadge key={s} label={s} />)}
                                                </div>
                                            </div>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--blue-pale-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <MapPin size={18} color="var(--blue-vibrant)" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    )}

                    {/* ── View saved trip ───────────────────────────────── */}
                    {step === 'view' && viewingTrip?.result && (
                        <motion.div
                            key="view"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            <button
                                onClick={() => setStep('list')}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', padding: 0, fontFamily: 'inherit', marginBottom: '20px' }}
                            >
                                <ChevronLeft size={16} /> Voltar para Minhas Viagens
                            </button>

                            <div style={{ display: 'grid', gridTemplateColumns: viewingTrip.result.extras ? 'minmax(0,1fr) 320px' : '1fr', gap: '28px', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'linear-gradient(135deg, #0E2A55 0%, #2A60C2 100%)', borderRadius: '24px', padding: '28px 32px', color: '#fff' }}>
                                        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Viagem Salva</p>
                                        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.3 }}>{viewingTrip.result.titulo}</h2>
                                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: '0 0 20px', lineHeight: 1.6 }}>{viewingTrip.result.resumo}</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            <MetaBadge label={`${viewingTrip.duration} dia${viewingTrip.duration > 1 ? 's' : ''}`} />
                                            <MetaBadge label={TRAVELER_OPTIONS.find(o => o.value === viewingTrip.traveler_type)?.label ?? viewingTrip.traveler_type} />
                                            {viewingTrip.travel_style?.map(s => <MetaBadge key={s} label={s} />)}
                                        </div>
                                    </div>
                                    {viewingTrip.result.dias.map((day, i) => (
                                        <EditableDayCard key={i} day={day} index={i} isEditing={false} onUpdateTema={() => {}} onUpdatePeriod={() => {}} onRemove={() => {}} onAddActivity={() => {}} onRemoveActivity={() => {}} onUpdateActivity={() => {}} />
                                    ))}
                                    <TipsBudgetCard itinerary={viewingTrip.result} delayBase={viewingTrip.result.dias.length} />
                                </div>
                                {viewingTrip.result.extras && (
                                    <div style={{ position: 'sticky', top: '24px' }}>
                                        <ExtrasSidebar extras={viewingTrip.result.extras} activeTab={activeTab} onTabChange={setActiveTab} />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>
        </div>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EditableDayCardProps {
    day: ItineraryDay
    index: number
    isEditing: boolean
    onUpdateTema: (v: string) => void
    onUpdatePeriod: (p: 'manha' | 'tarde' | 'noite', f: string, v: string) => void
    onRemove: () => void
    onAddActivity: (p: 'manha' | 'tarde' | 'noite') => void
    onRemoveActivity: (p: 'manha' | 'tarde' | 'noite', extraIdx: number) => void
    onUpdateActivity: (p: 'manha' | 'tarde' | 'noite', extraIdx: number, f: keyof ActivityExtra, v: string) => void
}

function EditableDayCard({ day, index, isEditing, onUpdateTema, onUpdatePeriod, onRemove, onAddActivity, onRemoveActivity, onUpdateActivity }: EditableDayCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            style={{ background: '#fff', border: `1px solid ${isEditing ? 'var(--blue-medium)' : 'var(--border-light)'}`, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(14,42,85,0.05)' }}
        >
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 24px', borderBottom: '1px solid var(--border-light)', background: isEditing ? 'rgba(74,144,226,0.03)' : 'transparent' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--blue-pale-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--blue-vibrant)' }}>{day.dia}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Dia {day.dia}</p>
                    {isEditing ? (
                        <input
                            value={day.tema}
                            onChange={e => onUpdateTema(e.target.value)}
                            placeholder="Tema do dia..."
                            style={{ width: '100%', fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)', border: 'none', borderBottom: '1px solid var(--border-light)', outline: 'none', background: 'transparent', fontFamily: 'inherit', padding: '2px 0' }}
                        />
                    ) : (
                        <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>{day.tema}</p>
                    )}
                </div>
                {isEditing && (
                    <button onClick={onRemove} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <Trash2 size={14} color="#ef4444" />
                    </button>
                )}
            </div>

            {/* Periods */}
            <div style={{ padding: '4px 0' }}>
                {PERIOD_CONFIG.map(({ key, label, Icon, color, bg }) => {
                    const period = day[key]
                    return (
                        <div key={key} style={{ padding: '16px 24px', borderBottom: key !== 'noite' ? '1px solid var(--border-light)' : 'none' }}>
                            {/* Period label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={13} color={color} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                            </div>

                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {/* Main activity */}
                                    <ActivityEditBlock
                                        horario={period.horario ?? ''}
                                        atividade={period.atividade}
                                        local={period.local}
                                        dica={period.dica}
                                        isMain
                                        onChangeHorario={v => onUpdatePeriod(key, 'horario', v)}
                                        onChangeAtividade={v => onUpdatePeriod(key, 'atividade', v)}
                                        onChangeLocal={v => onUpdatePeriod(key, 'local', v)}
                                        onChangeDica={v => onUpdatePeriod(key, 'dica', v)}
                                    />

                                    {/* Extra activities */}
                                    {(period.extras_atividades ?? []).map((extra, ei) => (
                                        <ActivityEditBlock
                                            key={ei}
                                            horario={extra.horario}
                                            atividade={extra.atividade}
                                            local={extra.local}
                                            dica={extra.dica}
                                            onChangeHorario={v => onUpdateActivity(key, ei, 'horario', v)}
                                            onChangeAtividade={v => onUpdateActivity(key, ei, 'atividade', v)}
                                            onChangeLocal={v => onUpdateActivity(key, ei, 'local', v)}
                                            onChangeDica={v => onUpdateActivity(key, ei, 'dica', v)}
                                            onRemove={() => onRemoveActivity(key, ei)}
                                        />
                                    ))}

                                    {/* Add activity button */}
                                    <button
                                        onClick={() => onAddActivity(key)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '7px 12px', borderRadius: '8px',
                                            border: '1.5px dashed var(--border-light)', background: 'transparent',
                                            color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700,
                                            cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-medium)'; e.currentTarget.style.color = 'var(--blue-medium)' }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                                    >
                                        <Plus size={12} /> Adicionar atividade
                                    </button>
                                </div>
                            ) : (
                                /* View mode */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <ActivityViewBlock period={period} />
                                    {(period.extras_atividades ?? []).map((extra, ei) => (
                                        <ActivityViewBlock key={ei} period={extra} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </motion.div>
    )
}

interface ActivityEditBlockProps {
    horario: string
    atividade: string
    local: string
    dica: string
    isMain?: boolean
    onChangeHorario: (v: string) => void
    onChangeAtividade: (v: string) => void
    onChangeLocal: (v: string) => void
    onChangeDica: (v: string) => void
    onRemove?: () => void
}

function ActivityEditBlock({ horario, atividade, local, dica, isMain, onChangeHorario, onChangeAtividade, onChangeLocal, onChangeDica, onRemove }: ActivityEditBlockProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '10px', background: isMain ? 'transparent' : '#f8fafc', border: isMain ? 'none' : '1px solid var(--border-light)' }}>
            {!isMain && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Atividade extra</span>
                    {onRemove && (
                        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={13} color="#ef4444" />
                        </button>
                    )}
                </div>
            )}
            {/* Horário + atividade */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Clock size={12} color="var(--text-faint)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                        type="time"
                        value={horario}
                        onChange={e => onChangeHorario(e.target.value)}
                        style={{ paddingLeft: '26px', paddingRight: '8px', height: '34px', width: '110px', fontSize: '13px', fontWeight: 700, color: 'var(--text-dark)', border: '1px solid var(--border-light)', borderRadius: '8px', outline: 'none', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                </div>
                <textarea
                    value={atividade}
                    onChange={e => onChangeAtividade(e.target.value)}
                    placeholder="Descrição da atividade..."
                    rows={2}
                    style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', border: '1px solid var(--border-light)', borderRadius: '8px', outline: 'none', background: '#fff', fontFamily: 'inherit', padding: '7px 10px', resize: 'vertical', boxSizing: 'border-box' }}
                />
            </div>
            {/* Local + dica */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <input
                    value={local}
                    onChange={e => onChangeLocal(e.target.value)}
                    placeholder="Local..."
                    style={{ fontSize: '12px', color: 'var(--text-dark)', border: '1px solid var(--border-light)', borderRadius: '8px', outline: 'none', background: '#fff', fontFamily: 'inherit', padding: '7px 10px', boxSizing: 'border-box' }}
                />
                <input
                    value={dica}
                    onChange={e => onChangeDica(e.target.value)}
                    placeholder="Dica..."
                    style={{ fontSize: '12px', color: 'var(--text-dark)', border: '1px solid var(--border-light)', borderRadius: '8px', outline: 'none', background: '#fff', fontFamily: 'inherit', padding: '7px 10px', boxSizing: 'border-box' }}
                />
            </div>
        </div>
    )
}

function ActivityViewBlock({ period }: { period: Pick<DayPeriod, 'horario' | 'atividade' | 'local' | 'dica'> | ActivityExtra }) {
    return (
        <div>
            {'horario' in period && period.horario && (
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--blue-vibrant)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '4px', background: 'var(--blue-pale-mid)', padding: '2px 8px', borderRadius: '6px' }}>
                    <Clock size={10} /> {period.horario}
                </span>
            )}
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)', margin: '0 0 6px', lineHeight: 1.5 }}>{period.atividade}</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                {period.local && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} /> {period.local}
                    </span>
                )}
                {period.dica && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        <Lightbulb size={11} style={{ flexShrink: 0, marginTop: '1px' }} /> {period.dica}
                    </span>
                )}
            </div>
        </div>
    )
}

function ExtrasSidebar({ extras, activeTab, onTabChange }: { extras: ItineraryExtras; activeTab: ExtraCategory; onTabChange: (t: ExtraCategory) => void }) {
    const items = extras[activeTab] ?? []

    return (
        <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: '20px', boxShadow: '0 4px 16px rgba(14,42,85,0.05)' }}>
            {/* Header */}
            <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border-light)' }}>
                <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 12px' }}>
                    Mais para fazer
                </p>
                {/* Tabs — pill style, no overflow issue */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {EXTRA_TABS.map(({ key, Icon }) => {
                        const active = activeTab === key
                        return (
                            <button
                                key={key}
                                onClick={() => onTabChange(key)}
                                title={key.charAt(0).toUpperCase() + key.slice(1)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                    padding: '8px 4px', borderRadius: '10px',
                                    border: `1.5px solid ${active ? 'var(--blue-vibrant)' : 'var(--border-light)'}`,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    fontSize: '10px', fontWeight: 700,
                                    background: active ? 'var(--blue-pale-mid)' : '#fff',
                                    color: active ? 'var(--blue-vibrant)' : 'var(--text-muted)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Icon size={15} />
                                {key === 'gastronomia' ? 'Gastro' : key.charAt(0).toUpperCase() + key.slice(1)}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Items */}
            <div style={{ maxHeight: '520px', overflowY: 'auto', padding: '12px', borderRadius: '0 0 20px 20px' }}>
                {items.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma sugestão disponível.</p>
                ) : (
                    items.map((item, i) => (
                        <div
                            key={i}
                            style={{ padding: '12px', borderRadius: '12px', marginBottom: '8px', background: 'var(--snow)', border: '1px solid var(--border-light)' }}
                        >
                            <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 4px' }}>{item.nome}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-body)', margin: '0 0 6px', lineHeight: 1.5 }}>{item.descricao}</p>
                            {item.dica && (
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                    <Lightbulb size={10} style={{ flexShrink: 0, marginTop: '2px' }} /> {item.dica}
                                </p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function TipsBudgetCard({ itinerary, delayBase }: { itinerary: ItineraryResult; delayBase: number }) {
    if (!itinerary.dicas_gerais?.length && !itinerary.orcamento_estimado) return null
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delayBase * 0.06 + 0.1 }}
            style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 16px rgba(14,42,85,0.05)' }}
        >
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
                Dicas & Orçamento
            </p>
            {itinerary.dicas_gerais?.map((dica, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'var(--blue-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                        <Lightbulb size={11} color="var(--blue-medium)" />
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-body)', margin: 0, lineHeight: 1.5 }}>{dica}</p>
                </div>
            ))}
            {itinerary.orcamento_estimado && (
                <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(74,144,226,0.06)', border: '1px solid rgba(74,144,226,0.15)' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue-medium)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Orçamento estimado</p>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>{itinerary.orcamento_estimado}</p>
                </div>
            )}
        </motion.div>
    )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '8px',
}

const stepperBtn: React.CSSProperties = {
    width: '28px', height: '28px', borderRadius: '8px',
    border: '1px solid var(--border-light)', background: 'var(--snow)',
    color: 'var(--text-dark)', fontSize: '16px', fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, fontFamily: 'inherit',
}

function MetaBadge({ label }: { label: string }) {
    return (
        <span style={{ padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', fontSize: '12px', fontWeight: 600, color: '#fff' }}>
            {label}
        </span>
    )
}

function TripBadge({ icon, label }: { icon?: React.ReactNode; label: string }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', background: 'var(--blue-pale-mid)', fontSize: '11px', fontWeight: 700, color: 'var(--blue-vibrant)' }}>
            {icon}{label}
        </span>
    )
}
