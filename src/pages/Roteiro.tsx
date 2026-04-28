import { useState, useEffect, useMemo } from 'react'
import {
    Loader2, MapPin, RefreshCw, Lightbulb, Sunrise, Sun, Moon, Sparkles,
    BookmarkPlus, Bookmark, ChevronLeft, ChevronDown, CalendarDays, Users,
    Search, Pencil, Trash2, Plus, Check, UtensilsCrossed, Landmark, TreePine, ShoppingBag, Clock,
    Maximize2, X, FileDown, Globe, Star, AlertTriangle, CalendarCheck,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import { Header } from '@/components/Header'

// ─── Types ────────────────────────────────────────────────────────────────────

type TravelerType = 'solo' | 'casal' | 'familia' | 'amigos'
type TravelStyle = 'Econômico' | 'Cultural' | 'Gastronômico' | 'Aventura' | 'Compras'
type Step = 'form' | 'loading' | 'result' | 'list' | 'list-loading' | 'view'
type ExtraCategory = 'gastronomia' | 'cultura' | 'natureza' | 'compras'

interface Activity {
    horario: string
    atividade: string
    local: string
    dica: string
    fonte?: string
    popularidade?: number
    melhor_epoca?: string
    evitar?: string
    lat?: number
    lng?: number
}

interface DayPeriod {
    atividades: Activity[]
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
    fonte?: string
    popularidade?: number
    lat?: number
    lng?: number
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


const BLANK_ACTIVITY: Activity = { horario: '', atividade: '', local: '', dica: '' }

// Normaliza um período para sempre retornar um array de atividades.
// Suporta tanto o formato novo ({ atividades: [...] }) quanto o formato antigo (estrutura plana).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePeriod(period: any): Activity[] {
    if (!period) return []
    if (Array.isArray(period.atividades)) return period.atividades
    // Formato antigo: campos diretos no período
    const acts: Activity[] = []
    if (period.atividade || period.local) {
        acts.push({ horario: period.horario ?? '', atividade: period.atividade ?? '', local: period.local ?? '', dica: period.dica ?? '', lat: period.lat, lng: period.lng })
    }
    if (Array.isArray(period.extras_atividades)) {
        for (const e of period.extras_atividades) {
            acts.push({ horario: e.horario ?? '', atividade: e.atividade ?? '', local: e.local ?? '', dica: e.dica ?? '' })
        }
    }
    return acts
}
const BLANK_DAY = (dia: number): ItineraryDay => ({
    dia,
    tema: '',
    manha: { atividades: [{ ...BLANK_ACTIVITY }] },
    tarde: { atividades: [{ ...BLANK_ACTIVITY }] },
    noite: { atividades: [{ ...BLANK_ACTIVITY }] },
})

// ─── KML Generation (Google My Maps) ─────────────────────────────────────────

function escapeXml(str: string): string {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

// Google Maps numbered paddle icons (day 1 → "1.png", ..., day 10 → "10.png")
const KML_DAY_ICONS = Array.from({ length: 10 }, (_, i) =>
    `http://maps.google.com/mapfiles/kml/paddle/${i + 1}.png`
)
const KML_EXTRAS_ICON = 'http://maps.google.com/mapfiles/kml/paddle/wht-stars.png'

const KML_PERIOD_PREFIX: Record<string, string> = {
    manha: '☀️ Manhã',
    tarde: '🌤 Tarde',
    noite: '🌙 Noite',
}

function generateKML(itinerary: ItineraryResult, destination: string): string {
    // One style per day
    const styles = itinerary.dias.map((_, i) => {
        const icon = KML_DAY_ICONS[i] ?? 'http://maps.google.com/mapfiles/kml/paddle/wht-blank.png'
        return `  <Style id="day${i + 1}">
    <IconStyle><scale>1.1</scale><Icon><href>${icon}</href></Icon></IconStyle>
  </Style>`
    }).join('\n')

    // Day folders
    const dayFolders = itinerary.dias.map((day, dayIdx) => {
        const placemarks: string[] = []
        for (const { key } of PERIOD_CONFIG) {
            const activities = normalizePeriod(day[key])
            for (const act of activities) {
                if (!act.local) continue
                const descLines = [
                    `${KML_PERIOD_PREFIX[key] ?? key}${act.horario ? ` — ${act.horario}` : ''}`,
                    act.atividade || '',
                    act.dica ? `💡 Dica: ${act.dica}` : '',
                ].filter(Boolean).join('\n')
                const pointTag = act.lat != null && act.lng != null
                    ? `\n    <Point><coordinates>${act.lng},${act.lat},0</coordinates></Point>`
                    : ''
                placemarks.push(
                    `  <Placemark>\n    <name>${escapeXml(act.local)}</name>\n    <description>${escapeXml(descLines)}</description>\n    <styleUrl>#day${dayIdx + 1}</styleUrl>${pointTag}\n  </Placemark>`
                )
            }
        }
        if (placemarks.length === 0) return null
        return `<Folder>\n  <name>Dia ${day.dia} — ${escapeXml(day.tema)}</name>\n${placemarks.join('\n')}\n</Folder>`
    }).filter(Boolean)

    // Extras folders
    const extraFolders: string[] = []
    if (itinerary.extras) {
        const EXTRA_LABELS: Record<ExtraCategory, string> = {
            gastronomia: '🍽 Gastronomia',
            cultura: '🏛 Cultura',
            natureza: '🌿 Natureza',
            compras: '🛍 Compras',
        }
        for (const cat of ['gastronomia', 'cultura', 'natureza', 'compras'] as ExtraCategory[]) {
            const items = itinerary.extras[cat] ?? []
            if (items.length === 0) continue
            const placemarks = items.map(item => {
                const desc = [item.descricao, item.dica ? `💡 ${item.dica}` : ''].filter(Boolean).join('\n')
                const pointTag = item.lat != null && item.lng != null
                    ? `\n    <Point><coordinates>${item.lng},${item.lat},0</coordinates></Point>`
                    : ''
                return `  <Placemark>\n    <name>${escapeXml(item.nome)}</name>\n    <description>${escapeXml(desc)}</description>\n    <styleUrl>#extras</styleUrl>${pointTag}\n  </Placemark>`
            })
            extraFolders.push(
                `<Folder>\n  <name>${EXTRA_LABELS[cat]}</name>\n${placemarks.join('\n')}\n</Folder>`
            )
        }
    }

    const allFolders = [...dayFolders, ...extraFolders].join('\n')
    const title = `Roteiro ${destination} — ${itinerary.dias.length} dia${itinerary.dias.length > 1 ? 's' : ''}`

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXml(itinerary.titulo || title)}</name>
  <description>${escapeXml(itinerary.resumo || '')} — Gerado por FlyWise</description>
${styles}
  <Style id="extras">
    <IconStyle><Icon><href>${KML_EXTRAS_ICON}</href></Icon></IconStyle>
  </Style>
${allFolders}
</Document>
</kml>`
}

function downloadKML(itinerary: ItineraryResult, destination: string) {
    const kml = generateKML(itinerary, destination)
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `roteiro-${destination.toLowerCase().replace(/[^a-z0-9]/g, '-')}.kml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 300)
}

// ─── My Maps Modal ────────────────────────────────────────────────────────────

function MyMapsModal({ fileName, onClose }: { fileName: string; onClose: () => void }) {
    const steps = [
        {
            num: 1,
            title: 'Abra o Google My Maps',
            desc: 'Clique no botão abaixo para abrir o My Maps em uma nova aba.',
            action: { label: 'Abrir Google My Maps', href: 'https://mymaps.google.com' },
        },
        {
            num: 2,
            title: 'Crie um novo mapa',
            desc: 'Na tela inicial do My Maps, clique em "+ Criar novo mapa".',
        },
        {
            num: 3,
            title: 'Importe o arquivo KML',
            desc: `Clique em "Importar" na camada e selecione o arquivo "${fileName}" que acabou de ser baixado.`,
        },
        {
            num: 4,
            title: 'Pronto! Explore seu roteiro',
            desc: 'Todos os locais aparecerão no mapa organizados por dia, com pinos numerados. Você pode editar, compartilhar e navegar offline.',
        },
    ]

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(14,42,85,0.55)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.93, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: '#fff', borderRadius: '24px',
                        padding: '32px', width: '100%', maxWidth: '480px',
                        boxShadow: '0 24px 64px rgba(14,42,85,0.18)',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '12px',
                                background: 'rgba(52,168,83,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Globe size={22} color="#34A853" />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#34A853', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                                    Google Maps
                                </p>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', margin: 0, lineHeight: 1.2 }}>
                                    Como importar seu roteiro
                                </h3>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#A0AECB', padding: '4px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center',
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* KML downloaded badge */}
                    <div style={{
                        background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.25)',
                        borderRadius: '12px', padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px',
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34A853', flexShrink: 0 }} />
                        <p style={{ fontSize: '13px', color: '#1a7336', fontWeight: 600, margin: 0 }}>
                            Arquivo <strong>{fileName}</strong> baixado com sucesso!
                        </p>
                    </div>

                    {/* Steps */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
                        {steps.map((step, i) => (
                            <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                                    background: '#0E2A55', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '13px', fontWeight: 800,
                                }}>
                                    {step.num}
                                </div>
                                <div style={{ flex: 1, paddingTop: '4px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#0E2A55', margin: '0 0 3px' }}>
                                        {step.title}
                                    </p>
                                    <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0, lineHeight: 1.5 }}>
                                        {step.desc}
                                    </p>
                                    {step.action && (
                                        <a
                                            href={step.action.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                marginTop: '8px', padding: '8px 14px', borderRadius: '10px',
                                                background: '#34A853', color: '#fff',
                                                fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                                            }}
                                        >
                                            <Globe size={13} /> {step.action.label}
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            width: '100%', padding: '13px', borderRadius: '14px',
                            background: '#0E2A55', color: '#fff', border: 'none',
                            fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                        }}
                    >
                        Entendido
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Roteiro() {
    const { user, session } = useAuth()
    const navigate = useNavigate()
    const { canGenerateRoteiro, roteiroLimit, plan: userPlan, refresh: refreshPlan } = usePlan()

    // Form state
    const [destination, setDestination] = useState('')
    const [duration, setDuration] = useState(5)
    const [travelerType, setTravelerType] = useState<TravelerType>('casal')
    const [travelStyle, setTravelStyle] = useState<TravelStyle[]>(['Cultural'])
    const [budget, setBudget] = useState<1 | 2 | 3 | 4>(2)
    const [bairroHospedagem, setBairroHospedagem] = useState('')
    const [contextEspecial, setContextEspecial] = useState('')
    const [error, setError] = useState('')

    // Regenerate single day
    const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null)

    // Result state
    const [step, setStep] = useState<Step>('form')
    const [genProgress, setGenProgress] = useState(0)
    const [itinerary, setItinerary] = useState<ItineraryResult | null>(null)
    const [currentRowId, setCurrentRowId] = useState<number | null>(null)
    const [isSaved, setIsSaved] = useState(false)
    const [savingTrip, setSavingTrip] = useState(false)
    const [exportingPDF, setExportingPDF] = useState(false)
    const [showMyMapsModal, setShowMyMapsModal] = useState(false)
    const [kmlFileName, setKmlFileName] = useState('')

    // Edit state — result step
    const [isEditing, setIsEditing] = useState(false)
    const [editableItinerary, setEditableItinerary] = useState<ItineraryResult | null>(null)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

    // Edit state — view step (saved trips)
    const [isViewEditing, setIsViewEditing] = useState(false)
    const [editableViewItinerary, setEditableViewItinerary] = useState<ItineraryResult | null>(null)
    const [viewSaveStatus, setViewSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

    // Extras sidebar
    const [activeTab, setActiveTab] = useState<ExtraCategory>('gastronomia')

    // Collapsed days state (index 0 = open, rest = closed by default)
    const [collapsedDays, setCollapsedDays] = useState<boolean[]>([])
    const [viewCollapsedDays, setViewCollapsedDays] = useState<boolean[]>([])

    const toggleDay = (i: number) => setCollapsedDays(prev => prev.map((c, idx) => idx === i ? !c : c))
    const expandDay = (i: number) => setCollapsedDays(prev => prev.map((c, idx) => idx === i ? false : c))
    const toggleViewDay = (i: number) => setViewCollapsedDays(prev => prev.map((c, idx) => idx === i ? !c : c))
    const expandViewDay = (i: number) => setViewCollapsedDays(prev => prev.map((c, idx) => idx === i ? false : c))

    // List state
    const [savedTrips, setSavedTrips] = useState<SavedItinerary[]>([])
    const [viewingTrip, setViewingTrip] = useState<SavedItinerary | null>(null)

    const toggleStyle = (style: TravelStyle) => {
        setTravelStyle(prev =>
            prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
        )
    }

    // Animate progress bar while generating (ease-out, caps at 90% until result arrives)
    useEffect(() => {
        if (step !== 'loading') {
            setGenProgress(0)
            return
        }
        setGenProgress(0)
        const start = Date.now()
        const total = 55000
        const id = setInterval(() => {
            const t = Math.min((Date.now() - start) / total, 1)
            setGenProgress(Math.min(Math.round((1 - Math.pow(1 - t, 2.5)) * 100), 90))
        }, 300)
        return () => clearInterval(id)
    }, [step])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!destination.trim()) return setError('Informe o destino da viagem.')
        if (travelStyle.length === 0) return setError('Selecione ao menos um estilo de viagem.')
        if (!user) return setError('Faça login para gerar roteiros.')
        if (!canGenerateRoteiro) {
            return setError(
                userPlan === 'free'
                    ? 'Roteiros não estão disponíveis no plano gratuito. Assine um plano para desbloquear.'
                    : `Limite de ${roteiroLimit} roteiro(s) mensal atingido. Faça upgrade ou aguarde o próximo ciclo.`
            )
        }

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
                    budget,
                })
                .select()
                .single()

            if (insertErr) throw insertErr

            setCurrentRowId(row.id)

            // JWT acquisition — same 3-tier strategy as StrategyPanel:
            // 1. session from AuthContext (kept fresh by onAuthStateChange, never stale)
            // 2. Force server-side refresh if context session is null/expired
            // 3. Throw if still missing — user must re-login
            // NEVER uses the anon key (sb_publishable_...) as Bearer — it is not a JWT.
            let accessToken: string | null = session?.access_token ?? null
            if (!accessToken) {
                const { data: refreshData } = await supabase.auth.refreshSession()
                accessToken = refreshData.session?.access_token ?? null
            }
            if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.')

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

            const fnResponse = await fetch(`${supabaseUrl}/functions/v1/itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': anonKey,
                },
                body: JSON.stringify({
                    itinerary_id: row.id,
                    bairro_hospedagem: bairroHospedagem.trim() || undefined,
                    context_especial: contextEspecial.trim() || undefined,
                }),
            })

            if (!fnResponse.ok) {
                const errText = await fnResponse.text().catch(() => '')
                console.error('[Roteiro] HTTP error:', fnResponse.status, errText)
                throw new Error(fnResponse.status === 401
                    ? 'Sessão inválida. Faça logout e login novamente.'
                    : 'Erro ao gerar roteiro. Tente novamente.')
            }

            const data = await fnResponse.json()
            if (data?.error) throw new Error(data.error)

            const { result } = data
            setItinerary(result)
            setActiveTab('gastronomia')
            setCollapsedDays((result.dias ?? []).map((_: unknown, i: number) => i !== 0))
            refreshPlan()
            setGenProgress(100)
            setTimeout(() => setStep('result'), 400)
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
        setBairroHospedagem('')
        setContextEspecial('')
        setError('')
        setCurrentRowId(null)
        setIsSaved(false)
        setIsEditing(false)
        setEditableItinerary(null)
        setSaveStatus('idle')
        setCollapsedDays([])
        setRegeneratingDay(null)
        setStep('form')
    }

    const triggerPDFDownload = async (itineraryData: ItineraryResult, dest: string, dur: number, traveler: string, styles: string[]) => {
        setExportingPDF(true)
        setError('')
        try {
            const { generateRoteiroPDF } = await import('@/components/RoteiroPDF')
            const fileName = `roteiro-${dest.toLowerCase().replace(/\s+/g, '-')}.pdf`
            const blob = await generateRoteiroPDF({
                itinerary: itineraryData,
                destination: dest,
                duration: dur,
                travelerType: traveler,
                travelStyle: styles,
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            setTimeout(() => {
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }, 200)
        } catch (err) {
            console.error('Erro ao exportar PDF:', err)
            setError(`Erro ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setExportingPDF(false)
        }
    }

    const handleExportPDF = () => {
        const data = editableItinerary ?? itinerary
        if (!data) return
        triggerPDFDownload(data, destination, duration, travelerType, travelStyle)
    }

    const handleExportViewPDF = () => {
        if (!viewingTrip) return
        triggerPDFDownload(
            viewingTrip.result,
            viewingTrip.destination,
            viewingTrip.duration,
            viewingTrip.traveler_type,
            viewingTrip.travel_style,
        )
    }

    const handleExportMyMapsResult = () => {
        const data = editableItinerary ?? itinerary
        if (!data) return
        const fileName = `roteiro-${destination.toLowerCase().replace(/[^a-z0-9]/g, '-')}.kml`
        downloadKML(data, destination)
        setKmlFileName(fileName)
        setShowMyMapsModal(true)
    }

    const handleExportMyMapsView = () => {
        if (!viewingTrip) return
        const fileName = `roteiro-${viewingTrip.destination.toLowerCase().replace(/[^a-z0-9]/g, '-')}.kml`
        downloadKML(viewingTrip.result, viewingTrip.destination)
        setKmlFileName(fileName)
        setShowMyMapsModal(true)
    }

    const handleViewTrip = (trip: SavedItinerary) => {
        setViewingTrip(trip)
        setActiveTab('gastronomia')
        setViewCollapsedDays((trip.result.dias ?? []).map((_, i) => i !== 0))
        setIsViewEditing(false)
        setEditableViewItinerary(null)
        setViewSaveStatus('idle')
        setStep('view')
    }

    // ── Edit helpers ────────────────────────────────────────────────────────

    const startEditing = () => {
        if (!itinerary) return
        const cloned = structuredClone(itinerary)
        // Normaliza para o formato novo (atividades[]) antes de editar
        for (const day of cloned.dias) {
            for (const key of ['manha', 'tarde', 'noite'] as const) {
                day[key] = { atividades: normalizePeriod(day[key]) }
            }
        }
        setEditableItinerary(cloned)
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

    const setActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite', actIdx: number, field: keyof Activity, value: string) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const atividades = [...normalizePeriod(dias[dayIdx][period])]
            atividades[actIdx] = { ...atividades[actIdx], [field]: value }
            dias[dayIdx] = { ...dias[dayIdx], [period]: { atividades } }
            return { ...prev, dias }
        })
    }

    const addActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite') => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const atividades = normalizePeriod(dias[dayIdx][period])
            dias[dayIdx] = { ...dias[dayIdx], [period]: { atividades: [...atividades, { ...BLANK_ACTIVITY }] } }
            return { ...prev, dias }
        })
    }

    const removeActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite', actIdx: number) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const atividades = normalizePeriod(dias[dayIdx][period])
            dias[dayIdx] = { ...dias[dayIdx], [period]: { atividades: atividades.filter((_, i) => i !== actIdx) } }
            return { ...prev, dias }
        })
    }

    const removeDay = (dayIdx: number) => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            const dias = prev.dias.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, dia: i + 1 }))
            return { ...prev, dias }
        })
        setCollapsedDays(prev => prev.filter((_, i) => i !== dayIdx))
    }

    const addDay = () => {
        setEditableItinerary(prev => {
            if (!prev) return prev
            return { ...prev, dias: [...prev.dias, BLANK_DAY(prev.dias.length + 1)] }
        })
        setCollapsedDays(prev => [...prev, false])
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

    const handleRegenerateDay = async (dayIdx: number) => {
        if (!itinerary || !currentRowId || regeneratingDay !== null) return
        setRegeneratingDay(dayIdx)
        setError('')
        try {
            let accessToken: string | null = session?.access_token ?? null
            if (!accessToken) {
                const { data: refreshData } = await supabase.auth.refreshSession()
                accessToken = refreshData.session?.access_token ?? null
            }
            if (!accessToken) throw new Error('Sessão expirada.')

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

            const fnResponse = await fetch(`${supabaseUrl}/functions/v1/itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': anonKey,
                },
                body: JSON.stringify({
                    itinerary_id: currentRowId,
                    day_to_regenerate: dayIdx + 1,
                    bairro_hospedagem: bairroHospedagem.trim() || undefined,
                    context_especial: contextEspecial.trim() || undefined,
                }),
            })

            const data = await fnResponse.json()
            if (data?.error) throw new Error(data.error)

            // Substitui apenas o dia regenerado
            const newDay: ItineraryDay = data.day
            setItinerary(prev => {
                if (!prev) return prev
                const dias = [...prev.dias]
                dias[dayIdx] = { ...newDay, dia: dayIdx + 1 }
                return { ...prev, dias }
            })
            // Expande o dia regenerado
            setCollapsedDays(prev => prev.map((c, i) => i === dayIdx ? false : c))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao refazer o dia.')
        } finally {
            setRegeneratingDay(null)
        }
    }

    const displayItinerary = isEditing ? editableItinerary : itinerary

    // ── View step edit helpers ───────────────────────────────────────────────

    const startViewEditing = () => {
        if (!viewingTrip) return
        const cloned = structuredClone(viewingTrip.result)
        for (const day of cloned.dias) {
            for (const key of ['manha', 'tarde', 'noite'] as const) {
                day[key] = { atividades: normalizePeriod(day[key]) }
            }
        }
        setEditableViewItinerary(cloned)
        setIsViewEditing(true)
        setViewSaveStatus('idle')
    }

    const cancelViewEditing = () => {
        setEditableViewItinerary(null)
        setIsViewEditing(false)
        setViewSaveStatus('idle')
    }

    const saveViewEdits = async () => {
        if (!editableViewItinerary || !viewingTrip) return
        setViewSaveStatus('saving')
        await supabase.from('itineraries').update({ result: editableViewItinerary }).eq('id', viewingTrip.id)
        setViewingTrip(prev => prev ? { ...prev, result: editableViewItinerary } : prev)
        setIsViewEditing(false)
        setEditableViewItinerary(null)
        setViewSaveStatus('saved')
        setTimeout(() => setViewSaveStatus('idle'), 2500)
    }

    const updateViewDayTema = (dayIdx: number, value: string) => {
        setEditableViewItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            dias[dayIdx] = { ...dias[dayIdx], tema: value }
            return { ...prev, dias }
        })
    }

    const setViewActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite', actIdx: number, field: keyof Activity, value: string) => {
        setEditableViewItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const atividades = [...normalizePeriod(dias[dayIdx][period])]
            atividades[actIdx] = { ...atividades[actIdx], [field]: value }
            dias[dayIdx] = { ...dias[dayIdx], [period]: { atividades } }
            return { ...prev, dias }
        })
    }

    const addViewActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite') => {
        setEditableViewItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const atividades = normalizePeriod(dias[dayIdx][period])
            dias[dayIdx] = { ...dias[dayIdx], [period]: { atividades: [...atividades, { ...BLANK_ACTIVITY }] } }
            return { ...prev, dias }
        })
    }

    const removeViewActivity = (dayIdx: number, period: 'manha' | 'tarde' | 'noite', actIdx: number) => {
        setEditableViewItinerary(prev => {
            if (!prev) return prev
            const dias = [...prev.dias]
            const atividades = normalizePeriod(dias[dayIdx][period])
            dias[dayIdx] = { ...dias[dayIdx], [period]: { atividades: atividades.filter((_, i) => i !== actIdx) } }
            return { ...prev, dias }
        })
    }

    const removeViewDay = (dayIdx: number) => {
        setEditableViewItinerary(prev => {
            if (!prev) return prev
            const dias = prev.dias.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, dia: i + 1 }))
            return { ...prev, dias }
        })
        setViewCollapsedDays(prev => prev.filter((_, i) => i !== dayIdx))
    }

    const addViewDay = () => {
        setEditableViewItinerary(prev => {
            if (!prev) return prev
            return { ...prev, dias: [...prev.dias, BLANK_DAY(prev.dias.length + 1)] }
        })
        setViewCollapsedDays(prev => [...prev, false])
    }

    const displayViewItinerary = isViewEditing ? editableViewItinerary : viewingTrip?.result ?? null

    // ── Main layout width ────────────────────────────────────────────────────

    const isWideStep = step === 'result' || step === 'view'

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                /* Leaflet + Tailwind v4 fix: preflight overrides break tile rendering */
                .leaflet-container img {
                    max-width: none !important;
                    display: inline !important;
                }
                .leaflet-tile-container img {
                    display: block !important;
                    max-width: none !important;
                    width: 256px !important;
                    height: 256px !important;
                }
                @media (max-width: 768px) {
                    .roteiro-main { padding: 20px 16px 100px !important; }
                    .roteiro-result-grid { grid-template-columns: 1fr !important; }
                    .roteiro-view-grid  { grid-template-columns: 1fr !important; }
                    .roteiro-form-row   { grid-template-columns: 1fr !important; }
                    .roteiro-budget-grid { grid-template-columns: 1fr 1fr !important; }
                    .roteiro-actions { flex-wrap: wrap !important; }
                    .roteiro-actions .btn { flex: 1 1 calc(50% - 6px) !important; min-width: 130px !important; font-size: 14px !important; padding: 12px 10px !important; }
                    .roteiro-header-card { padding: 20px 18px !important; }
                    .roteiro-day-header  { padding: 14px 16px !important; }
                    .roteiro-period-row  { padding: 14px 16px !important; }
                }
                @media (max-width: 480px) {
                    .roteiro-main { padding: 16px 12px 90px !important; }
                    .roteiro-actions .btn { flex: 1 1 100% !important; }
                    .roteiro-header-card { padding: 16px 14px !important; border-radius: 18px !important; }
                    .roteiro-day-header  { padding: 12px 14px !important; }
                    .roteiro-period-row  { padding: 12px 14px !important; }
                    .roteiro-budget-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
            <Header variant="app" />

            <main className="roteiro-main" style={{
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

                                    <div className="roteiro-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={labelStyle}>Duração da viagem</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '10px 14px', background: '#fff' }}>
                                                <button type="button" onClick={() => setDuration(d => Math.max(1, d - 1))} style={stepperBtn}>–</button>
                                                <span style={{ flex: 1, textAlign: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)' }}>
                                                    {duration} {duration === 1 ? 'dia' : 'dias'}
                                                </span>
                                                <button type="button" onClick={() => setDuration(d => Math.min(7, d + 1))} style={stepperBtn}>+</button>
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

                                    <div>
                                        <label style={labelStyle}>Orçamento da viagem</label>
                                        <div className="roteiro-budget-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                            {([
                                                { level: 1 as const, signs: '$', label: 'Gratuito', desc: 'Somente atividades sem custo' },
                                                { level: 2 as const, signs: '$$', label: 'Econômico', desc: 'Comida de rua e ingressos baratos' },
                                                { level: 3 as const, signs: '$$$', label: 'Moderado', desc: 'Ótimo custo-benefício' },
                                                { level: 4 as const, signs: '$$$$', label: 'Premium', desc: 'Experiências de alto padrão' },
                                            ]).map(({ level, signs, label, desc }) => {
                                                const active = budget === level
                                                return (
                                                    <button
                                                        key={level}
                                                        type="button"
                                                        onClick={() => setBudget(level)}
                                                        style={{
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                                            padding: '14px 8px', borderRadius: '14px', cursor: 'pointer',
                                                            border: `2px solid ${active ? 'var(--blue-vibrant)' : 'var(--border-light)'}`,
                                                            background: active ? 'var(--blue-pale-mid)' : '#fff',
                                                            fontFamily: 'inherit', transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '17px', fontWeight: 800, color: active ? 'var(--blue-vibrant)' : 'var(--text-muted)', letterSpacing: '-0.5px' }}>{signs}</span>
                                                        <span style={{ fontSize: '11px', fontWeight: 800, color: active ? 'var(--blue-vibrant)' : 'var(--text-dark)' }}>{label}</span>
                                                        <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{desc}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Bairro de hospedagem + Contexto especial */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px', borderTop: '1px solid var(--border-light)' }}>
                                        <div>
                                            <label style={labelStyle}>
                                                Bairro de hospedagem <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(opcional)</span>
                                            </label>
                                            <div style={{ position: 'relative' }}>
                                                <MapPin size={14} color="var(--text-faint)" style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)' }} />
                                                <input
                                                    type="text"
                                                    value={bairroHospedagem}
                                                    onChange={e => setBairroHospedagem(e.target.value)}
                                                    placeholder="Ex: Le Marais, Montmartre, Centro Histórico..."
                                                    style={{
                                                        width: '100%', padding: '11px 14px 11px 36px',
                                                        border: '1px solid var(--border-light)', borderRadius: '12px',
                                                        fontSize: '14px', color: 'var(--text-dark)',
                                                        background: '#fff', fontFamily: 'inherit', outline: 'none',
                                                        boxSizing: 'border-box', transition: 'border-color 0.2s',
                                                    }}
                                                    onFocus={e => e.target.style.borderColor = 'var(--blue-medium)'}
                                                    onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
                                                />
                                            </div>
                                            <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '5px 0 0' }}>
                                                A IA organiza os dias priorizando atrações próximas ao seu hotel.
                                            </p>
                                        </div>

                                        <div>
                                            <label style={labelStyle}>
                                                Contexto especial <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(opcional)</span>
                                            </label>
                                            <textarea
                                                value={contextEspecial}
                                                onChange={e => setContextEspecial(e.target.value)}
                                                placeholder="Ex: sou vegetariano, viajo com bebê de 1 ano, tenho mobilidade reduzida, odeio filas longas, prefiro transporte público..."
                                                rows={2}
                                                style={{
                                                    width: '100%', padding: '11px 14px',
                                                    border: '1px solid var(--border-light)', borderRadius: '12px',
                                                    fontSize: '14px', color: 'var(--text-dark)',
                                                    background: '#fff', fontFamily: 'inherit', outline: 'none',
                                                    resize: 'vertical', boxSizing: 'border-box', transition: 'border-color 0.2s',
                                                }}
                                                onFocus={e => e.target.style.borderColor = 'var(--blue-medium)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
                                            />
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
                                    <>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
                                            {genProgress < 20 && `Pesquisando atrações em ${destination}...`}
                                            {genProgress >= 20 && genProgress < 40 && 'Selecionando os melhores pontos turísticos...'}
                                            {genProgress >= 40 && genProgress < 60 && 'Calculando horários e deslocamentos...'}
                                            {genProgress >= 60 && genProgress < 80 && 'Organizando seu roteiro dia a dia...'}
                                            {genProgress >= 80 && 'Finalizando dicas e recomendações...'}
                                        </p>
                                        <div style={{ width: '260px', height: '6px', borderRadius: '99px', background: 'var(--blue-pale-mid)', overflow: 'hidden' }}>
                                            <motion.div
                                                animate={{ width: `${genProgress}%` }}
                                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                                style={{ height: '100%', borderRadius: '99px', background: 'var(--blue-vibrant)' }}
                                            />
                                        </div>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>{genProgress}%</p>
                                    </>
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
                            <div className="roteiro-result-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '28px', alignItems: 'flex-start' }}>

                                {/* LEFT — itinerary */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                    {/* Header card */}
                                    <div className="roteiro-header-card" style={{ background: 'linear-gradient(135deg, #0E2A55 0%, #2A60C2 100%)', borderRadius: '24px', padding: '28px 32px', color: '#fff' }}>
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
                                        <div key={i} style={{ position: 'relative' }}>
                                            <EditableDayCard
                                                day={day}
                                                index={i}
                                                isEditing={isEditing}
                                                collapsed={collapsedDays[i] ?? false}
                                                onToggle={() => toggleDay(i)}
                                                onExpand={() => expandDay(i)}
                                                onUpdateTema={v => updateDayTema(i, v)}
                                                onSetActivity={(p, ai, f, v) => setActivity(i, p, ai, f, v)}
                                                onAddActivity={p => addActivity(i, p)}
                                                onRemoveActivity={(p, ai) => removeActivity(i, p, ai)}
                                                onRemove={() => removeDay(i)}
                                            />
                                            {/* Botão refazer dia — só aparece fora do modo edição */}
                                            {!isEditing && (
                                                <button
                                                    onClick={() => handleRegenerateDay(i)}
                                                    disabled={regeneratingDay !== null}
                                                    style={{
                                                        position: 'absolute', bottom: '14px', right: '14px',
                                                        display: 'flex', alignItems: 'center', gap: '5px',
                                                        padding: '5px 12px', borderRadius: '999px',
                                                        border: '1.5px solid var(--border-light)',
                                                        background: '#fff', cursor: regeneratingDay !== null ? 'wait' : 'pointer',
                                                        fontSize: '11.5px', fontWeight: 700,
                                                        color: regeneratingDay === i ? 'var(--blue-medium)' : 'var(--text-muted)',
                                                        fontFamily: 'inherit', transition: 'all 0.15s',
                                                        opacity: regeneratingDay !== null && regeneratingDay !== i ? 0.4 : 1,
                                                    }}
                                                    title="Gerar uma versão diferente para este dia"
                                                >
                                                    {regeneratingDay === i
                                                        ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Refazendo...</>
                                                        : <><RefreshCw size={11} /> Refazer dia</>
                                                    }
                                                </button>
                                            )}
                                        </div>
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
                                        <div className="roteiro-actions" style={{ display: 'flex', gap: '12px' }}>
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
                                                onClick={handleExportPDF}
                                                disabled={exportingPDF}
                                                className="btn"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '14px 20px', borderRadius: '14px',
                                                    background: 'transparent', color: 'var(--blue-vibrant)',
                                                    border: '2px solid var(--blue-medium)', fontSize: '15px', fontWeight: 700, cursor: exportingPDF ? 'default' : 'pointer',
                                                    opacity: exportingPDF ? 0.7 : 1,
                                                }}
                                                onMouseEnter={e => { if (!exportingPDF) e.currentTarget.style.background = 'var(--blue-pale)' }}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {exportingPDF ? <Loader2 size={16} className="spin" /> : <FileDown size={16} />}
                                                {exportingPDF ? 'Gerando...' : 'Exportar PDF'}
                                            </button>
                                            <button
                                                onClick={handleExportMyMapsResult}
                                                className="btn"
                                                title="Baixa um arquivo KML e abre o Google My Maps para você importar"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '14px 20px', borderRadius: '14px',
                                                    background: 'transparent', color: '#34A853',
                                                    border: '2px solid rgba(52,168,83,0.4)',
                                                    fontSize: '15px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,168,83,0.1)'; e.currentTarget.style.borderColor = '#34A853' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(52,168,83,0.4)' }}
                                            >
                                                <Globe size={16} />
                                                Google Maps
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

                                {/* RIGHT — extras sidebar + day map */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {itinerary?.extras && (
                                        <ExtrasSidebar
                                            extras={itinerary.extras}
                                            activeTab={activeTab}
                                            onTabChange={setActiveTab}
                                            onRefresh={async () => {
                                                const { data, error } = await supabase.functions.invoke('refresh-extras', { body: { itinerary_id: currentRowId } })
                                                if (!error && data?.extras) setItinerary(prev => prev ? { ...prev, extras: data.extras } : prev)
                                            }}
                                        />
                                    )}
                                    <DaysMapSection dias={displayItinerary.dias} collapsedDays={collapsedDays} />
                                </div>
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
                    {step === 'view' && viewingTrip?.result && displayViewItinerary && (
                        <motion.div
                            key="view"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {error && (
                                <p style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', margin: '0 0 12px' }}>{error}</p>
                            )}
                            {/* Top bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={isViewEditing ? cancelViewEditing : () => setStep('list')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', padding: 0, fontFamily: 'inherit' }}
                                >
                                    <ChevronLeft size={16} /> {isViewEditing ? 'Cancelar edição' : 'Voltar para Minhas Viagens'}
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {viewSaveStatus === 'saved' && (
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Check size={14} /> Salvo!
                                        </span>
                                    )}
                                    {isViewEditing ? (
                                        <button
                                            onClick={saveViewEdits}
                                            disabled={viewSaveStatus === 'saving'}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '10px 18px', borderRadius: '12px',
                                                background: 'var(--blue-medium)', color: '#fff',
                                                border: 'none', fontSize: '14px', fontWeight: 700,
                                                cursor: 'pointer', fontFamily: 'inherit', opacity: viewSaveStatus === 'saving' ? 0.7 : 1,
                                            }}
                                        >
                                            {viewSaveStatus === 'saving' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                            Salvar alterações
                                        </button>
                                    ) : (
                                        <button
                                            onClick={startViewEditing}
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
                                    {!isViewEditing && (
                                        <>
                                        <button
                                            onClick={handleExportViewPDF}
                                            disabled={exportingPDF}
                                            className="btn"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '7px',
                                                padding: '10px 18px', borderRadius: '12px',
                                                background: 'transparent', color: 'var(--blue-vibrant)',
                                                border: '2px solid var(--blue-medium)', fontSize: '14px', fontWeight: 700, cursor: exportingPDF ? 'default' : 'pointer',
                                                opacity: exportingPDF ? 0.7 : 1,
                                            }}
                                            onMouseEnter={e => { if (!exportingPDF) e.currentTarget.style.background = 'var(--blue-pale)' }}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {exportingPDF ? <Loader2 size={15} className="spin" /> : <FileDown size={15} />}
                                            {exportingPDF ? 'Gerando...' : 'Exportar PDF'}
                                        </button>
                                        <button
                                            onClick={handleExportMyMapsView}
                                            className="btn"
                                            title="Baixa um arquivo KML e abre o Google My Maps para importar"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '7px',
                                                padding: '10px 18px', borderRadius: '12px',
                                                background: 'transparent', color: '#34A853',
                                                border: '2px solid rgba(52,168,83,0.4)',
                                                fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,168,83,0.1)'; e.currentTarget.style.borderColor = '#34A853' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(52,168,83,0.4)' }}
                                        >
                                            <Globe size={15} />
                                            Google Maps
                                        </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="roteiro-view-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '28px', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className="roteiro-header-card" style={{ background: 'linear-gradient(135deg, #0E2A55 0%, #2A60C2 100%)', borderRadius: '24px', padding: '28px 32px', color: '#fff' }}>
                                        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Viagem Salva</p>
                                        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.3 }}>{displayViewItinerary.titulo}</h2>
                                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: '0 0 20px', lineHeight: 1.6 }}>{displayViewItinerary.resumo}</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            <MetaBadge label={`${viewingTrip.duration} dia${viewingTrip.duration > 1 ? 's' : ''}`} />
                                            <MetaBadge label={TRAVELER_OPTIONS.find(o => o.value === viewingTrip.traveler_type)?.label ?? viewingTrip.traveler_type} />
                                            {viewingTrip.travel_style?.map(s => <MetaBadge key={s} label={s} />)}
                                        </div>
                                    </div>
                                    {displayViewItinerary.dias.map((day, i) => (
                                        <EditableDayCard
                                            key={i}
                                            day={day}
                                            index={i}
                                            isEditing={isViewEditing}
                                            collapsed={viewCollapsedDays[i] ?? false}
                                            onToggle={() => toggleViewDay(i)}
                                            onExpand={() => expandViewDay(i)}
                                            onUpdateTema={v => updateViewDayTema(i, v)}
                                            onSetActivity={(p, ai, f, v) => setViewActivity(i, p, ai, f, v)}
                                            onAddActivity={p => addViewActivity(i, p)}
                                            onRemoveActivity={(p, ai) => removeViewActivity(i, p, ai)}
                                            onRemove={() => removeViewDay(i)}
                                        />
                                    ))}
                                    {isViewEditing && (
                                        <button
                                            onClick={addViewDay}
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
                                    <TipsBudgetCard itinerary={displayViewItinerary} delayBase={displayViewItinerary.dias.length} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {viewingTrip.result.extras && (
                                        <ExtrasSidebar
                                            extras={viewingTrip.result.extras}
                                            activeTab={activeTab}
                                            onTabChange={setActiveTab}
                                            onRefresh={async () => {
                                                const { data, error } = await supabase.functions.invoke('refresh-extras', { body: { itinerary_id: viewingTrip.id } })
                                                if (!error && data?.extras) setViewingTrip(prev => prev ? { ...prev, result: { ...prev.result, extras: data.extras } } : prev)
                                            }}
                                        />
                                    )}
                                    <DaysMapSection dias={displayViewItinerary.dias} collapsedDays={viewCollapsedDays} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            {showMyMapsModal && (
                <MyMapsModal
                    fileName={kmlFileName}
                    onClose={() => setShowMyMapsModal(false)}
                />
            )}
        </div>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EditableDayCardProps {
    day: ItineraryDay
    index: number
    isEditing: boolean
    collapsed: boolean
    onToggle: () => void
    onExpand: () => void
    onUpdateTema: (v: string) => void
    onSetActivity: (p: 'manha' | 'tarde' | 'noite', actIdx: number, f: keyof Activity, v: string) => void
    onAddActivity: (p: 'manha' | 'tarde' | 'noite') => void
    onRemoveActivity: (p: 'manha' | 'tarde' | 'noite', actIdx: number) => void
    onRemove: () => void
}

function EditableDayCard({ day, index, isEditing, collapsed, onToggle, onExpand, onUpdateTema, onSetActivity, onAddActivity, onRemoveActivity, onRemove }: EditableDayCardProps) {
    useEffect(() => {
        if (isEditing) onExpand()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing])

    const toggleCollapse = () => {
        if (!isEditing) onToggle()
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            style={{ background: 'var(--bg-white)', border: `1px solid ${isEditing ? 'var(--blue-medium)' : 'var(--border-light)'}`, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(14,42,85,0.05)' }}
        >
            {/* Day header */}
            <div
                onClick={toggleCollapse}
                className="roteiro-day-header"
                style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 24px',
                    borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
                    background: isEditing ? 'rgba(74,144,226,0.03)' : 'transparent',
                    cursor: isEditing ? 'default' : 'pointer',
                    userSelect: 'none',
                }}
            >
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--blue-pale-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--blue-vibrant)' }}>{day.dia}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Dia {day.dia}</p>
                    {isEditing ? (
                        <input
                            value={day.tema}
                            onChange={e => onUpdateTema(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="Tema do dia..."
                            style={{ width: '100%', fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)', border: 'none', borderBottom: '1px solid var(--border-light)', outline: 'none', background: 'transparent', fontFamily: 'inherit', padding: '2px 0' }}
                        />
                    ) : (
                        <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>{day.tema}</p>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isEditing && (
                        <button onClick={e => { e.stopPropagation(); onRemove() }} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <Trash2 size={14} color="#ef4444" />
                        </button>
                    )}
                    {!isEditing && (
                        <motion.div
                            animate={{ rotate: collapsed ? -90 : 0 }}
                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                            style={{ display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronDown size={16} color="var(--text-muted)" />
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Periods */}
            <AnimatePresence initial={false}>
                {!collapsed && (
                    <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: 'hidden' }}
                    >
                    <div style={{ padding: '4px 0' }}>
                {PERIOD_CONFIG.map(({ key, label, Icon, color, bg }) => {
                    const period = day[key]
                    const atividades = normalizePeriod(period)
                    return (
                        <div key={key} className="roteiro-period-row" style={{ padding: '16px 24px', borderBottom: key !== 'noite' ? '1px solid var(--border-light)' : 'none' }}>
                            {/* Period label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={13} color={color} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                            </div>

                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {atividades.map((act, ai) => (
                                        <div key={ai} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <input value={act.horario} onChange={e => onSetActivity(key, ai, 'horario', e.target.value)} placeholder="08:00" style={{ width: '70px', fontSize: '12px', fontWeight: 700, color: 'var(--blue-vibrant)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '4px 6px', fontFamily: 'inherit', outline: 'none' }} />
                                                    <input value={act.local} onChange={e => onSetActivity(key, ai, 'local', e.target.value)} placeholder="Local..." style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '4px 6px', fontFamily: 'inherit', outline: 'none' }} />
                                                </div>
                                                <textarea value={act.atividade} onChange={e => onSetActivity(key, ai, 'atividade', e.target.value)} placeholder="Atividade..." rows={2} style={{ fontSize: '13px', color: 'var(--text-dark)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '5px 7px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
                                                <input value={act.dica} onChange={e => onSetActivity(key, ai, 'dica', e.target.value)} placeholder="Dica..." style={{ fontSize: '12px', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '4px 6px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                                            </div>
                                            {atividades.length > 1 && (
                                                <button onClick={() => onRemoveActivity(key, ai)} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}>
                                                    <Trash2 size={12} color="#ef4444" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => onAddActivity(key)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1.5px dashed var(--border-light)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue-medium)'; e.currentTarget.style.color = 'var(--blue-medium)' }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                                    >
                                        <Plus size={12} /> Adicionar atividade
                                    </button>
                                </div>
                            ) : (
                                /* View mode — flat list with timeline */
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {atividades.map((act, ai) => (
                                        <div key={ai} style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                                            {/* Timeline column */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px', flexShrink: 0 }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff' }}>{ai + 1}</span>
                                                </div>
                                                {ai < atividades.length - 1 && (
                                                    <div style={{ width: '2px', flex: 1, background: 'var(--border-light)', minHeight: '12px', margin: '2px 0' }} />
                                                )}
                                            </div>
                                            {/* Content */}
                                            <div style={{ flex: 1, paddingBottom: ai < atividades.length - 1 ? '10px' : '0' }}>
                                                {act.horario && (
                                                    <span style={{ fontSize: '11px', fontWeight: 800, color, display: 'inline-flex', alignItems: 'center', gap: '3px', marginBottom: '3px', background: bg, padding: '1px 7px', borderRadius: '20px' }}>
                                                        <Clock size={9} /> {act.horario}
                                                    </span>
                                                )}
                                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)', margin: '0 0 4px', lineHeight: 1.5 }}>{act.atividade}</p>
                                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                    {act.local && <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10} />{act.local}</span>}
                                                    {act.dica && <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '3px' }}><Lightbulb size={10} style={{ flexShrink: 0, marginTop: '1px' }} />{act.dica}</span>}
                                                </div>
                                                {(act.fonte || act.popularidade != null || act.melhor_epoca || act.evitar) && (
                                                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        {act.fonte && (
                                                            <span style={{ fontSize: '11px', color: '#4A90E2', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                                                                <Globe size={9} />{act.fonte}
                                                                {act.popularidade != null && (
                                                                    <span style={{ display: 'inline-flex', gap: '1px', marginLeft: '4px' }}>
                                                                        {Array.from({ length: 5 }).map((_, si) => (
                                                                            <Star key={si} size={8} fill={si < act.popularidade! ? '#F59E0B' : 'none'} color={si < act.popularidade! ? '#F59E0B' : 'var(--text-muted)'} />
                                                                        ))}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                        {act.melhor_epoca && (
                                                            <span style={{ fontSize: '11px', color: '#16A34A', display: 'flex', alignItems: 'flex-start', gap: '3px' }}>
                                                                <CalendarCheck size={9} style={{ flexShrink: 0, marginTop: '1px' }} />Melhor: {act.melhor_epoca}
                                                            </span>
                                                        )}
                                                        {act.evitar && (
                                                            <span style={{ fontSize: '11px', color: '#DC2626', display: 'flex', alignItems: 'flex-start', gap: '3px' }}>
                                                                <AlertTriangle size={9} style={{ flexShrink: 0, marginTop: '1px' }} />Evitar: {act.evitar}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}


function FitBounds({ positions }: { positions: [number, number][] }) {
    const map = useMap()
    useEffect(() => {
        if (positions.length === 0) return
        if (positions.length === 1) {
            map.setView(positions[0], 15)
        } else {
            map.fitBounds(L.latLngBounds(positions), { padding: [32, 32], maxZoom: 15 })
        }
    }, [map])
    return null
}

function InvalidateSize() {
    const map = useMap()
    useEffect(() => {
        const t = setTimeout(() => map.invalidateSize(), 80)
        return () => clearTimeout(t)
    }, [map])
    return null
}

function buildPin(color: string, n: number, size = 26) {
    return L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:${size < 28 ? 11 : 13}px;font-weight:800;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);font-family:Inter,system-ui,sans-serif">${n}</div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    })
}

interface DayPin {
    lat: number
    lng: number
    color: string
    dayNum: number
    period: string
    atividade: string
    local: string
}

function DaysMapSection({ dias, collapsedDays }: { dias: ItineraryDay[]; collapsedDays: boolean[] }) {
    const [expanded, setExpanded] = useState(false)

    // Build pins: for each period, number activities sequentially across expanded days
    const pins: DayPin[] = []
    PERIOD_CONFIG.forEach(({ key, color }) => {
        dias.forEach((day, i) => {
            if (collapsedDays[i]) return
            const atividades = normalizePeriod(day[key])
            atividades.forEach(act => {
                if (act.lat != null && act.lng != null && !(act.lat === 0 && act.lng === 0)) {
                    pins.push({ lat: act.lat, lng: act.lng, color, dayNum: day.dia, period: key, atividade: act.atividade, local: act.local })
                }
            })
        })
    })

    const mapKey = collapsedDays.join(',')
    const positions = pins.map(p => [p.lat, p.lng] as [number, number])
    const haspins = pins.length > 0

    // Fallback center: any coordinate from the itinerary (ignores collapsed state)
    const fallbackCenter = useMemo<[number, number]>(() => {
        for (const day of dias) {
            for (const { key } of PERIOD_CONFIG) {
                const atividades = normalizePeriod(day[key])
                for (const a of atividades) {
                    if (a.lat != null && a.lng != null && !(a.lat === 0 && a.lng === 0)) return [a.lat, a.lng]
                }
            }
        }
        return [-15.793, -47.882] // Brasil
    }, [dias])

    const mapCenter = haspins ? positions[0] : fallbackCenter

    return (
        <>
            {/* Preview card */}
            <div
                onClick={() => setExpanded(true)}
                style={{
                    background: 'var(--bg-white)', border: '1px solid var(--border-light)', borderRadius: '20px',
                    overflow: 'hidden', boxShadow: '0 4px 16px rgba(14,42,85,0.05)',
                    cursor: 'pointer',
                }}
            >
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={13} color="var(--blue-medium)" />
                        <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>
                            Mapa do Roteiro
                        </p>
                        {haspins && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                ({pins.length} locais)
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--blue-medium)' }}>
                        <Maximize2 size={12} /> Expandir
                    </div>
                </div>

                <div style={{ height: '160px', pointerEvents: 'none' }}>
                    <MapContainer
                        key={mapKey}
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        dragging={false}
                        touchZoom={false}
                        doubleClickZoom={false}
                        keyboard={false}
                        attributionControl={false}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <InvalidateSize />
                        {haspins && <FitBounds positions={positions} />}
                        {pins.map((pin, i) => (
                            <Marker key={i} position={[pin.lat, pin.lng]} icon={buildPin(pin.color, i + 1)} />
                        ))}
                    </MapContainer>
                </div>
            </div>

            {/* Full-screen modal */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        key="day-map-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => setExpanded(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 2000,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            padding: '24px',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: '860px',
                                background: 'var(--bg-white)', borderRadius: '24px',
                                overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
                            }}
                        >
                            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <MapPin size={15} color="var(--blue-medium)" />
                                    <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>Mapa do Roteiro</p>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{pins.length} locais</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Period legend */}
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {PERIOD_CONFIG.map(({ label, color }) => (
                                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setExpanded(false)}
                                        style={{ background: 'var(--snow)', border: '1px solid var(--border-light)', borderRadius: '10px', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}
                                    >
                                        <X size={18} color="var(--text-muted)" />
                                    </button>
                                </div>
                            </div>

                            <div style={{ height: '520px' }}>
                                <MapContainer
                                    key={`${mapKey}-exp`}
                                    center={mapCenter}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                    zoomControl={true}
                                    scrollWheelZoom={true}
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    />
                                    <InvalidateSize />
                                    {haspins && <FitBounds positions={positions} />}
                                    {pins.map((pin, i) => (
                                        <Marker key={i} position={[pin.lat, pin.lng]} icon={buildPin(pin.color, i + 1, 32)}>
                                            <Popup>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: pin.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                                    Dia {pin.dayNum} — {pin.period}
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '4px', maxWidth: '200px', lineHeight: 1.3 }}>{pin.atividade}</div>
                                                {pin.local && (
                                                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <span>📍</span> {pin.local}
                                                    </div>
                                                )}
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

function ExtrasSidebar({ extras, activeTab, onTabChange, onRefresh }: { extras: ItineraryExtras; activeTab: ExtraCategory; onTabChange: (t: ExtraCategory) => void; onRefresh?: () => Promise<void> }) {
    const [refreshing, setRefreshing] = useState(false)
    const items = extras[activeTab] ?? []

    const handleRefresh = async () => {
        if (!onRefresh || refreshing) return
        setRefreshing(true)
        try { await onRefresh() } finally { setRefreshing(false) }
    }

    return (
        <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: '20px', boxShadow: '0 4px 16px rgba(14,42,85,0.05)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>
                        Mais para fazer
                    </p>
                    {onRefresh && (
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            title="Gerar novas sugestões"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '5px 10px', borderRadius: '8px',
                                border: '1.5px solid var(--border-light)',
                                background: 'var(--snow)', cursor: refreshing ? 'wait' : 'pointer',
                                fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                                fontFamily: 'inherit', transition: 'all 0.15s',
                                opacity: refreshing ? 0.6 : 1,
                            }}
                        >
                            <RefreshCw size={11} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
                            {refreshing ? 'Atualizando…' : 'Atualizar'}
                        </button>
                    )}
                </div>
                {/* Tabs */}
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
            <div style={{ maxHeight: '480px', overflowY: 'auto', padding: '12px' }}>
                {items.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma sugestão disponível.</p>
                ) : (
                    items.map((item, i) => (
                        <div
                            key={i}
                            style={{ padding: '12px', borderRadius: '12px', marginBottom: '8px', background: 'var(--snow)', border: '1px solid var(--border-light)' }}
                        >
                            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-dark)', margin: 0 }}>{item.nome}</p>
                                {item.popularidade != null && (
                                    <span style={{ display: 'inline-flex', gap: '1px', flexShrink: 0 }}>
                                        {Array.from({ length: 5 }).map((_, si) => (
                                            <Star key={si} size={9} fill={si < item.popularidade! ? '#F59E0B' : 'none'} color={si < item.popularidade! ? '#F59E0B' : 'var(--text-muted)'} />
                                        ))}
                                    </span>
                                )}
                            </div>
                            {item.fonte && (
                                <p style={{ fontSize: '11px', color: '#4A90E2', margin: '0 0 4px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Globe size={9} /> {item.fonte}
                                </p>
                            )}
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
