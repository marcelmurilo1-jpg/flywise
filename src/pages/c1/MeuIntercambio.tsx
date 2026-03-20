import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Lock, FileText, Mail, ClipboardList, Plane, CheckCircle2,
    ChevronDown, ChevronRight, Check, MapPin, Trophy,
    Heart, Brain, Scissors, Stethoscope, Activity, Baby, Smile, Zap, RefreshCw, FlaskConical,
    Plus, X, ArrowLeft, ArrowRight, Trash2,
    ExternalLink, Clock, AlertTriangle, Building2, MoreHorizontal, Send, Inbox, CheckCircle, XCircle,
    CalendarDays, AtSign, StickyNote, Hash,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { useC1, type ChecklistItem, type Intercambio, type Hospital, type Doctor, type HospitalTarget, type DoctorStatus, type OnboardingItemStatus } from '@/contexts/C1Context'
import { C1TabBar } from './ExploreDestinos'

// ─── Specialties catalog ──────────────────────────────────────────────────────

const SPECIALTIES = [
    { id: 'Cardiologia', label: 'Cardiologia', description: 'Sistema cardiovascular e cardiopatias', cover: 'https://images.unsplash.com/photo-1628348070889-cb656235b4eb?w=600&q=80', icon: Heart, color: '#EF4444', bg: '#FEF2F2' },
    { id: 'Neurologia', label: 'Neurologia', description: 'Sistema nervoso e doenças cerebrais', cover: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&q=80', icon: Brain, color: '#3B82F6', bg: '#EFF6FF' },
    { id: 'Cirurgia', label: 'Cirurgia', description: 'Procedimentos cirúrgicos e intervencionistas', cover: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600&q=80', icon: Scissors, color: '#F59E0B', bg: '#FFFBEB' },
    { id: 'Medicina Interna', label: 'Medicina Interna', description: 'Doenças sistêmicas e medicina geral', cover: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80', icon: Stethoscope, color: '#10B981', bg: '#F0FDF4' },
    { id: 'Oncologia', label: 'Oncologia', description: 'Tratamento e pesquisa em câncer', cover: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&q=80', icon: Activity, color: '#8B5CF6', bg: '#F5F3FF' },
    { id: 'Pediatria', label: 'Pediatria', description: 'Saúde infantil e neonatologia', cover: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&q=80', icon: Baby, color: '#06B6D4', bg: '#ECFEFF' },
    { id: 'Psiquiatria', label: 'Psiquiatria', description: 'Saúde mental e transtornos neuropsiquiátricos', cover: 'https://images.unsplash.com/photo-1576671081837-49000212a370?w=600&q=80', icon: Smile, color: '#EC4899', bg: '#FDF2F8' },
    { id: 'Gastroenterologia', label: 'Gastroenterologia', description: 'Sistema digestivo e hepatologia', cover: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&q=80', icon: Zap, color: '#84CC16', bg: '#F7FEE7' },
    { id: 'Transplante', label: 'Transplante', description: 'Transplante de órgãos e imunossupressão', cover: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=600&q=80', icon: RefreshCw, color: '#F97316', bg: '#FFF7ED' },
    { id: 'Endocrinologia', label: 'Endocrinologia', description: 'Diabetes, tireoide e doenças hormonais', cover: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&q=80', icon: FlaskConical, color: '#6366F1', bg: '#EEF2FF' },
    { id: 'Neurociências', label: 'Neurociências', description: 'Pesquisa avançada em neurociências', cover: 'https://images.unsplash.com/photo-1582719366942-5b63ad459e23?w=600&q=80', icon: Brain, color: '#14B8A6', bg: '#F0FDFA' },
]

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES = [
    { n: 1 as const, label: 'Documentos', sub: 'CV, PS e LoR', icon: FileText, color: '#3B82F6' },
    { n: 2 as const, label: 'Emails / CRM', sub: 'Contatos médicos', icon: Mail, color: '#8B5CF6' },
    { n: 3 as const, label: 'Onboarding', sub: 'Envio de docs', icon: ClipboardList, color: '#F59E0B' },
    { n: 4 as const, label: 'Pré-Embarque', sub: 'Logística + voos', icon: Plane, color: '#10B981' },
]

const DOC_CARDS = [
    { key: 'cv' as const, title: 'Currículo (CV)', subtitle: 'American-style Curriculum Vitae', cover: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80', color: '#3B82F6', tag: 'Obrigatório' },
    { key: 'ps' as const, title: 'Personal Statement', subtitle: 'Carta de motivação pessoal', cover: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80', color: '#8B5CF6', tag: 'Obrigatório' },
    { key: 'lor' as const, title: 'Letter of Recommendation', subtitle: 'Carta de recomendação médica', cover: 'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=600&q=80', color: '#F59E0B', tag: 'Obrigatório' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SpecialtyDivider({ label }: { label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#64748B', whiteSpace: 'nowrap' }}>
                {label}
            </span>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
        </div>
    )
}

// ─── Step 1 — Specialty gallery ───────────────────────────────────────────────

function SpecialtyGallery({ selected, onToggle, onConfirm }: {
    selected: string[]
    onToggle: (id: string) => void
    onConfirm: () => void
}) {
    const { state } = useC1()
    const hasHospitals = state.intercambios.length > 0

    // Derive specialties from existing intercambios
    const existingSpecialties = [...new Set(state.intercambios.flatMap(i => i.hospital.specialty))]

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

            {/* ── Existing hospital overview (shown while editing specialties) ── */}
            {hasHospitals && (
                <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', marginBottom: '28px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>Seus hospitais de interesse</div>
                    <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '0' }}>Adicione ou remova especialidades para atualizar a lista.</p>
                    {existingSpecialties.map(spec => {
                        const hospitals = state.intercambios
                            .filter(i => i.hospital.specialty.includes(spec) && i.hospital.rankingsBySpecialty[spec] !== undefined)
                            .sort((a, b) => a.hospital.rankingsBySpecialty[spec] - b.hospital.rankingsBySpecialty[spec])
                        if (hospitals.length === 0) return null
                        return (
                            <div key={spec}>
                                <SpecialtyDivider label={spec} />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {hospitals.map(i => (
                                        <div key={i.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px' }}>
                                            <img src={i.hospital.coverImage} alt={i.hospital.name} style={{ width: 24, height: 24, borderRadius: '5px', objectFit: 'cover' }} />
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{i.hospital.shortName}</span>
                                            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>#{i.hospital.rankingsBySpecialty[spec]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em', marginBottom: '6px' }}>
                    {hasHospitals ? 'Altere suas especialidades' : 'Quais especialidades te interessam?'}
                </h2>
                <p style={{ fontSize: '14px', color: '#64748B' }}>Selecione uma ou mais para filtrar os melhores hospitais.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {SPECIALTIES.map((spec, i) => {
                    const isSelected = selected.includes(spec.id)
                    return (
                        <motion.div key={spec.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025, duration: 0.28 }}
                            onClick={() => onToggle(spec.id)}
                            style={{
                                background: '#fff', border: `1.5px solid ${isSelected ? spec.color : '#E2E8F0'}`,
                                borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: isSelected ? `0 0 0 3px ${spec.color}18, 0 4px 12px rgba(0,0,0,0.06)` : '0 1px 4px rgba(0,0,0,0.04)',
                                transform: isSelected ? 'translateY(-2px)' : 'translateY(0)',
                            }}
                        >
                            <div style={{ position: 'relative', height: '100px', overflow: 'hidden' }}>
                                <img src={spec.cover} alt={spec.label} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', transform: isSelected ? 'scale(1.06)' : 'scale(1)' }} />
                                <div style={{ position: 'absolute', inset: 0, background: isSelected ? `${spec.color}28` : 'rgba(0,0,0,0.06)' }} />
                                {isSelected && (
                                    <div style={{ position: 'absolute', top: '8px', right: '8px', width: 20, height: 20, borderRadius: '50%', background: spec.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Check size={12} color="#fff" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '10px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '5px', background: spec.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <spec.icon size={10} color={spec.color} />
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{spec.label}</span>
                                </div>
                                <p style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>{spec.description}</p>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <AnimatePresence>
                {selected.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', background: '#fff', border: '1.5px solid #BFDBFE', borderRadius: '14px', gap: '16px' }}>
                        <div style={{ fontSize: '14px', color: '#1E40AF', fontWeight: 600 }}>
                            {selected.length} especialidade{selected.length > 1 ? 's' : ''} selecionada{selected.length > 1 ? 's' : ''}
                        </div>
                        <button onClick={onConfirm}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '10px', border: 'none', background: '#2563EB', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
                        >
                            {hasHospitals ? 'Adicionar hospitais' : 'Escolher hospitais'} <ArrowRight size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ─── Step 2 — Hospital gallery grouped by specialty ───────────────────────────

function HospitalGallery({ selectedSpecialties, selectedIds, onToggle, onConfirm, onBack }: {
    selectedSpecialties: string[]
    selectedIds: string[]
    onToggle: (id: string) => void
    onConfirm: () => void
    onBack: () => void
}) {
    const { state } = useC1()
    const isAdded = (id: string) => state.intercambios.some(i => i.hospital.id === id)

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button onClick={onBack}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'none', color: '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ← Especialidades
                </button>
                <div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em', marginBottom: '2px' }}>
                        Melhores hospitais por especialidade
                    </h2>
                    <p style={{ fontSize: '13px', color: '#64748B' }}>Ranking US News 2024 · selecione todos que tiver interesse</p>
                </div>
            </div>

            {/* ── Grouped by specialty ── */}
            {selectedSpecialties.map(spec => {
                const hospitals = state.hospitals
                    .filter(h => h.specialty.includes(spec) && h.rankingsBySpecialty[spec] !== undefined)
                    .sort((a, b) => a.rankingsBySpecialty[spec] - b.rankingsBySpecialty[spec])
                    .slice(0, 10)

                if (hospitals.length === 0) return null

                return (
                    <div key={spec}>
                        <SpecialtyDivider label={`${spec} — Top ${hospitals.length} US News`} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px', marginBottom: '8px' }}>
                            {hospitals.map((hospital, i) => {
                                const ranking = hospital.rankingsBySpecialty[spec]
                                const selected = selectedIds.includes(hospital.id) || isAdded(hospital.id)
                                const added = isAdded(hospital.id)
                                return (
                                    <motion.div key={hospital.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.28 }}
                                        onClick={() => { if (!added) onToggle(hospital.id) }}
                                        style={{
                                            background: '#fff', border: `1.5px solid ${selected ? '#2563EB' : '#E2E8F0'}`,
                                            borderRadius: '14px', overflow: 'hidden', cursor: added ? 'default' : 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: selected ? '0 0 0 3px #2563EB18, 0 4px 14px rgba(0,0,0,0.07)' : '0 1px 4px rgba(0,0,0,0.04)',
                                            transform: selected ? 'translateY(-2px)' : 'translateY(0)',
                                        }}
                                    >
                                        {/* Cover */}
                                        <div style={{ position: 'relative', height: '120px', overflow: 'hidden' }}>
                                            <img src={hospital.coverImage} alt={hospital.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', transform: selected ? 'scale(1.05)' : 'scale(1)' }} />
                                            <div style={{ position: 'absolute', inset: 0, background: selected ? 'rgba(37,99,235,0.14)' : 'rgba(0,0,0,0.06)' }} />
                                            {/* Ranking badge */}
                                            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(255,255,255,0.95)', borderRadius: '6px', padding: '3px 8px', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                                                <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>US News</span>
                                                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>#{ranking}</span>
                                            </div>
                                            {selected && (
                                                <div style={{ position: 'absolute', top: '8px', right: '8px', width: 22, height: 22, borderRadius: '50%', background: added ? '#059669' : '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Check size={13} color="#fff" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                        {/* Footer */}
                                        <div style={{ padding: '10px 12px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>{hospital.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8' }}>
                                                <MapPin size={10} />
                                                <span style={{ fontSize: '11px' }}>{hospital.city}, {hospital.state}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}

            <div style={{ height: '28px' }} />

            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', background: '#fff', border: '1.5px solid #BFDBFE', borderRadius: '14px', gap: '16px' }}>
                        <div style={{ fontSize: '14px', color: '#1E40AF', fontWeight: 600 }}>
                            {selectedIds.length} hospital{selectedIds.length > 1 ? 'is' : ''} selecionado{selectedIds.length > 1 ? 's' : ''}
                        </div>
                        <button onClick={onConfirm}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '10px', border: 'none', background: '#2563EB', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
                        >
                            Confirmar seleção <ArrowRight size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ─── Hospital chip with left/right reorder ────────────────────────────────────

function HospitalChip({ hospital, ranking, onRemove, onMoveLeft, onMoveRight, canMoveLeft, canMoveRight, onNavigate }: {
    hospital: Hospital
    ranking: number
    onRemove: () => void
    onMoveLeft?: () => void
    onMoveRight?: () => void
    canMoveLeft?: boolean
    canMoveRight?: boolean
    onNavigate?: (dest: 'hospital' | 'city') => void
}) {
    const [popupOpen, setPopupOpen] = useState(false)
    return (
        <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '10px', overflow: 'visible', position: 'relative' }}
        >
            {/* Move left */}
            {canMoveLeft && (
                <button onClick={onMoveLeft} title="Mover para a esquerda"
                    style={{ width: 26, height: '100%', minHeight: 42, border: 'none', borderRight: '1px solid #F1F5F9', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.color = '#94A3B8' }}
                >
                    <ArrowLeft size={12} />
                </button>
            )}
            {/* Content — clickable */}
            <div onClick={() => onNavigate && setPopupOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', cursor: onNavigate ? 'pointer' : 'default' }}>
                <img src={hospital.coverImage} alt={hospital.name} style={{ width: 26, height: 26, borderRadius: '5px', objectFit: 'cover', flexShrink: 0 }} />
                <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{hospital.shortName}</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1 }}>{hospital.city}</div>
                </div>
                <div style={{ paddingLeft: '6px', borderLeft: '1px solid #F1F5F9', textAlign: 'right' }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#94A3B8', lineHeight: 1, letterSpacing: '0.05em', textTransform: 'uppercase' }}>US News</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>#{ranking}</div>
                </div>
            </div>
            {/* Navigation popup */}
            <AnimatePresence>
                {popupOpen && onNavigate && (
                    <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '11px', padding: '6px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '190px' }}
                        onClick={e => e.stopPropagation()} onMouseLeave={() => setPopupOpen(false)}>
                        <button onClick={() => { onNavigate('hospital'); setPopupOpen(false) }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#334155', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Building2 size={12} color="#2563EB" /> Ver hospital no Hub
                        </button>
                        <button onClick={() => { onNavigate('city'); setPopupOpen(false) }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#334155', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <MapPin size={12} color="#059669" /> Ver {hospital.city} no Hub
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Move right */}
            {canMoveRight && (
                <button onClick={onMoveRight} title="Mover para a direita"
                    style={{ width: 26, height: '100%', minHeight: 42, border: 'none', borderLeft: '1px solid #F1F5F9', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.color = '#94A3B8' }}
                >
                    <ArrowRight size={12} />
                </button>
            )}
            {/* Remove */}
            <button onClick={onRemove} title="Remover"
                style={{ width: 26, height: '100%', minHeight: 42, border: 'none', borderLeft: '1px solid #F1F5F9', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', transition: 'all 0.15s', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.color = '#94A3B8' }}
            >
                <X size={12} />
            </button>
        </motion.div>
    )
}

// ─── Specialty section with reorderable hospital chips ────────────────────────

function SpecialtySection({ spec, specIdx, totalSpecs, hospitalIds, hospitalOrderBySpecialty, intercambios, onReorderSpec, onReorderHospital, onRemoveHospital, onNavigateHospital }: {
    spec: string
    specIdx: number
    totalSpecs: number
    hospitalIds: string[]
    hospitalOrderBySpecialty: Record<string, string[]>
    intercambios: Intercambio[]
    onReorderSpec: (dir: -1 | 1) => void
    onReorderHospital: (spec: string, id: string, dir: -1 | 1) => void
    onRemoveHospital: (id: string) => void
    onNavigateHospital: (hospital: Hospital, dest: 'hospital' | 'city') => void
}) {
    const order = hospitalOrderBySpecialty[spec] ?? hospitalIds
    const orderedHospitals = order
        .map(id => intercambios.find(i => i.id === id))
        .filter((i): i is Intercambio => i != null && i.hospital.rankingsBySpecialty[spec] !== undefined)

    if (orderedHospitals.length === 0) return null

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#64748B', whiteSpace: 'nowrap' }}>
                    {spec}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                {/* Specialty reorder */}
                <div style={{ display: 'flex', gap: '2px' }}>
                    {specIdx > 0 && (
                        <button onClick={() => onReorderSpec(-1)} title="Mover especialidade para cima"
                            style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#64748B', fontFamily: 'inherit' }}>↑</button>
                    )}
                    {specIdx < totalSpecs - 1 && (
                        <button onClick={() => onReorderSpec(1)} title="Mover especialidade para baixo"
                            style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#64748B', fontFamily: 'inherit' }}>↓</button>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {orderedHospitals.map((i, idx) => (
                    <HospitalChip
                        key={i.id}
                        hospital={i.hospital}
                        ranking={i.hospital.rankingsBySpecialty[spec]}
                        canMoveLeft={idx > 0}
                        canMoveRight={idx < orderedHospitals.length - 1}
                        onMoveLeft={() => onReorderHospital(spec, i.id, -1)}
                        onMoveRight={() => onReorderHospital(spec, i.id, 1)}
                        onRemove={() => onRemoveHospital(i.id)}
                        onNavigate={(dest) => onNavigateHospital(i.hospital, dest)}
                    />
                ))}
            </div>
        </div>
    )
}

// ─── Interest overview card (inside Stage 1) ──────────────────────────────────

function InterestOverview({ specialtyOrder, hospitalOrderBySpecialty, onReorderSpec, onReorderHospital, onAddMore, onChangeSpecialties }: {
    specialtyOrder: string[]
    hospitalOrderBySpecialty: Record<string, string[]>
    onReorderSpec: (idx: number, dir: -1 | 1) => void
    onReorderHospital: (spec: string, id: string, dir: -1 | 1) => void
    onAddMore: () => void
    onChangeSpecialties: () => void
}) {
    const { state, dispatch } = useC1()
    const navigate = useNavigate()

    function handleNavigateHospital(hospital: Hospital, dest: 'hospital' | 'city') {
        navigate(`/c1?${dest === 'hospital' ? 'hospital' : 'city'}=${encodeURIComponent(dest === 'hospital' ? hospital.id : hospital.city)}`)
    }

    // IDs of intercambios that cover each specialty
    const intercambioIdsForSpec = (spec: string) =>
        state.intercambios.filter(i => i.hospital.specialty.includes(spec) && i.hospital.rankingsBySpecialty[spec] !== undefined).map(i => i.id)

    return (
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '18px 20px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Hospitais de interesse</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onChangeSpecialties}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'none', color: '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                        Alterar especialidades
                    </button>
                    <button onClick={onAddMore}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF' }}
                    >
                        <Plus size={12} /> Adicionar hospital
                    </button>
                </div>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                Use ← → para reordenar hospitais · ↑↓ para reordenar especialidades · × para remover
            </p>

            {specialtyOrder.map((spec, specIdx) => (
                <SpecialtySection
                    key={spec}
                    spec={spec}
                    specIdx={specIdx}
                    totalSpecs={specialtyOrder.length}
                    hospitalIds={intercambioIdsForSpec(spec)}
                    hospitalOrderBySpecialty={hospitalOrderBySpecialty}
                    intercambios={state.intercambios}
                    onReorderSpec={(dir) => onReorderSpec(specIdx, dir)}
                    onReorderHospital={onReorderHospital}
                    onRemoveHospital={(id) => dispatch({ type: 'REMOVE_INTERCAMBIO', id })}
                    onNavigateHospital={handleNavigateHospital}
                />
            ))}
        </div>
    )
}

// ─── CheckItem ────────────────────────────────────────────────────────────────

function CheckItem({ item, onToggle, accentColor }: { item: ChecklistItem; onToggle: () => void; accentColor: string }) {
    return (
        <motion.div layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            onClick={onToggle}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
            whileHover={{ background: '#F8FAFC' }}
        >
            <div style={{ width: 20, height: 20, borderRadius: '6px', flexShrink: 0, marginTop: '1px', border: `2px solid ${item.done ? accentColor : '#CBD5E1'}`, background: item.done ? accentColor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {item.done && <Check size={11} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: '13px', color: item.done ? '#94A3B8' : '#334155', lineHeight: 1.55, textDecoration: item.done ? 'line-through' : 'none', transition: 'color 0.2s', flex: 1 }}>
                {item.label}
                {item.optional && <span style={{ marginLeft: 6, fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>OPCIONAL</span>}
            </span>
        </motion.div>
    )
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({ card, items, intercambioId, expanded, onExpand }: {
    card: typeof DOC_CARDS[number]; items: ChecklistItem[]; intercambioId: string; expanded: boolean; onExpand: () => void
}) {
    const { dispatch } = useC1()
    const done = items.filter(i => i.done).length
    const total = items.length
    const pct = Math.round((done / total) * 100)
    const complete = done === total

    return (
        <div style={{ background: '#fff', border: `1.5px solid ${expanded ? card.color + '40' : '#E2E8F0'}`, borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.3s, box-shadow 0.3s', boxShadow: expanded ? `0 0 0 3px ${card.color}10, 0 8px 24px rgba(0,0,0,0.08)` : '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div onClick={onExpand} style={{ position: 'relative', height: '160px', overflow: 'hidden', cursor: 'pointer' }}>
                <img src={card.cover} alt={card.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', transform: expanded ? 'scale(1.04)' : 'scale(1)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, rgba(255,255,255,0.85) 100%)' }} />
                <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '8px', padding: '4px 10px', border: `1px solid ${card.color}30` }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: complete ? '#059669' : card.color }}>{pct}%</span>
                </div>
                {complete && (
                    <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 9px', borderRadius: '7px' }}>
                        <Trophy size={11} color="#059669" />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669' }}>Completo!</span>
                    </div>
                )}
            </div>
            <div onClick={onExpand} style={{ padding: '16px 18px 14px', cursor: 'pointer', borderBottom: expanded ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: card.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>{card.tag}</div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{card.title}</h3>
                        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{card.subtitle}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>{done}/{total}</span>
                        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
                            <ChevronDown size={16} color="#94A3B8" />
                        </motion.div>
                    </div>
                </div>
                <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} style={{ height: '100%', background: complete ? '#10B981' : card.color, borderRadius: '4px' }} />
                </div>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '12px 12px 16px' }}>
                            {items.map(item => (
                                <CheckItem key={item.id} item={item} accentColor={card.color} onToggle={() => dispatch({ type: 'TOGGLE_ITEM', intercambioId, doc: card.key, itemId: item.id })} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Pipeline header ──────────────────────────────────────────────────────────

function PipelineHeader({ intercambio }: { intercambio: Intercambio }) {
    const { dispatch } = useC1()
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '32px' }}>
            {STAGES.map((stage, idx) => {
                const unlocked = intercambio.unlockedStages[idx]
                const active = intercambio.activeStage === stage.n
                const completed = unlocked && intercambio.activeStage > stage.n
                const s1done = idx === 0 && intercambio.stage1.completed
                return (
                    <motion.div key={stage.n} whileHover={unlocked ? { y: -2 } : {}}
                        onClick={() => { if (unlocked) dispatch({ type: 'SET_ACTIVE_STAGE', intercambioId: intercambio.id, stage: stage.n }) }}
                        style={{
                            position: 'relative', padding: '14px', borderRadius: '14px',
                            border: `1.5px solid ${active ? stage.color + '50' : unlocked ? '#E2E8F0' : '#F1F5F9'}`,
                            background: active ? `${stage.color}08` : unlocked ? '#fff' : '#FAFAFA',
                            cursor: unlocked ? 'pointer' : 'not-allowed', opacity: unlocked ? 1 : 0.5,
                            transition: 'all 0.25s', boxShadow: active ? `0 0 0 3px ${stage.color}15, 0 4px 16px ${stage.color}20` : '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
                        }}>
                        {active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: stage.color }} />}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: unlocked ? `${stage.color}12` : '#F1F5F9' }}>
                                {unlocked ? <stage.icon size={15} color={stage.color} /> : <Lock size={13} color="#CBD5E1" />}
                            </div>
                            {(completed || s1done) && <CheckCircle2 size={15} color="#10B981" />}
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: active ? stage.color : '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Etapa {stage.n}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: unlocked ? '#0F172A' : '#CBD5E1', marginBottom: '1px' }}>{stage.label}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{stage.sub}</div>
                    </motion.div>
                )
            })}
        </div>
    )
}

// ─── Stage 1 ──────────────────────────────────────────────────────────────────

function Stage1({ intercambio, specialtyOrder, hospitalOrderBySpecialty, onReorderSpec, onReorderHospital, onAddMore, onChangeSpecialties }: {
    intercambio: Intercambio
    specialtyOrder: string[]
    hospitalOrderBySpecialty: Record<string, string[]>
    onReorderSpec: (idx: number, dir: -1 | 1) => void
    onReorderHospital: (spec: string, id: string, dir: -1 | 1) => void
    onAddMore: () => void
    onChangeSpecialties: () => void
}) {
    const { dispatch } = useC1()
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const allItems = [...intercambio.stage1.cv, ...intercambio.stage1.ps, ...intercambio.stage1.lor]
    const totalDone = allItems.filter(i => i.done).length
    const totalItems = allItems.length
    const pct = Math.round((totalDone / totalItems) * 100)
    const allDone = totalDone === totalItems

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <InterestOverview specialtyOrder={specialtyOrder} hospitalOrderBySpecialty={hospitalOrderBySpecialty}
                onReorderSpec={onReorderSpec} onReorderHospital={onReorderHospital}
                onAddMore={onAddMore} onChangeSpecialties={onChangeSpecialties} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={17} color="#3B82F6" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>Construção de Documentos</h2>
                        <p style={{ fontSize: '13px', color: '#64748B' }}>Prepare seu CV, Personal Statement e Letters of Recommendation</p>
                    </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: pct === 100 ? '#059669' : '#3B82F6', lineHeight: 1 }}>{pct}%</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{totalDone}/{totalItems}</div>
                </div>
            </div>

            <div style={{ height: '5px', background: '#F1F5F9', borderRadius: '5px', overflow: 'hidden', marginBottom: '24px' }}>
                <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: '100%', background: pct === 100 ? '#10B981' : 'linear-gradient(90deg, #3B82F6, #6366F1)', borderRadius: '5px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px', alignItems: 'start' }}>
                {DOC_CARDS.map(card => (
                    <DocCard key={card.key} card={card} items={intercambio.stage1[card.key]} intercambioId={intercambio.id}
                        expanded={expanded.has(card.key)} onExpand={() => setExpanded(prev => { const next = new Set(prev); next.has(card.key) ? next.delete(card.key) : next.add(card.key); return next })} />
                ))}
            </div>

            {!intercambio.unlockedStages[1] && (
                <div style={{ background: '#fff', border: `1.5px solid ${allDone ? '#BBF7D0' : '#E2E8F0'}`, borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>{allDone ? 'Todos os documentos prontos! 🎉' : 'Complete todos os checklists para avançar'}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{allDone ? 'Clique para liberar a Etapa 2.' : `${totalItems - totalDone} itens restantes.`}</div>
                    </div>
                    <button onClick={() => { if (allDone) { dispatch({ type: 'MARK_STAGE1_COMPLETE', intercambioId: intercambio.id }); dispatch({ type: 'SET_ACTIVE_STAGE', intercambioId: intercambio.id, stage: 2 }) } }} disabled={!allDone}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '10px', border: 'none', background: allDone ? '#10B981' : '#F1F5F9', color: allDone ? '#fff' : '#94A3B8', fontSize: '13px', fontWeight: 700, cursor: allDone ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => { if (allDone) e.currentTarget.style.background = '#059669' }}
                        onMouseLeave={e => { if (allDone) e.currentTarget.style.background = '#10B981' }}
                    >
                        {allDone ? <><CheckCircle2 size={14} /> Concluir Etapa 1 <ChevronRight size={14} /></> : <>Finalize os checklists</>}
                    </button>
                </div>
            )}
            {intercambio.unlockedStages[1] && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '14px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Trophy size={20} color="#059669" />
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>Etapa 1 concluída!</div>
                        <div style={{ fontSize: '12px', color: '#15803D' }}>A Etapa 2 (Emails / CRM) foi desbloqueada.</div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    )
}

// ─── Stage 2 ─────────────────────────────────────────────────────────────────

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<DoctorStatus, { label: string; color: string; bg: string; dot: string }> = {
    idle:     { label: '',              color: '#94A3B8', bg: '#F8FAFC',  dot: '#CBD5E1' },
    standby:  { label: 'Stand-by',      color: '#94A3B8', bg: '#F1F5F9',  dot: '#CBD5E1' },
    not_sent: { label: 'Na Fila',       color: '#64748B', bg: '#F1F5F9',  dot: '#94A3B8' },
    sent_1:   { label: 'Aguardando',    color: '#2563EB', bg: '#EFF6FF',  dot: '#3B82F6' },
    followup: { label: 'Follow-up',     color: '#D97706', bg: '#FFFBEB',  dot: '#F59E0B' },
    accepted: { label: 'Aceite',        color: '#059669', bg: '#F0FDF4',  dot: '#10B981' },
    rejected: { label: 'Recusado',      color: '#DC2626', bg: '#FEF2F2',  dot: '#EF4444' },
}

const KANBAN_STATUS: DoctorStatus[] = ['not_sent', 'sent_1', 'followup', 'accepted', 'rejected']

const KANBAN_COLS_CFG: { id: DoctorStatus; label: string; icon: typeof Send }[] = [
    { id: 'not_sent', label: 'Para Enviar',          icon: Inbox },
    { id: 'sent_1',   label: 'Aguardando Resposta',  icon: Send },
    { id: 'followup', label: 'Follow-ups',           icon: Clock },
    { id: 'accepted', label: 'Aceite',               icon: CheckCircle },
    { id: 'rejected', label: 'Recusado',             icon: XCircle },
]


// ── Setup Modal ───────────────────────────────────────────────────────────────

function Stage2SetupModal({ onConfirm }: {
    onConfirm: (specialty: string, hospitals: string[]) => void
}) {
    const { state } = useC1()
    const [step, setStep] = useState<'specialty' | 'hospitals'>('specialty')
    const [specialty, setSpecialty] = useState('')

    // All hospitals of interest (from user's intercambios)
    const allHospitalNames = state.intercambios.map(i => i.hospital.name)
    const [checkedHospitals, setCheckedHospitals] = useState<string[]>(allHospitalNames)

    function toggleHospital(name: string) {
        setCheckedHospitals(prev => prev.includes(name) ? prev.filter(h => h !== name) : [...prev, name])
    }

    // User's selected specialties (persisted in context)
    const specialties = state.selectedSpecialties

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
            <AnimatePresence mode="wait">
                {step === 'specialty' ? (
                    <motion.div key="step-a"
                        initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '480px', maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff' }}>1</div>
                            <div style={{ flex: 1, height: '2px', background: '#E2E8F0', borderRadius: '2px' }} />
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#94A3B8' }}>2</div>
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Qual especialidade você escolheu?</h2>
                        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '22px' }}>Especialidade do intercâmbio neste hospital.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '24px' }}>
                            {specialties.map(s => (
                                <button key={s} onClick={() => setSpecialty(s)}
                                    style={{ padding: '10px 14px', borderRadius: '10px', border: `1.5px solid ${specialty === s ? '#2563EB' : '#E2E8F0'}`, background: specialty === s ? '#EFF6FF' : '#FAFAFA', color: specialty === s ? '#2563EB' : '#334155', fontSize: '13px', fontWeight: specialty === s ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { if (specialty) setStep('hospitals') }} disabled={!specialty}
                            style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: specialty ? 'linear-gradient(135deg, #2563EB, #7C3AED)' : '#F1F5F9', color: specialty ? '#fff' : '#94A3B8', fontSize: '14px', fontWeight: 700, cursor: specialty ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            Próximo <ChevronRight size={16} />
                        </button>
                    </motion.div>
                ) : (
                    <motion.div key="step-b"
                        initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '480px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#fff" strokeWidth={3} /></div>
                            <div style={{ flex: 1, height: '2px', background: '#2563EB', borderRadius: '2px' }} />
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#fff' }}>2</div>
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Hospitais de interesse</h2>
                        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '22px' }}>Selecione os hospitais para esta campanha de emails.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                            {state.intercambios.map(i => {
                                const name = i.hospital.name
                                const checked = checkedHospitals.includes(name)
                                return (
                                    <label key={i.id} onClick={() => toggleHospital(name)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '11px', border: `1.5px solid ${checked ? '#BFDBFE' : '#E2E8F0'}`, background: checked ? '#EFF6FF' : '#FAFAFA', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        <div style={{ width: 20, height: 20, borderRadius: '6px', flexShrink: 0, border: `2px solid ${checked ? '#2563EB' : '#CBD5E1'}`, background: checked ? '#2563EB' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                            {checked && <Check size={11} color="#fff" strokeWidth={3} />}
                                        </div>
                                        <img src={i.hospital.coverImage} alt={name} style={{ width: 28, height: 28, borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{i.hospital.shortName}</div>
                                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{i.hospital.city}, {i.hospital.state}</div>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setStep('specialty')} style={{ padding: '12px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ArrowLeft size={14} /> Voltar
                            </button>
                            <button onClick={() => onConfirm(specialty, checkedHospitals)} disabled={checkedHospitals.length === 0}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: checkedHospitals.length > 0 ? 'linear-gradient(135deg, #2563EB, #7C3AED)' : '#F1F5F9', color: checkedHospitals.length > 0 ? '#fff' : '#94A3B8', fontSize: '14px', fontWeight: 700, cursor: checkedHospitals.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <CheckCircle size={15} /> Iniciar Estratégia
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Doctor Detail Modal ───────────────────────────────────────────────────────

function DoctorDetailModal({ doctor, hospitalId, intercambio, onClose }: {
    doctor: Doctor
    hospitalId: string
    intercambio: Intercambio
    onClose: () => void
}) {
    const { dispatch } = useC1()
    const [name, setName] = useState(doctor.name)
    const [title, setTitle] = useState(doctor.title)
    const [emails, setEmails] = useState<string[]>(doctor.emails.length > 0 ? doctor.emails : [''])
    const [notes, setNotes] = useState(doctor.notes)
    const [moveMenuOpen, setMoveMenuOpen] = useState(false)

    function save(extraUpdates?: Partial<Doctor>) {
        dispatch({
            type: 'UPDATE_DOCTOR', intercambioId: intercambio.id, hospitalId, doctorId: doctor.id,
            updates: { name, title, emails: emails.filter(e => e.trim()), notes, ...extraUpdates },
        })
    }

    function addEmail() { setEmails(prev => [...prev, '']) }
    function removeEmail(i: number) { setEmails(prev => prev.filter((_, idx) => idx !== i)) }
    function updateEmail(i: number, val: string) { setEmails(prev => prev.map((e, idx) => idx === i ? val : e)) }

    function activate() {
        save({ status: 'not_sent' })
        onClose()
    }

    function moveTo(status: DoctorStatus) {
        save({ status })
        setMoveMenuOpen(false)
        onClose()
    }

    function toggleFollowUp(fId: string) {
        const updated = doctor.followUps.map(f => f.id === fId ? { ...f, done: !f.done } : f)
        dispatch({ type: 'UPDATE_DOCTOR', intercambioId: intercambio.id, hospitalId, doctorId: doctor.id, updates: { followUps: updated } })
    }

    const cfg = STATUS_CFG[doctor.status]

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) { save(); onClose() } }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                style={{ background: '#fff', borderRadius: '20px', width: '520px', maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 28px 72px rgba(0,0,0,0.2)' }}>

                {/* Header */}
                <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                        <input value={name} onChange={e => setName(e.target.value)}
                            style={{ width: '100%', fontSize: '18px', fontWeight: 800, color: '#0F172A', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', padding: 0 }} />
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Cargo / Especialidade"
                            style={{ width: '100%', fontSize: '13px', color: '#64748B', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', padding: 0, marginTop: '2px' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {doctor.status !== 'idle' && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: '20px' }}>{cfg.label}</span>
                        )}
                        <button onClick={() => { save(); onClose() }} style={{ width: 32, height: 32, borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={14} color="#64748B" />
                        </button>
                    </div>
                </div>

                {/* Hospital tag */}
                <div style={{ padding: '8px 24px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={12} color="#94A3B8" />
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>{intercambio.stage2.hospitalTargets.find(h => h.id === hospitalId)?.name}</span>
                    <span style={{ fontSize: '12px', color: '#CBD5E1', margin: '0 2px' }}>·</span>
                    <Hash size={11} color="#CBD5E1" />
                    <span style={{ fontSize: '12px', color: '#CBD5E1' }}>Prioridade {doctor.priority}</span>
                </div>

                <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Emails */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <AtSign size={13} color="#2563EB" />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>E-mails</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {emails.map((email, i) => (
                                <div key={i} style={{ display: 'flex', gap: '6px' }}>
                                    <input value={email} onChange={e => updateEmail(i, e.target.value)} placeholder="email@hospital.com"
                                        style={{ flex: 1, padding: '9px 12px', borderRadius: '9px', border: '1.5px solid #E2E8F0', background: '#FAFAFA', fontSize: '13px', color: '#0F172A', fontFamily: 'inherit', outline: 'none' }}
                                        onFocus={e => e.target.style.borderColor = '#93C5FD'}
                                        onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                                    {emails.length > 1 && (
                                        <button onClick={() => removeEmail(i)} style={{ width: 34, height: 34, borderRadius: '8px', border: '1px solid #FECACA', background: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                            <X size={12} color="#EF4444" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={addEmail} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '9px', border: '1.5px dashed #E2E8F0', background: 'transparent', color: '#64748B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                <Plus size={12} /> Adicionar e-mail
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <StickyNote size={13} color="#7C3AED" />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observações e Estratégia</span>
                        </div>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anote sua estratégia de abordagem, histórico de contato, dicas..."
                            rows={4}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#FAFAFA', fontSize: '13px', color: '#0F172A', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
                            onFocus={e => e.target.style.borderColor = '#C4B5FD'}
                            onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                    </div>

                    {/* Follow-up checklist */}
                    {doctor.status === 'followup' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                <CalendarDays size={13} color="#D97706" />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Follow-ups</span>
                                <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>Clique na data para editar</span>
                            </div>
                            {doctor.followUps.length === 0 ? (
                                <div style={{ padding: '10px', background: '#FFFBEB', borderRadius: '9px', fontSize: '13px', color: '#92400E' }}>
                                    Defina a data do 1º follow-up para gerar o calendário automático.
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input type="date" defaultValue={new Date().toISOString().split('T')[0]}
                                            id="fu-date-input"
                                            style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #FDE68A', background: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#0F172A' }} />
                                        <button onClick={() => {
                                            const input = document.getElementById('fu-date-input') as HTMLInputElement
                                            const d1 = input.value
                                            const addDays = (from: string, n: number) => { const dt = new Date(from); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0] }
                                            const d2 = addDays(d1, 7); const d3 = addDays(d2, 5); const d4 = addDays(d3, 3); const d5 = addDays(d4, 2)
                                            const fus = [
                                                { id: crypto.randomUUID(), label: '1º Follow-up', date: d1, done: false },
                                                { id: crypto.randomUUID(), label: '2º Follow-up', date: d2, done: false },
                                                { id: crypto.randomUUID(), label: '3º Follow-up', date: d3, done: false },
                                                { id: crypto.randomUUID(), label: '4º Follow-up', date: d4, done: false },
                                                { id: crypto.randomUUID(), label: '5º Follow-up Final', date: d5, done: false },
                                            ]
                                            dispatch({ type: 'UPDATE_DOCTOR', intercambioId: intercambio.id, hospitalId, doctorId: doctor.id, updates: { followUps: fus } })
                                        }}
                                            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                            Gerar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {doctor.followUps.map((fu, idx) => (
                                        <div key={fu.id}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '9px', background: fu.done ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${fu.done ? '#BBF7D0' : '#FDE68A'}` }}>
                                            <div onClick={() => toggleFollowUp(fu.id)} style={{ width: 18, height: 18, borderRadius: '5px', flexShrink: 0, border: `2px solid ${fu.done ? '#10B981' : '#F59E0B'}`, background: fu.done ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                {fu.done && <Check size={10} color="#fff" strokeWidth={3} />}
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: fu.done ? '#6B7280' : '#92400E', textDecoration: fu.done ? 'line-through' : 'none', flex: 1 }}>{fu.label}</span>
                                            <input type="date" value={fu.date}
                                                onChange={e => {
                                                    const newDate = e.target.value
                                                    const addDays = (from: string, n: number) => { const dt = new Date(from); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0] }
                                                    const gaps = [0, 7, 5, 3, 2]
                                                    const updated = doctor.followUps.map((f, i) => {
                                                        if (i < idx) return f
                                                        if (i === idx) return { ...f, date: newDate }
                                                        return { ...f, date: addDays(doctor.followUps[i - 1].date, gaps[i] ?? 3) }
                                                    })
                                                    dispatch({ type: 'UPDATE_DOCTOR', intercambioId: intercambio.id, hospitalId, doctorId: doctor.id, updates: { followUps: updated } })
                                                }}
                                                style={{ padding: '3px 7px', borderRadius: '7px', border: '1px solid #FDE68A', background: 'transparent', fontSize: '11px', color: '#D97706', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer actions */}
                    <div style={{ display: 'flex', gap: '8px', paddingTop: '4px', borderTop: '1px solid #F1F5F9' }}>
                        {doctor.status === 'idle' ? (
                            <button onClick={activate}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                <Send size={15} /> Mover para o Quadro de Ação
                            </button>
                        ) : (
                            <div style={{ flex: 1, position: 'relative' }}>
                                <button onClick={() => setMoveMenuOpen(v => !v)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: `1.5px solid ${cfg.color}40`, background: cfg.bg, color: cfg.color, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                                    {cfg.label} · Mover para...
                                    <ChevronDown size={14} />
                                </button>
                                <AnimatePresence>
                                    {moveMenuOpen && (
                                        <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
                                            style={{ position: 'absolute', bottom: '48px', left: 0, right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '6px', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                                            {KANBAN_STATUS.filter(s => s !== doctor.status).map(s => {
                                                const c = STATUS_CFG[s]
                                                return (
                                                    <button key={s} onClick={() => moveTo(s)}
                                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', color: '#334155', fontWeight: 500 }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.color = c.color }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155' }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                                                        {c.label}
                                                    </button>
                                                )
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                        <button onClick={() => { save(); onClose() }}
                            style={{ padding: '12px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Salvar
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

// ── Add Doctor Modal ──────────────────────────────────────────────────────────

function AddDoctorModal({ hospitalTarget, intercambio, onClose }: {
    hospitalTarget: HospitalTarget
    intercambio: Intercambio
    onClose: () => void
}) {
    const { dispatch } = useC1()
    const [name, setName] = useState('')
    const [title, setTitle] = useState('')
    const [email, setEmail] = useState('')
    const [notes, setNotes] = useState('')

    function handleAdd() {
        if (!name.trim()) return
        dispatch({
            type: 'ADD_DOCTOR_TO_HOSPITAL',
            intercambioId: intercambio.id,
            hospitalId: hospitalTarget.id,
            name: name.trim(),
            title: title.trim(),
            email: email.trim() || undefined,
            notes: notes.trim() || undefined,
        })
        onClose()
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                style={{ background: '#fff', borderRadius: '18px', padding: '28px', width: '440px', maxWidth: '92vw', boxShadow: '0 20px 56px rgba(0,0,0,0.16)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>Adicionar Médico</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building2 size={11} /> {hospitalTarget.name}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={13} color="#64748B" />
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                        { label: 'Nome *', value: name, set: setName, placeholder: 'Dr. Nome Sobrenome', autoFocus: true },
                        { label: 'Cargo', value: title, set: setTitle, placeholder: 'Program Director' },
                        { label: 'E-mail', value: email, set: setEmail, placeholder: 'email@hospital.com' },
                    ].map(f => (
                        <div key={f.label}>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>{f.label}</label>
                            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} autoFocus={f.autoFocus}
                                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                style={{ width: '100%', padding: '10px 13px', borderRadius: '9px', border: '1.5px solid #E2E8F0', background: '#FAFAFA', fontSize: '14px', color: '#0F172A', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                onFocus={e => e.target.style.borderColor = '#93C5FD'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                        </div>
                    ))}
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>Observações</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Estratégia inicial..." rows={2}
                            style={{ width: '100%', padding: '10px 13px', borderRadius: '9px', border: '1.5px solid #E2E8F0', background: '#FAFAFA', fontSize: '13px', color: '#0F172A', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
                            onFocus={e => e.target.style.borderColor = '#C4B5FD'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                    <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    <button onClick={handleAdd} disabled={!name.trim()}
                        style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: name.trim() ? '#2563EB' : '#F1F5F9', color: name.trim() ? '#fff' : '#94A3B8', fontSize: '13px', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                        Adicionar
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ── Doctor Row ────────────────────────────────────────────────────────────────

function DoctorRow({ doctor, hospitalTarget, intercambio, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
    doctor: Doctor
    hospitalTarget: HospitalTarget
    intercambio: Intercambio
    onMoveUp: () => void
    onMoveDown: () => void
    canMoveUp: boolean
    canMoveDown: boolean
}) {
    const { dispatch } = useC1()
    const [modalOpen, setModalOpen] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const cfg = STATUS_CFG[doctor.status]
    const isActive = !['idle', 'standby'].includes(doctor.status)
    const isRejected = doctor.status === 'rejected'

    const hasActiveInHospital = hospitalTarget.doctors.some(
        d => d.id !== doctor.id && !['idle', 'standby', 'accepted', 'rejected'].includes(d.status)
    )

    function dispatch2(updates: Partial<Doctor>) {
        dispatch({ type: 'UPDATE_DOCTOR', intercambioId: intercambio.id, hospitalId: hospitalTarget.id, doctorId: doctor.id, updates })
        setMenuOpen(false)
    }

    function toggleFollowUp(fId: string) {
        const updated = doctor.followUps.map(f => f.id === fId ? { ...f, done: !f.done } : f)
        dispatch2({ followUps: updated })
    }

    return (
        <>
            <motion.div layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '12px', overflow: 'visible', marginBottom: '6px', position: 'relative', opacity: isRejected ? 0.5 : 1 }}
                whileHover={{ borderColor: isRejected ? '#E2E8F0' : '#BFDBFE', boxShadow: isRejected ? 'none' : '0 2px 12px rgba(37,99,235,0.07)' }}>

                {/* Priority + reorder */}
                <div style={{ width: '44px', minHeight: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', flexShrink: 0, borderRight: '1px solid #F1F5F9', padding: '6px 0' }}>
                    {canMoveUp && (
                        <button onClick={e => { e.stopPropagation(); onMoveUp() }}
                            style={{ width: 20, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', padding: 0 }}>
                            <ChevronDown size={11} color="#94A3B8" style={{ transform: 'rotate(180deg)' }} />
                        </button>
                    )}
                    <span style={{ fontSize: '15px', fontWeight: 900, color: isActive ? cfg.color : '#CBD5E1' }}>
                        {doctor.priority}
                    </span>
                    {canMoveDown && (
                        <button onClick={e => { e.stopPropagation(); onMoveDown() }}
                            style={{ width: 20, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', padding: 0 }}>
                            <ChevronDown size={11} color="#94A3B8" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div onClick={() => setModalOpen(true)} style={{ flex: 1, padding: '12px 12px', cursor: 'pointer', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{doctor.name}</span>
                        {doctor.title && <span style={{ fontSize: '11px', color: '#94A3B8' }}>{doctor.title}</span>}
                        {(isActive || doctor.status === 'standby') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 9px', borderRadius: '20px', border: `1px solid ${cfg.color}25` }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                                {cfg.label}
                            </span>
                        )}
                    </div>
                    {doctor.emails.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AtSign size={10} />{doctor.emails[0]}{doctor.emails.length > 1 && ` +${doctor.emails.length - 1}`}
                        </div>
                    )}
                    {/* Inline follow-up checklist */}
                    {doctor.status === 'followup' && doctor.followUps.length > 0 && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {doctor.followUps.map(fu => (
                                <div key={fu.id} onClick={e => { e.stopPropagation(); toggleFollowUp(fu.id) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '7px', background: fu.done ? '#F0FDF4' : '#FFFBEB', cursor: 'pointer' }}>
                                    <div style={{ width: 15, height: 15, borderRadius: '4px', flexShrink: 0, border: `2px solid ${fu.done ? '#10B981' : '#F59E0B'}`, background: fu.done ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {fu.done && <Check size={8} color="#fff" strokeWidth={3} />}
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: fu.done ? '#6B7280' : '#92400E', textDecoration: fu.done ? 'line-through' : 'none', flex: 1 }}>{fu.label}</span>
                                    <span style={{ fontSize: '10px', color: '#D97706' }}>{fu.date}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* "..." menu */}
                <div style={{ padding: '10px 10px 10px 0', position: 'relative' }} ref={menuRef}>
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
                        style={{ width: 30, height: 30, borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <MoreHorizontal size={13} color="#94A3B8" />
                    </button>
                    <AnimatePresence>
                        {menuOpen && (
                            <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                                style={{ position: 'absolute', top: '40px', right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '6px', zIndex: 50, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', minWidth: '190px' }}
                                onClick={e => e.stopPropagation()} onMouseLeave={() => setMenuOpen(false)}>

                                {['idle', 'standby'].includes(doctor.status) ? (
                                    hasActiveInHospital ? (
                                        <div style={{ padding: '10px 12px', fontSize: '12px', color: '#D97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <AlertTriangle size={12} /> Conclua o médico ativo primeiro
                                        </div>
                                    ) : (
                                        <button onClick={() => dispatch2({ status: 'not_sent' })}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#2563EB', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <Send size={12} /> Mover para o Quadro
                                        </button>
                                    )
                                ) : (
                                    <>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', padding: '4px 10px 6px', textTransform: 'uppercase' }}>Mover para</div>
                                        {KANBAN_STATUS.filter(s => s !== doctor.status).map(s => {
                                            const c = STATUS_CFG[s]
                                            return (
                                                <button key={s} onClick={() => dispatch2({ status: s })}
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#334155', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.color = c.color }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155' }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />{c.label}
                                                </button>
                                            )
                                        })}
                                        <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                                        <button onClick={() => dispatch2({ status: 'standby' })}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} /> Stand-by (voltar à lista)
                                        </button>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <AnimatePresence>
                {modalOpen && (
                    <DoctorDetailModal
                        doctor={doctor}
                        hospitalId={hospitalTarget.id}
                        intercambio={intercambio}
                        onClose={() => setModalOpen(false)}
                    />
                )}
            </AnimatePresence>
        </>
    )
}

// ── Hospital Accordion Item ───────────────────────────────────────────────────

function HospitalAccordionItem({ hospitalTarget, intercambio, isOpen, onToggle, onRemove }: {
    hospitalTarget: HospitalTarget
    intercambio: Intercambio
    isOpen: boolean
    onToggle: () => void
    onRemove: () => void
}) {
    const { dispatch } = useC1()
    const [addingDoctor, setAddingDoctor] = useState(false)
    const activeCount = hospitalTarget.doctors.filter(d => d.status !== 'idle').length
    const totalCount = hospitalTarget.doctors.length

    return (
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', marginBottom: '10px' }}>
            {/* Accordion header */}
            <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', cursor: 'pointer', userSelect: 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={16} color="#2563EB" />
                    </div>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>{hospitalTarget.name}</div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>
                            {totalCount} médico{totalCount !== 1 ? 's' : ''} mapeado{totalCount !== 1 ? 's' : ''}
                            {activeCount > 0 && <span style={{ marginLeft: '8px', color: '#2563EB', fontWeight: 600 }}>· {activeCount} ativo{activeCount !== 1 ? 's' : ''}</span>}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* quick status dots */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {hospitalTarget.doctors.map(d => (
                            <span key={d.id} style={{ width: 8, height: 8, borderRadius: '50%', background: d.status === 'idle' ? '#E2E8F0' : STATUS_CFG[d.status].dot }} />
                        ))}
                    </div>
                    <button onClick={e => { e.stopPropagation(); onRemove() }}
                        title="Remover hospital"
                        style={{ width: 26, height: 26, borderRadius: '6px', border: '1px solid #FECACA', background: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
                        onMouseLeave={e => e.currentTarget.style.background = '#FFF1F2'}>
                        <Trash2 size={11} color="#EF4444" />
                    </button>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.22 }}>
                        <ChevronDown size={16} color="#94A3B8" />
                    </motion.div>
                </div>
            </div>

            {/* Expanded doctors list */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F1F5F9' }}>
                            <div style={{ paddingTop: '12px' }}>
                                {(() => {
                                    const activeDocs = hospitalTarget.doctors
                                        .filter(d => d.status !== 'rejected')
                                        .slice().sort((a, b) => a.priority - b.priority)
                                    const rejectedDocs = hospitalTarget.doctors.filter(d => d.status === 'rejected')

                                    function moveDoc(doctorId: string, dir: -1 | 1) {
                                        const sorted = [...activeDocs]
                                        const idx = sorted.findIndex(d => d.id === doctorId)
                                        const swap = idx + dir
                                        if (swap < 0 || swap >= sorted.length) return
                                        const newOrder = sorted.map((d, i) => {
                                            if (i === idx) return { ...d, priority: sorted[swap].priority }
                                            if (i === swap) return { ...d, priority: sorted[idx].priority }
                                            return d
                                        })
                                        newOrder.forEach(d => {
                                            dispatch({ type: 'UPDATE_DOCTOR', intercambioId: intercambio.id, hospitalId: hospitalTarget.id, doctorId: d.id, updates: { priority: d.priority } })
                                        })
                                    }

                                    return (
                                        <>
                                            {activeDocs.length === 0 && rejectedDocs.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px' }}>
                                                    Nenhum médico mapeado ainda.
                                                </div>
                                            )}
                                            {activeDocs.map((doctor, idx) => (
                                                <DoctorRow key={doctor.id} doctor={doctor} hospitalTarget={hospitalTarget} intercambio={intercambio}
                                                    canMoveUp={idx > 0} canMoveDown={idx < activeDocs.length - 1}
                                                    onMoveUp={() => moveDoc(doctor.id, -1)} onMoveDown={() => moveDoc(doctor.id, 1)} />
                                            ))}
                                            {rejectedDocs.length > 0 && (
                                                <>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0 8px' }}>
                                                        <div style={{ height: '1px', flex: 1, background: '#FEE2E2' }} />
                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recusados</span>
                                                        <div style={{ height: '1px', flex: 1, background: '#FEE2E2' }} />
                                                    </div>
                                                    {rejectedDocs.map(doctor => (
                                                        <DoctorRow key={doctor.id} doctor={doctor} hospitalTarget={hospitalTarget} intercambio={intercambio}
                                                            canMoveUp={false} canMoveDown={false} onMoveUp={() => {}} onMoveDown={() => {}} />
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    )
                                })()}
                                <button onClick={() => setAddingDoctor(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px dashed #BFDBFE', background: 'transparent', color: '#2563EB', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px' }}>
                                    <Plus size={14} /> Adicionar médico
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {addingDoctor && (
                <AddDoctorModal hospitalTarget={hospitalTarget} intercambio={intercambio} onClose={() => setAddingDoctor(false)} />
            )}
        </div>
    )
}

// ── Kanban Section 2 ─────────────────────────────────────────────────────────

function KanbanSection({ intercambio }: { intercambio: Intercambio }) {
    const { dispatch } = useC1()
    const allDoctors = intercambio.stage2.hospitalTargets.flatMap(ht =>
        ht.doctors.map(d => ({ ...d, _hospitalName: ht.name, _hospitalId: ht.id }))
    )
    const activeDoctors = allDoctors.filter(d => KANBAN_STATUS.includes(d.status))
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    function moveTo(doctorId: string, hospitalId: string, status: DoctorStatus) {
        dispatch({ type: 'UPDATE_DOCTOR', intercambioId: intercambio.id, hospitalId, doctorId, updates: { status } })
        setOpenMenuId(null)
    }

    const mainCols = KANBAN_COLS_CFG.filter(c => c.id !== 'rejected')
    const rejectedCol = KANBAN_COLS_CFG.find(c => c.id === 'rejected')!

    function renderCol(col: typeof KANBAN_COLS_CFG[number], fullWidth = false) {
        const cards = activeDoctors.filter(d => d.status === col.id)
        const colCfg = STATUS_CFG[col.id]
        return (
            <div key={col.id} style={{ flex: fullWidth ? '1 1 100%' : '1 1 0', minWidth: fullWidth ? 'auto' : '160px', borderRadius: '12px', background: colCfg.bg, border: `1.5px solid ${colCfg.color}20`, padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <col.icon size={12} color={colCfg.color} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: colCfg.color }}>{col.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: colCfg.color, background: colCfg.color + '18', padding: '1px 7px', borderRadius: '20px' }}>{cards.length}</span>
                </div>
                <div style={{ minHeight: '48px' }}>
                    {cards.map(d => {
                        const isAccepted = col.id === 'accepted'
                        return (
                        <motion.div key={d.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            style={{
                                background: isAccepted ? 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)' : '#fff',
                                border: isAccepted ? '1.5px solid #6EE7B7' : '1.5px solid #E2E8F0',
                                borderRadius: '10px', padding: '10px 12px', marginBottom: '6px', position: 'relative',
                            }}
                            whileHover={{ boxShadow: isAccepted ? '0 4px 14px rgba(16,185,129,0.15)' : '0 2px 10px rgba(0,0,0,0.07)', borderColor: colCfg.color + '80' }}>
                            {isAccepted && (
                                <div style={{ position: 'absolute', top: '-1px', left: '12px', right: '12px', height: '2px', background: 'linear-gradient(90deg, #10B981, #6EE7B7)', borderRadius: '0 0 2px 2px' }} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                                <div style={{ minWidth: 0 }}>
                                    {isAccepted && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                            <Trophy size={10} color="#059669" />
                                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#059669', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Aceite confirmado!</span>
                                        </div>
                                    )}
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: isAccepted ? '#065F46' : '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                                    <div style={{ fontSize: '11px', color: isAccepted ? '#059669' : '#94A3B8', marginTop: '1px', fontWeight: isAccepted ? 600 : 400 }}>{d._hospitalName}</div>
                                    {d.emails.length > 0 && (
                                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <AtSign size={9} />{d.emails[0]}
                                        </div>
                                    )}
                                </div>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <button onClick={() => setOpenMenuId(openMenuId === d.id ? null : d.id)}
                                        style={{ width: 24, height: 24, borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <MoreHorizontal size={12} color="#94A3B8" />
                                    </button>
                                    <AnimatePresence>
                                        {openMenuId === d.id && (
                                            <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                                                style={{ position: 'absolute', top: '28px', right: 0, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '11px', padding: '6px', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: '170px' }}
                                                onMouseLeave={() => setOpenMenuId(null)}>
                                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', padding: '3px 10px 5px', textTransform: 'uppercase' }}>Mover para</div>
                                                {KANBAN_STATUS.filter(s => s !== col.id).map(s => {
                                                    const c = STATUS_CFG[s]
                                                    return (
                                                        <button key={s} onClick={() => moveTo(d.id, d._hospitalId, s)}
                                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '7px', border: 'none', background: 'transparent', color: '#334155', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.color = c.color }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155' }}>
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />{c.label}
                                                        </button>
                                                    )
                                                })}
                                                <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                                                <button onClick={() => moveTo(d.id, d._hospitalId, 'standby')}
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '7px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} /> Stand-by
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    )})}
                    {cards.length === 0 && (
                        <div style={{ height: '40px', borderRadius: '8px', border: `1.5px dashed ${colCfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '10px', color: colCfg.color + '60' }}>Vazio</span>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8', whiteSpace: 'nowrap' }}>Quadro de Ação</span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{activeDoctors.length} ativo{activeDoctors.length !== 1 ? 's' : ''}</span>
            </div>

            {activeDoctors.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#FAFAFA', borderRadius: '14px', border: '1.5px dashed #E2E8F0', textAlign: 'center' }}>
                    <Send size={22} color="#CBD5E1" style={{ marginBottom: '10px' }} />
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#94A3B8', marginBottom: '4px' }}>Nenhum médico no quadro ainda</div>
                    <p style={{ fontSize: '13px', color: '#CBD5E1', maxWidth: '280px', lineHeight: 1.6, margin: 0 }}>Use o botão "⋯" em um médico da Seção 1 para ativá-lo.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Top row: 4 columns */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {mainCols.map(col => renderCol(col))}
                    </div>
                    {/* Bottom row: Recusado full width */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {renderCol(rejectedCol, false)}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Stage 2 Main ──────────────────────────────────────────────────────────────

function Stage2({ intercambio }: { intercambio: Intercambio }) {
    const { dispatch } = useC1()
    const [openHospitals, setOpenHospitals] = useState<Set<string>>(new Set(intercambio.stage2.hospitalTargets.map(h => h.id)))
    const [addingHospital, setAddingHospital] = useState(false)
    const [newHospitalName, setNewHospitalName] = useState('')

    function toggleHospital(id: string) {
        setOpenHospitals(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    }

    function handleAddHospital() {
        if (!newHospitalName.trim()) return
        dispatch({ type: 'ADD_TARGET_HOSPITAL', intercambioId: intercambio.id, hospital: newHospitalName.trim() })
        setNewHospitalName('')
        setAddingHospital(false)
    }

    if (!intercambio.stage2.setupDone) {
        return (
            <Stage2SetupModal
                onConfirm={(specialty, hospitals) =>
                    dispatch({ type: 'SETUP_STAGE2', intercambioId: intercambio.id, specialty, hospitals })
                }
            />
        )
    }

    // ── Stats derivadas ───────────────────────────────────────────────────────
    const allDoctors2 = intercambio.stage2.hospitalTargets.flatMap(ht => ht.doctors)
    const totalHospitals = intercambio.stage2.hospitalTargets.length
    const totalDoctors  = allDoctors2.length
    const totalSent     = allDoctors2.filter(d => !['idle', 'standby'].includes(d.status)).length
    const totalAccepted = allDoctors2.filter(d => d.status === 'accepted').length
    const totalFollowup = allDoctors2.filter(d => d.status === 'followup').length

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Mail size={18} color="#2563EB" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>Gestão de Contatos</h2>
                        <p style={{ fontSize: '13px', color: '#64748B' }}>{intercambio.stage2.selectedSpecialty} · {totalHospitals} hospital{totalHospitals !== 1 ? 'is' : ''}</p>
                    </div>
                </div>
                <button style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px', borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#BFDBFE'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
                    <ExternalLink size={13} /> Acessar Templates
                </button>
            </div>

            {/* ── Stats minimalistas ── */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '28px' }}>
                {[
                    { label: 'Hospitais',   value: totalHospitals, color: '#2563EB', bg: '#EFF6FF' },
                    { label: 'Médicos',     value: totalDoctors,   color: '#7C3AED', bg: '#F5F3FF' },
                    { label: 'Enviados',    value: totalSent,      color: '#0284C7', bg: '#F0F9FF' },
                    { label: 'Follow-up',   value: totalFollowup,  color: '#D97706', bg: '#FFFBEB' },
                    { label: 'Aceites',     value: totalAccepted,  color: '#059669', bg: '#F0FDF4' },
                ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '20px', background: s.bg, border: `1px solid ${s.color}20` }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: s.color + 'CC' }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Section 1: Estratégia por Hospital */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8', whiteSpace: 'nowrap' }}>Estratégia por Hospital</span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
            </div>
            <div style={{ marginBottom: '36px' }}>
                {intercambio.stage2.hospitalTargets.map(ht => (
                    <HospitalAccordionItem
                        key={ht.id}
                        hospitalTarget={ht}
                        intercambio={intercambio}
                        isOpen={openHospitals.has(ht.id)}
                        onToggle={() => toggleHospital(ht.id)}
                        onRemove={() => dispatch({ type: 'REMOVE_HOSPITAL_TARGET', intercambioId: intercambio.id, hospitalId: ht.id })}
                    />
                ))}

                {/* Add hospital */}
                <AnimatePresence>
                    {addingHospital ? (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <input autoFocus value={newHospitalName} onChange={e => setNewHospitalName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddHospital(); if (e.key === 'Escape') setAddingHospital(false) }}
                                placeholder="Nome do hospital..."
                                style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #BFDBFE', background: '#F8FAFC', fontSize: '13px', color: '#0F172A', fontFamily: 'inherit', outline: 'none' }}
                                onFocus={e => e.target.style.borderColor = '#93C5FD'} onBlur={e => e.target.style.borderColor = '#BFDBFE'} />
                            <button onClick={handleAddHospital}
                                style={{ padding: '9px 14px', borderRadius: '10px', border: 'none', background: '#2563EB', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                <Check size={14} />
                            </button>
                            <button onClick={() => setAddingHospital(false)}
                                style={{ padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                <X size={14} />
                            </button>
                        </motion.div>
                    ) : (
                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setAddingHospital(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1.5px dashed #CBD5E1', background: 'transparent', color: '#94A3B8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.color = '#2563EB' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#94A3B8' }}>
                            <Plus size={12} /> Adicionar hospital
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Section 2: Quadro de Ação (Kanban) */}
            <KanbanSection intercambio={intercambio} />
        </motion.div>
    )
}

// ── Onboarding static data ────────────────────────────────────────────────────

const MENTOR_CATALOG: Record<string, { name: string; photo: string; specialty: string; whatsapp: string }> = {
    cleveland:       { name: 'Dr. Rafael Moura',    photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80', specialty: 'Cardiologia',     whatsapp: '5511991001001' },
    mayo:            { name: 'Dra. Beatriz Santos',  photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80', specialty: 'Med. Interna',    whatsapp: '5511991002002' },
    jhopkins:        { name: 'Dr. Pedro Alves',      photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&q=80', specialty: 'Neurologia',     whatsapp: '5511991003003' },
    mgh:             { name: 'Dra. Ana Lima',         photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&q=80', specialty: 'Psiquiatria',    whatsapp: '5511991004004' },
    nyp:             { name: 'Dr. Carlos Souza',     photo: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&q=80', specialty: 'Cirurgia',       whatsapp: '5511991005005' },
    ucsf:            { name: 'Dra. Marina Faria',    photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80', specialty: 'Neurociências',   whatsapp: '5511991006006' },
    mdanderson:      { name: 'Dr. João Mendes',      photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80', specialty: 'Oncologia',      whatsapp: '5511991007007' },
    msk:             { name: 'Dra. Fernanda Ramos',  photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&q=80', specialty: 'Oncologia',      whatsapp: '5511991010010' },
    cedars:          { name: 'Dr. Thiago Oliveira',  photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&q=80', specialty: 'Cardiologia',    whatsapp: '5511991011011' },
    nyulangone:      { name: 'Dra. Juliana Pereira', photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80', specialty: 'Neurologia',     whatsapp: '5511991012012' },
    stanford:        { name: 'Dra. Camila Torres',   photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&q=80', specialty: 'Cardiologia',    whatsapp: '5511991008008' },
    northwestern:    { name: 'Dr. Bruno Costa',      photo: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&q=80', specialty: 'Transplante',    whatsapp: '5511991009009' },
    barnesjewish:    { name: 'Dr. Marcos Andrade',   photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80', specialty: 'Medicina Interna', whatsapp: '5511991013013' },
    umichigan:       { name: 'Dra. Renata Campos',   photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&q=80', specialty: 'Oncologia',      whatsapp: '5511991014014' },
    duke:            { name: 'Dr. Vitor Nascimento',  photo: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&q=80', specialty: 'Neurologia',     whatsapp: '5511991015015' },
    bostonchildrens: { name: 'Dra. Lara Monteiro',   photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80', specialty: 'Pediatria',      whatsapp: '5511991016016' },
    chop:            { name: 'Dr. Felipe Barbosa',   photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&q=80', specialty: 'Pediatria',      whatsapp: '5511991017017' },
    texaschildrens:  { name: 'Dra. Gabriela Dias',   photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&q=80', specialty: 'Pediatria',      whatsapp: '5511991018018' },
    danafar:         { name: 'Dr. André Fonseca',    photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80', specialty: 'Oncologia',      whatsapp: '5511991019019' },
    ucla:            { name: 'Dra. Patrícia Vieira',  photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80', specialty: 'Transplante',    whatsapp: '5511991020020' },
    default:         { name: 'Dr. Lucas Ferreira',   photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80', specialty: 'Medicina',       whatsapp: '5511991000000' },
}

const ONBOARDING_CATEGORIES = [
    {
        id: 'saude',
        category: 'Saúde',
        cover: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&q=80',
        color: '#10B981',
        bg: '#F0FDF4',
        items: [
            { id: 'ob_s1', label: 'PPD (Tuberculin Skin Test) ou IGRA realizado e documentado' },
            { id: 'ob_s2', label: 'Vacinação completa (MMR, Varicela, Hepatite B, Influenza)' },
            { id: 'ob_s3', label: 'Seguro Saúde Internacional ativo para todo o período' },
        ],
    },
    {
        id: 'seguros',
        category: 'Seguros',
        cover: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80',
        color: '#3B82F6',
        bg: '#EFF6FF',
        items: [
            { id: 'ob_sg1', label: 'Seguro Malpractice contratado (mín. USD 1M/3M de cobertura)' },
            { id: 'ob_sg2', label: 'Seguro Viagem com cobertura médica' },
        ],
    },
    {
        id: 'vistos',
        category: 'Vistos & Docs',
        cover: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
        color: '#8B5CF6',
        bg: '#F5F3FF',
        items: [
            { id: 'ob_v1', label: 'Passaporte válido (mín. 6 meses após o término)' },
            { id: 'ob_v2', label: 'Visto americano aprovado (B-1/B-2 ou J-1)' },
            { id: 'ob_v3', label: 'Carta de confirmação do hospital em mãos' },
            { id: 'ob_v4', label: 'Formulário de aplicação do hospital enviado' },
        ],
    },
]

const STATUS_CYCLE: OnboardingItemStatus[] = ['pending', 'in_hand', 'sent']
const ITEM_STATUS_CFG: Record<OnboardingItemStatus, { label: string; color: string; bg: string; dot: string }> = {
    pending: { label: 'Pendente',            color: '#94A3B8', bg: '#F8FAFC', dot: '#CBD5E1' },
    in_hand: { label: 'Documento em mãos',  color: '#D97706', bg: '#FFFBEB', dot: '#F59E0B' },
    sent:    { label: 'Enviado ao Hospital', color: '#059669', bg: '#F0FDF4', dot: '#10B981' },
}

// ── Stage 3 — Onboarding ──────────────────────────────────────────────────────

function Stage3({ intercambio }: { intercambio: Intercambio }) {
    const { dispatch } = useC1()
    const [expandedCat, setExpandedCat] = useState<string | null>(null)

    const acceptedByHospital = intercambio.stage2.hospitalTargets
        .map(ht => ({ ht, accepted: ht.doctors.filter(d => d.status === 'accepted') }))
        .filter(g => g.accepted.length > 0)

    // Pick mentor based on first accepted hospital ID
    const firstHospitalId = intercambio.hospital.id
    const mentor = MENTOR_CATALOG[firstHospitalId] ?? MENTOR_CATALOG.default

    function cycleStatus(itemId: string) {
        const current = intercambio.stage3.itemStatuses[itemId] ?? 'pending'
        const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length
        dispatch({ type: 'SET_STAGE3_ITEM_STATUS', intercambioId: intercambio.id, itemId, status: STATUS_CYCLE[nextIdx] })
    }

    // Progress across all onboarding items
    const allItems = ONBOARDING_CATEGORIES.flatMap(c => c.items)
    const sentCount = allItems.filter(i => (intercambio.stage3.itemStatuses[i.id] ?? 'pending') === 'sent').length

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

            {/* ── Mentor card ── */}
            <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)', borderRadius: '16px', padding: '20px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <img src={mentor.photo} alt={mentor.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>Mentor C1% · {mentor.specialty}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '2px' }}>{mentor.name}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>Já rodou neste hospital · disponível para tirar dúvidas</div>
                </div>
                <a href={`https://wa.me/${mentor.whatsapp}?text=Olá ${mentor.name}, tenho dúvidas sobre a papelada do intercâmbio!`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 18px', borderRadius: '11px', background: '#25D366', color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Falar com {mentor.name.split(' ')[0]}
                </a>
            </div>

            {/* ── Aceites por hospital ── */}
            {acceptedByHospital.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8' }}>Aceites Confirmados</span>
                        <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {acceptedByHospital.map(({ ht, accepted }) => {
                            const note = intercambio.stage3.onboardingNotes[ht.id] ?? ''
                            return (
                                <div key={ht.id} style={{ background: '#fff', border: '1.5px solid #BBF7D0', borderRadius: '14px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0' }}>
                                        <Building2 size={14} color="#059669" />
                                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#065F46', flex: 1 }}>{ht.name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #BBF7D0', borderRadius: '20px', padding: '2px 9px' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669' }}>{accepted.length} aceite{accepted.length > 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                    <div style={{ padding: '10px 16px 0' }}>
                                        {accepted.map(d => (
                                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #F0FDF4' }}>
                                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F0FDF4', border: '1.5px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669' }}>{d.name.charAt(0)}</span>
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{d.name}</div>
                                                    {d.title && <div style={{ fontSize: '11px', color: '#94A3B8' }}>{d.title}</div>}
                                                </div>
                                                {d.emails[0] && <div style={{ fontSize: '10px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px' }}><AtSign size={9} />{d.emails[0]}</div>}
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ padding: '10px 16px 14px' }}>
                                        <textarea value={note}
                                            onChange={e => dispatch({ type: 'UPDATE_ONBOARDING_NOTE', intercambioId: intercambio.id, hospitalId: ht.id, note: e.target.value })}
                                            placeholder="Como está encaminhando? Ex: Aguardando formulário, enviado CV em 15/03..."
                                            rows={2}
                                            style={{ width: '100%', padding: '8px 11px', borderRadius: '9px', border: '1.5px solid #BBF7D0', background: '#F0FDF4', fontSize: '12px', color: '#0F172A', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
                                            onFocus={e => e.target.style.borderColor = '#6EE7B7'} onBlur={e => e.target.style.borderColor = '#BBF7D0'} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Document checklist grid ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8' }}>Documentos & Papelada</span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{sentCount}/{allItems.length} enviados</span>
            </div>

            {/* Overall progress bar */}
            <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
                <motion.div animate={{ width: `${(sentCount / allItems.length) * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ height: '100%', background: sentCount === allItems.length ? '#10B981' : 'linear-gradient(90deg, #F59E0B, #10B981)', borderRadius: '4px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', alignItems: 'start' }}>
                {ONBOARDING_CATEGORIES.map(cat => {
                    const catSent = cat.items.filter(i => (intercambio.stage3.itemStatuses[i.id] ?? 'pending') === 'sent').length
                    const catPct = Math.round((catSent / cat.items.length) * 100)
                    const isExpanded = expandedCat === cat.id
                    return (
                        <div key={cat.id} style={{ background: '#fff', border: `1.5px solid ${isExpanded ? cat.color + '40' : '#E2E8F0'}`, borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.25s, box-shadow 0.25s', boxShadow: isExpanded ? `0 0 0 3px ${cat.color}10, 0 8px 24px rgba(0,0,0,0.07)` : '0 1px 4px rgba(0,0,0,0.04)' }}>
                            {/* Cover */}
                            <div onClick={() => setExpandedCat(isExpanded ? null : cat.id)} style={{ position: 'relative', height: '140px', overflow: 'hidden', cursor: 'pointer' }}>
                                <img src={cat.cover} alt={cat.category} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', transform: isExpanded ? 'scale(1.04)' : 'scale(1)' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(255,255,255,0.88) 100%)' }} />
                                {/* Status dot top-right */}
                                <div style={{ position: 'absolute', top: '10px', right: '10px', width: 10, height: 10, borderRadius: '50%', background: catPct === 100 ? '#10B981' : catPct > 0 ? '#F59E0B' : '#CBD5E1', boxShadow: '0 0 0 2px #fff' }} />
                                {catPct === 100 && (
                                    <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '4px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 8px', borderRadius: '6px' }}>
                                        <Trophy size={10} color="#059669" />
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669' }}>Completo</span>
                                    </div>
                                )}
                            </div>

                            {/* Card header */}
                            <div onClick={() => setExpandedCat(isExpanded ? null : cat.id)} style={{ padding: '14px 16px 12px', cursor: 'pointer', borderBottom: isExpanded ? '1px solid #F1F5F9' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: cat.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Categoria</div>
                                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{cat.category}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>{catSent}/{cat.items.length}</span>
                                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.22 }}>
                                            <ChevronDown size={15} color="#94A3B8" />
                                        </motion.div>
                                    </div>
                                </div>
                                <div style={{ height: '3px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                                    <motion.div animate={{ width: `${catPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }}
                                        style={{ height: '100%', background: catPct === 100 ? '#10B981' : cat.color, borderRadius: '3px' }} />
                                </div>
                            </div>

                            {/* Expanded items */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} style={{ overflow: 'hidden' }}>
                                        <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {cat.items.map(item => {
                                                const st = intercambio.stage3.itemStatuses[item.id] ?? 'pending'
                                                const cfg = ITEM_STATUS_CFG[st]
                                                return (
                                                    <motion.div key={item.id} layout
                                                        onClick={() => cycleStatus(item.id)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', background: cfg.bg, border: `1px solid ${cfg.dot}30`, transition: 'all 0.2s' }}
                                                        whileHover={{ opacity: 0.85 }}>
                                                        {/* Status indicator — 3-state */}
                                                        <div style={{ width: 28, height: 28, borderRadius: '7px', background: '#fff', border: `2px solid ${cfg.dot}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                                                            {st === 'pending' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#CBD5E1' }} />}
                                                            {st === 'in_hand' && <span style={{ fontSize: '12px' }}>📄</span>}
                                                            {st === 'sent'    && <Check size={13} color="#059669" strokeWidth={3} />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '12px', fontWeight: 600, color: st === 'sent' ? '#6B7280' : '#334155', lineHeight: 1.4, textDecoration: st === 'sent' ? 'line-through' : 'none' }}>{item.label}</div>
                                                            <div style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, marginTop: '1px' }}>{cfg.label}</div>
                                                        </div>
                                                        <ChevronRight size={11} color={cfg.dot} style={{ flexShrink: 0, opacity: 0.6 }} />
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>

            {acceptedByHospital.length === 0 && (
                <div style={{ marginTop: '28px', padding: '16px 20px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', color: '#92400E', margin: 0, lineHeight: 1.5 }}>
                        Você ainda não tem aceites na Etapa 2. Assim que um médico aceitar, o acompanhamento aparecerá aqui.
                    </p>
                </div>
            )}
        </motion.div>
    )
}

// ─── Stage 4 static data ──────────────────────────────────────────────────────

const HOUSING_LISTINGS = [
    {
        id: 'h1',
        title: 'Studio a 5 min da Mayo Clinic',
        address: 'Rochester, MN · 3 min de ônibus',
        price: '$850/mês',
        roommate: true,
        safetyStars: 5,
        author: 'Ana Paula Silva',
        avatar: 'AP',
        whatsapp: '5511999990001',
        photos: [
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
            'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800&q=80',
            'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800&q=80',
        ],
    },
    {
        id: 'h2',
        title: 'Quarto em apt. compartilhado perto da Cleveland Clinic',
        address: 'Cleveland, OH · 8 min a pé',
        price: '$600/mês',
        roommate: false,
        safetyStars: 4,
        author: 'Bruno Carvalho',
        avatar: 'BC',
        whatsapp: '5521999990002',
        photos: [
            'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
        ],
    },
    {
        id: 'h3',
        title: '1-Bedroom próximo ao Johns Hopkins Hospital',
        address: 'Baltimore, MD · 10 min de Uber',
        price: '$1.100/mês',
        roommate: true,
        safetyStars: 4,
        author: 'Camila Torres',
        avatar: 'CT',
        whatsapp: '5531999990003',
        photos: [
            'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&q=80',
            'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80',
        ],
    },
]

const EXIT_ITEMS = [
    { id: 'exit_esim',     label: 'Chip de Celular (e-SIM)',        detail: 'T-Mobile ou Google Fi — cobertura total nos EUA',          icon: '📱', color: '#3B82F6' },
    { id: 'exit_card',     label: 'Ativar Cartão Global',           detail: 'Nomad, Wise ou C6 Global — sem IOF e câmbio direto',        icon: '💳', color: '#8B5CF6' },
    { id: 'exit_insurance',label: 'Seguro Viagem',                  detail: 'Cobertura mínima USD 100k, válido nos EUA',                 icon: '🛡️', color: '#10B981' },
    { id: 'exit_currency', label: 'Dinheiro em Espécie',            detail: 'USD 200-500 para os primeiros dias (táxi, alimentação)',    icon: '💵', color: '#F59E0B' },
    { id: 'exit_docs',     label: 'Cópias Digitais dos Documentos', detail: 'Passaporte, visto, carta de aceite — na nuvem e offline',   icon: '☁️', color: '#6366F1' },
    { id: 'exit_emergency',label: 'Contatos de Emergência',         detail: 'Embaixada do Brasil nos EUA: +1 (202) 238-2700',           icon: '📞', color: '#EF4444' },
]

const STAGE4_GALLERY = [
    { id: 'flights'   as const, title: 'Organizar Voos',      subtitle: 'Milhas, rotas e reservas',       cover: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80', color: '#2563EB', badge: 'FlyWise'    },
    { id: 'housing'   as const, title: 'Housing Match',       subtitle: 'Moradia da comunidade C1%',      cover: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80', color: '#10B981', badge: 'Comunidade' },
    { id: 'checklist' as const, title: 'Checklist de Saída',  subtitle: 'Tudo que você precisa levar',    cover: 'https://images.unsplash.com/photo-1553913861-c0fddf2619ee?w=800&q=80', color: '#F59E0B', badge: 'Prático'    },
]

const MOCK_SAVED_FLIGHTS = [
    { id: 'f1', route: 'GRU → CLE', airline: 'LATAM + United', stops: '1 conexão', price: '$1.240', miles: '85.000 Smiles', date: '12 Jun 2025', status: 'Salvo' },
    { id: 'f2', route: 'GRU → CLE', airline: 'American Airlines', stops: 'Direto', price: '$1.580', miles: '70.000 AAdvantage', date: '14 Jun 2025', status: 'Monitorando' },
]

type Stage4Section = 'flights' | 'housing' | 'checklist' | null

// ─── Housing card with photo carousel ────────────────────────────────────────

function HousingCard({ listing }: { listing: typeof HOUSING_LISTINGS[number] }) {
    const [photoIdx, setPhotoIdx] = useState(0)
    return (
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {/* Photo carousel */}
            <div style={{ position: 'relative', height: '220px', overflow: 'hidden', background: '#F1F5F9' }}>
                <AnimatePresence mode="wait">
                    <motion.img
                        key={photoIdx}
                        src={listing.photos[photoIdx]}
                        alt={listing.title}
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.28 }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                    />
                </AnimatePresence>
                {/* Prev / Next */}
                {listing.photos.length > 1 && (
                    <>
                        <button onClick={() => setPhotoIdx(p => (p - 1 + listing.photos.length) % listing.photos.length)}
                            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowLeft size={13} color="#334155" />
                        </button>
                        <button onClick={() => setPhotoIdx(p => (p + 1) % listing.photos.length)}
                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowRight size={13} color="#334155" />
                        </button>
                    </>
                )}
                {/* Dots */}
                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
                    {listing.photos.map((_, i) => (
                        <div key={i} onClick={() => setPhotoIdx(i)}
                            style={{ width: i === photoIdx ? 16 : 6, height: 6, borderRadius: '3px', background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s', cursor: 'pointer' }} />
                    ))}
                </div>
            </div>
            {/* Content */}
            <div style={{ padding: '16px 18px 18px' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px', lineHeight: 1.3 }}>{listing.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px' }}>
                    <MapPin size={11} color="#94A3B8" />
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>{listing.address}</span>
                </div>
                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>{listing.price}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0' }}>{'⭐'.repeat(listing.safetyStars)} Segurança</span>
                    {listing.roommate && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>Roommate disponível</span>}
                </div>
                {/* Author + CTA */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7' }}>{listing.avatar}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>Postado por</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{listing.author}</div>
                    </div>
                    <a href={`https://wa.me/${listing.whatsapp}?text=Olá ${listing.author.split(' ')[0]}! Vi sua moradia no Fly Wise e tenho interesse.`}
                        target="_blank" rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', background: '#25D366', color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                    </a>
                </div>
            </div>
        </div>
    )
}

// ─── Stage 4 — Pré-Embarque ───────────────────────────────────────────────────

function Stage4({ intercambio }: { intercambio: Intercambio }) {
    const { dispatch } = useC1()
    const navigate = useNavigate()
    const [activeSection, setActiveSection] = useState<Stage4Section>(null)
    const [showHousingForm, setShowHousingForm] = useState(false)
    const [exitDone, setExitDone] = useState<Record<string, boolean>>({})
    const [housingForm, setHousingForm] = useState({ title: '', address: '', price: '', whatsapp: '' })

    // Progress for each gallery card
    const exitDoneCount = EXIT_ITEMS.filter(i => exitDone[i.id]).length
    const packDoneCount = intercambio.stage4.packingList.filter(p => p.done).length
    const totalChecklist = EXIT_ITEMS.length + intercambio.stage4.packingList.length
    const checklistPct = Math.round(((exitDoneCount + packDoneCount) / totalChecklist) * 100)

    function DetailHeader({ title, color }: { title: string; color: string }) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <button onClick={() => setActiveSection(null)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                    <ArrowLeft size={15} color="#334155" />
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Etapa 4 · Pré-Embarque</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{title}</div>
                </div>
            </div>
        )
    }

    // ── Gallery ──────────────────────────────────────────────────────────────
    if (!activeSection) {
        return (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div style={{ marginBottom: '22px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Pré-Embarque</h3>
                    <p style={{ fontSize: '14px', color: '#64748B' }}>Organize tudo antes de embarcar para o intercâmbio.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                    {STAGE4_GALLERY.map((card, i) => {
                        const pct = card.id === 'checklist' ? checklistPct : 0
                        return (
                            <motion.div key={card.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.32 }}
                                onClick={() => setActiveSection(card.id)}
                                style={{ background: '#fff', border: `1.5px solid ${card.color}30`, borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                                {/* Cover */}
                                <div style={{ position: 'relative', height: '160px', overflow: 'hidden' }}>
                                    <img src={card.cover} alt={card.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.35) 100%)' }} />
                                    <div style={{ position: 'absolute', top: '12px', left: '12px', fontSize: '10px', fontWeight: 800, color: '#fff', background: `${card.color}CC`, padding: '3px 9px', borderRadius: '6px', letterSpacing: '0.06em' }}>{card.badge}</div>
                                    {card.id === 'checklist' && pct === 100 && (
                                        <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 8px', borderRadius: '6px' }}>
                                            <Trophy size={10} color="#059669" />
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669' }}>Completo</span>
                                        </div>
                                    )}
                                </div>
                                {/* Info */}
                                <div style={{ padding: '14px 16px 16px' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '2px' }}>{card.title}</div>
                                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: card.id === 'checklist' ? '10px' : '0' }}>{card.subtitle}</div>
                                    {card.id === 'checklist' && (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{exitDoneCount + packDoneCount}/{totalChecklist} itens</span>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: card.color }}>{pct}%</span>
                                            </div>
                                            <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                                                <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                                                    style={{ height: '100%', background: pct === 100 ? '#10B981' : card.color, borderRadius: '4px' }} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            </motion.div>
        )
    }

    // ── Flights detail ────────────────────────────────────────────────────────
    if (activeSection === 'flights') {
        return (
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                <DetailHeader title="Organizar Voos" color="#2563EB" />

                {/* Hero */}
                <div style={{ position: 'relative', height: '180px', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
                    <img src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80" alt="Aviação" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(37,99,235,0.75) 0%, rgba(0,0,0,0.3) 100%)' }} />
                    <div style={{ position: 'absolute', bottom: '18px', left: '20px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>FlyWise · Integração</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>Seus Voos</div>
                    </div>
                </div>

                {/* Milhas vs Dinheiro widget */}
                <div style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)', border: '1.5px solid #BFDBFE', borderRadius: '16px', padding: '18px 20px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Comparativo de Custo · GRU → CLE</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #BFDBFE', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Em Milhas</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563EB' }}>70k</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>AAdvantage</div>
                            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>≈ R$ 1.400 em compra</div>
                        </div>
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '14px', border: '1px solid #DDD6FE', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Em Dinheiro</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#7C3AED' }}>$1.580</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>American Airlines</div>
                            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>≈ R$ 9.480 hoje</div>
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Trophy size={14} color="#059669" />
                        <span style={{ fontSize: '12px', color: '#065F46', fontWeight: 600 }}>Usar milhas economiza até R$ 8.080 nesta rota.</span>
                    </div>
                </div>

                {/* Saved flights */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8' }}>Voos Salvos</span>
                    <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {MOCK_SAVED_FLIGHTS.map(f => (
                        <div key={f.id} style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Plane size={16} color="#2563EB" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>{f.route}</div>
                                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{f.airline} · {f.stops} · {f.date}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: '#2563EB' }}>{f.price}</div>
                                <div style={{ fontSize: '10px', color: '#94A3B8' }}>{f.miles}</div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: f.status === 'Salvo' ? '#059669' : '#D97706', marginTop: '2px' }}>{f.status}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <button onClick={() => navigate('/home')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '15px 22px', borderRadius: '13px', border: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
                    <Plane size={16} />
                    Buscar novas rotas no FlyWise
                </button>
            </motion.div>
        )
    }

    // ── Housing detail ────────────────────────────────────────────────────────
    if (activeSection === 'housing') {
        return (
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                <DetailHeader title="Housing Match" color="#10B981" />

                {/* Add housing CTA */}
                <AnimatePresence>
                    {showHousingForm ? (
                        <motion.div key="form" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '16px', padding: '18px 20px', marginBottom: '24px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#065F46', marginBottom: '14px' }}>Cadastrar minha moradia</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {[
                                    { key: 'title',    placeholder: 'Título (ex: Studio a 5 min da Mayo Clinic)', label: 'Título' },
                                    { key: 'address',  placeholder: 'Cidade, Estado · distância do hospital',      label: 'Endereço' },
                                    { key: 'price',    placeholder: 'Ex: $900/mês',                                label: 'Valor' },
                                    { key: 'whatsapp', placeholder: 'WhatsApp com DDI (ex: 5511999999999)',        label: 'WhatsApp' },
                                ].map(f => (
                                    <input key={f.key} placeholder={f.placeholder} value={housingForm[f.key as keyof typeof housingForm]}
                                        onChange={e => setHousingForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        style={{ padding: '9px 12px', borderRadius: '9px', border: '1.5px solid #BBF7D0', background: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', color: '#0F172A' }} />
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                                <button onClick={() => { setHousingForm({ title: '', address: '', price: '', whatsapp: '' }); setShowHousingForm(false) }}
                                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #BBF7D0', background: '#fff', color: '#94A3B8', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Cancelar
                                </button>
                                <button onClick={() => setShowHousingForm(false)}
                                    style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: '#10B981', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Publicar moradia
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.button key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowHousingForm(true)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px 20px', borderRadius: '13px', border: '2px dashed #BBF7D0', background: '#F0FDF4', color: '#059669', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '24px' }}>
                            <Plus size={15} /> Cadastrar minha moradia
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Feed */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {HOUSING_LISTINGS.map(listing => (
                        <HousingCard key={listing.id} listing={listing} />
                    ))}
                </div>
            </motion.div>
        )
    }

    // ── Checklist detail ──────────────────────────────────────────────────────
    return (
        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
            <DetailHeader title="Checklist de Saída" color="#F59E0B" />

            {/* Progress */}
            <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: '14px', padding: '14px 18px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>{exitDoneCount + packDoneCount} de {totalChecklist} itens concluídos</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#D97706' }}>{checklistPct}%</span>
                </div>
                <div style={{ height: '6px', background: '#FEF3C7', borderRadius: '6px', overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${checklistPct}%` }} transition={{ duration: 0.6 }}
                        style={{ height: '100%', background: checklistPct === 100 ? '#10B981' : 'linear-gradient(90deg, #F59E0B, #EF4444)', borderRadius: '6px' }} />
                </div>
            </div>

            {/* Essential exit items */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8' }}>Essenciais de Viagem</span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '28px' }}>
                {EXIT_ITEMS.map(item => {
                    const done = exitDone[item.id] ?? false
                    return (
                        <div key={item.id} onClick={() => setExitDone(prev => ({ ...prev, [item.id]: !done }))}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: done ? '#F0FDF4' : '#fff', border: `1.5px solid ${done ? '#BBF7D0' : '#E2E8F0'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '9px', background: done ? '#D1FAE5' : `${item.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, transition: 'all 0.2s' }}>
                                {done ? <Check size={16} color="#059669" strokeWidth={3} /> : item.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: done ? '#6B7280' : '#0F172A', textDecoration: done ? 'line-through' : 'none', transition: 'all 0.2s' }}>{item.label}</div>
                                <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.4 }}>{item.detail}</div>
                            </div>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${done ? '#10B981' : '#CBD5E1'}`, background: done ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                                {done && <Check size={11} color="#fff" strokeWidth={3} />}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Packing list */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8' }}>O que levar na mala</span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{packDoneCount}/{intercambio.stage4.packingList.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {intercambio.stage4.packingList.map(item => (
                    <div key={item.id} onClick={() => dispatch({ type: 'TOGGLE_PACKING', intercambioId: intercambio.id, itemId: item.id })}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '12px', background: item.done ? '#F0FDF4' : '#fff', border: `1.5px solid ${item.done ? '#BBF7D0' : '#E2E8F0'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${item.done ? '#10B981' : '#CBD5E1'}`, background: item.done ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                            {item.done && <Check size={11} color="#fff" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: '13px', color: item.done ? '#6B7280' : '#334155', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4, transition: 'all 0.2s' }}>{item.label}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    )
}

function StageLocked({ stage }: { stage: typeof STAGES[number] }) {
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '14px', background: '#F8FAFC', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Lock size={22} color="#CBD5E1" />
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#94A3B8', marginBottom: '6px' }}>Etapa {stage.n} bloqueada</div>
            <div style={{ fontSize: '14px', color: '#CBD5E1', maxWidth: '280px', lineHeight: 1.6 }}>Complete a etapa anterior para desbloquear <strong style={{ color: '#94A3B8' }}>{stage.label}</strong>.</div>
        </motion.div>
    )
}

function StageComingSoon({ stage }: { stage: typeof STAGES[number] }) {
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '14px', background: `${stage.color}10`, border: `1.5px solid ${stage.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <stage.icon size={22} color={stage.color} />
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Etapa {stage.n} — {stage.label}</div>
            <div style={{ fontSize: '14px', color: '#64748B', maxWidth: '300px', lineHeight: 1.6 }}>Em breve o conteúdo completo estará disponível aqui.</div>
        </motion.div>
    )
}

// ─── Pipeline view ────────────────────────────────────────────────────────────

function PipelineView({ specialtyOrder, hospitalOrderBySpecialty, onReorderSpec, onReorderHospital, onAddMore, onChangeSpecialties }: {
    specialtyOrder: string[]
    hospitalOrderBySpecialty: Record<string, string[]>
    onReorderSpec: (idx: number, dir: -1 | 1) => void
    onReorderHospital: (spec: string, id: string, dir: -1 | 1) => void
    onAddMore: () => void
    onChangeSpecialties: () => void
}) {
    const { state, activeIntercambio } = useC1()
    const intercambio = activeIntercambio ?? state.intercambios[0]
    const activeStageIdx = intercambio.activeStage - 1
    const activeStageConfig = STAGES[activeStageIdx]
    const unlocked = intercambio.unlockedStages[activeStageIdx]

    function renderStageContent() {
        if (!unlocked) return <StageLocked stage={activeStageConfig} />
        if (intercambio.activeStage === 1) return (
            <Stage1 intercambio={intercambio} specialtyOrder={specialtyOrder} hospitalOrderBySpecialty={hospitalOrderBySpecialty}
                onReorderSpec={onReorderSpec} onReorderHospital={onReorderHospital}
                onAddMore={onAddMore} onChangeSpecialties={onChangeSpecialties} />
        )
        if (intercambio.activeStage === 2) return <Stage2 intercambio={intercambio} />
        if (intercambio.activeStage === 3) return <Stage3 intercambio={intercambio} />
        if (intercambio.activeStage === 4) return <Stage4 intercambio={intercambio} />
        return <StageComingSoon stage={activeStageConfig} />
    }

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {state.intercambios.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {state.intercambios.map(i => (
                        <div key={i.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: `1.5px solid ${i.id === intercambio.id ? '#BFDBFE' : '#E2E8F0'}`, background: i.id === intercambio.id ? '#EFF6FF' : '#F8FAFC', color: i.id === intercambio.id ? '#2563EB' : '#94A3B8', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', userSelect: 'none' }}>
                            <MapPin size={11} />{i.hospital.shortName}
                        </div>
                    ))}
                </div>
            )}
            <PipelineHeader intercambio={intercambio} />
            <AnimatePresence mode="wait">
                <motion.div key={intercambio.activeStage}>{renderStageContent()}</motion.div>
            </AnimatePresence>
        </motion.div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Step = 'specialty' | 'hospitals' | 'pipeline'

export default function MeuIntercambio() {
    const { state, dispatch } = useC1()
    const hasIntercambios = state.intercambios.length > 0

    const [step, setStep] = useState<Step>(() => hasIntercambios ? 'pipeline' : 'specialty')
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
    const [selectedHospitalIds, setSelectedHospitalIds] = useState<string[]>([])
    const [specialtyOrder, setSpecialtyOrder] = useState<string[]>([])
    const [hospitalOrderBySpecialty, setHospitalOrderBySpecialty] = useState<Record<string, string[]>>({})

    // Init specialty order from persisted selected specialties
    useEffect(() => {
        if (state.selectedSpecialties.length > 0 && specialtyOrder.length === 0) {
            setSpecialtyOrder(state.selectedSpecialties)
        }
    }, [state.selectedSpecialties])

    useEffect(() => {
        if (hasIntercambios && step === 'specialty' && selectedSpecialties.length === 0) setStep('pipeline')
    }, [hasIntercambios])

    function handleConfirmSpecialties() {
        dispatch({ type: 'SET_SELECTED_SPECIALTIES', specialties: selectedSpecialties })
        setStep('hospitals')
    }

    function handleConfirmHospitals() {
        const toAdd = state.hospitals.filter(h => selectedHospitalIds.includes(h.id))
        toAdd.forEach(h => dispatch({ type: 'ADD_INTERCAMBIO', hospital: h }))
        // Merge new specialties into persisted list, keeping only user-selected ones
        const merged = [...new Set([...state.selectedSpecialties, ...selectedSpecialties])]
        dispatch({ type: 'SET_SELECTED_SPECIALTIES', specialties: merged })
        setSpecialtyOrder(merged)
        setSelectedHospitalIds([])
        setSelectedSpecialties([])
        setStep('pipeline')
    }

    function handleReorderSpec(idx: number, dir: -1 | 1) {
        setSpecialtyOrder(prev => {
            const next = [...prev]
            const swap = idx + dir
            if (swap < 0 || swap >= next.length) return prev
            ;[next[idx], next[swap]] = [next[swap], next[idx]]
            return next
        })
    }

    function handleReorderHospital(spec: string, id: string, dir: -1 | 1) {
        setHospitalOrderBySpecialty(prev => {
            // Build current order for this spec
            const currentIds = prev[spec] ?? state.intercambios
                .filter(i => i.hospital.specialty.includes(spec) && i.hospital.rankingsBySpecialty[spec] !== undefined)
                .sort((a, b) => a.hospital.rankingsBySpecialty[spec] - b.hospital.rankingsBySpecialty[spec])
                .map(i => i.id)
            const idx = currentIds.indexOf(id)
            if (idx === -1) return prev
            const next = [...currentIds]
            const swap = idx + dir
            if (swap < 0 || swap >= next.length) return prev
            ;[next[idx], next[swap]] = [next[swap], next[idx]]
            return { ...prev, [spec]: next }
        })
    }

    return (
        <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Manrope, system-ui, sans-serif' }}>
            <Header variant="app" />
            <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 80px' }}>

                {/* ── Tab bar (centered, above title) ── */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
                    <C1TabBar active="intercambio" />
                </div>

                {/* ── Title ── */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: '4px' }}>Meu Intercâmbio</h1>
                    <p style={{ fontSize: '14px', color: '#64748B' }}>
                        {step === 'specialty' ? 'Selecione suas especialidades de interesse.'
                            : step === 'hospitals' ? 'Escolha os hospitais que quer explorar.'
                                : `${state.intercambios.length} hospital${state.intercambios.length > 1 ? 'is' : ''} de interesse`}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'specialty' && (
                        <motion.div key="specialty">
                            <SpecialtyGallery
                                selected={selectedSpecialties}
                                onToggle={id => setSelectedSpecialties(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])}
                                onConfirm={handleConfirmSpecialties}
                            />
                        </motion.div>
                    )}
                    {step === 'hospitals' && (
                        <motion.div key="hospitals">
                            <HospitalGallery
                                selectedSpecialties={selectedSpecialties.length > 0 ? selectedSpecialties : state.selectedSpecialties}
                                selectedIds={selectedHospitalIds}
                                onToggle={id => setSelectedHospitalIds(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id])}
                                onConfirm={handleConfirmHospitals}
                                onBack={() => setStep(hasIntercambios ? 'pipeline' : 'specialty')}
                            />
                        </motion.div>
                    )}
                    {step === 'pipeline' && (
                        <motion.div key="pipeline">
                            <PipelineView
                                specialtyOrder={specialtyOrder}
                                hospitalOrderBySpecialty={hospitalOrderBySpecialty}
                                onReorderSpec={handleReorderSpec}
                                onReorderHospital={handleReorderHospital}
                                onAddMore={() => setStep('hospitals')}
                                onChangeSpecialties={() => setStep('specialty')}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    )
}
