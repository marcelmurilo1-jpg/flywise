import { useState, useEffect, useRef } from 'react'
import {
    User, Lock, Plane, Bell, Trash2, LogOut, Check, Loader2,
    ChevronLeft, Eye, EyeOff, AlertTriangle, ShieldCheck,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'

// ─── Types ────────────────────────────────────────────────────────────────────

type TravelerType = 'solo' | 'casal' | 'familia' | 'amigos'
type TravelStyle = 'Econômico' | 'Cultural' | 'Gastronômico' | 'Aventura' | 'Compras'
type SectionId = 'perfil' | 'seguranca' | 'viagem' | 'notificacoes' | 'conta'

interface UserProfile {
    full_name: string
    phone: string
    birth_date: string
    nationality: string
    default_traveler_type: TravelerType
    preferred_styles: TravelStyle[]
    preferred_currency: string
    notifications_email: boolean
    notifications_promotions: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRAVELER_OPTIONS: { value: TravelerType; label: string; desc: string }[] = [
    { value: 'solo', label: 'Solo', desc: 'Viajante individual' },
    { value: 'casal', label: 'Casal', desc: 'Dois adultos' },
    { value: 'familia', label: 'Família', desc: 'Com crianças' },
    { value: 'amigos', label: 'Amigos', desc: 'Grupo de amigos' },
]

const STYLE_OPTIONS: TravelStyle[] = ['Econômico', 'Cultural', 'Gastronômico', 'Aventura', 'Compras']

const CURRENCY_OPTIONS = [
    { value: 'BRL', label: 'Real Brasileiro (R$)' },
    { value: 'USD', label: 'Dólar Americano (US$)' },
    { value: 'EUR', label: 'Euro (€)' },
]

const NATIONALITIES = [
    'Brasileiro', 'Americano', 'Argentino', 'Colombiano', 'Chileno',
    'Português', 'Espanhol', 'Italiano', 'Francês', 'Alemão', 'Outro',
]

const SECTIONS: { id: SectionId; label: string; Icon: React.ElementType }[] = [
    { id: 'perfil', label: 'Perfil', Icon: User },
    { id: 'seguranca', label: 'Segurança', Icon: Lock },
    { id: 'viagem', label: 'Preferências', Icon: Plane },
    { id: 'notificacoes', label: 'Notificações', Icon: Bell },
    { id: 'conta', label: 'Conta', Icon: ShieldCheck },
]

const DEFAULT_PROFILE: UserProfile = {
    full_name: '',
    phone: '',
    birth_date: '',
    nationality: '',
    default_traveler_type: 'casal',
    preferred_styles: ['Cultural'],
    preferred_currency: 'BRL',
    notifications_email: true,
    notifications_promotions: true,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string, email: string): string {
    if (name.trim()) {
        const parts = name.trim().split(' ')
        return parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
    id, title, description, Icon, children,
}: {
    id: SectionId
    title: string
    description: string
    Icon: React.ElementType
    children: React.ReactNode
}) {
    return (
        <div
            id={id}
            style={{
                background: '#fff', borderRadius: '20px',
                border: '1.5px solid var(--border-light)',
                boxShadow: '0 2px 12px rgba(74,144,226,0.06)',
                overflow: 'hidden',
            }}
        >
            {/* Card header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '24px 28px 20px',
                borderBottom: '1.5px solid var(--border-light)',
                background: 'var(--snow)',
            }}>
                <div style={{
                    width: 40, height: 40, borderRadius: '12px',
                    background: 'var(--blue-pale)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Icon size={18} color="var(--blue-medium)" />
                </div>
                <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)' }}>{title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>
                </div>
            </div>
            <div style={{ padding: '24px 28px' }}>
                {children}
            </div>
        </div>
    )
}

function Field({
    label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-body)' }}>{label}</label>
            {children}
            {hint && <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{hint}</span>}
        </div>
    )
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: '12px',
    border: '1.5px solid var(--border-light)', background: '#fff',
    fontSize: '14px', color: 'var(--text-dark)', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s',
}

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
                onClick={onClick}
                disabled={saving}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '11px 24px', borderRadius: '12px',
                    background: saved ? 'rgba(34,197,94,0.1)' : 'var(--blue-medium)',
                    color: saved ? '#16a34a' : '#fff',
                    border: saved ? '1.5px solid #86efac' : '1.5px solid transparent',
                    fontSize: '14px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                {saving
                    ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Salvando…</>
                    : saved
                        ? <><Check size={15} /> Salvo</>
                        : 'Salvar alterações'}
            </button>
        </div>
    )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!value)}
            style={{
                width: 44, height: 24, borderRadius: '999px', border: 'none',
                background: value ? 'var(--blue-medium)' : 'var(--gray-mid)',
                cursor: 'pointer', position: 'relative', flexShrink: 0,
                transition: 'background 0.2s',
            }}
        >
            <span style={{
                position: 'absolute', top: 3, left: value ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
        </button>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Configuracoes() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()

    // Profile state
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
    const [loadingProfile, setLoadingProfile] = useState(true)

    // Section save states
    const [savingSection, setSavingSection] = useState<SectionId | null>(null)
    const [savedSection, setSavedSection] = useState<SectionId | null>(null)

    // Password state
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false })
    const [passwordError, setPasswordError] = useState('')

    // Delete account state
    const [deleteConfirm, setDeleteConfirm] = useState('')
    const [deletingAccount, setDeletingAccount] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Active section highlight for nav
    const [activeSection, setActiveSection] = useState<SectionId>('perfil')
    const observerRef = useRef<IntersectionObserver | null>(null)

    // ── Load profile ──────────────────────────────────────────────────────────

    useEffect(() => {
        if (!user) return
        const fetchProfile = async () => {
            const { data } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single()
            if (data) {
                setProfile({
                    full_name: data.full_name ?? '',
                    phone: data.phone ?? '',
                    birth_date: data.birth_date ?? '',
                    nationality: data.nationality ?? '',
                    default_traveler_type: data.default_traveler_type ?? 'casal',
                    preferred_styles: data.preferred_styles ?? ['Cultural'],
                    preferred_currency: data.preferred_currency ?? 'BRL',
                    notifications_email: data.notifications_email ?? true,
                    notifications_promotions: data.notifications_promotions ?? true,
                })
            }
            setLoadingProfile(false)
        }
        fetchProfile()
    }, [user])

    // ── Section intersection observer ─────────────────────────────────────────

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter(e => e.isIntersecting)
                if (visible.length > 0) {
                    const topmost = visible.reduce((a, b) =>
                        a.boundingClientRect.top < b.boundingClientRect.top ? a : b
                    )
                    setActiveSection(topmost.target.id as SectionId)
                }
            },
            { threshold: 0.3 }
        )
        SECTIONS.forEach(({ id }) => {
            const el = document.getElementById(id)
            if (el) observerRef.current?.observe(el)
        })
        return () => observerRef.current?.disconnect()
    }, [loadingProfile])

    // ── Helpers ───────────────────────────────────────────────────────────────

    const markSaved = (section: SectionId) => {
        setSavedSection(section)
        setTimeout(() => setSavedSection(null), 2000)
    }

    const upsertProfile = async (partial: Partial<UserProfile>) => {
        if (!user) return
        await supabase
            .from('user_profiles')
            .upsert({ id: user.id, ...profile, ...partial })
    }

    const saveSection = async (section: SectionId, partial?: Partial<UserProfile>) => {
        setSavingSection(section)
        await upsertProfile(partial ?? {})
        setSavingSection(null)
        markSaved(section)
    }

    const scrollTo = (id: SectionId) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const toggleStyle = (style: TravelStyle) => {
        setProfile(p => ({
            ...p,
            preferred_styles: p.preferred_styles.includes(style)
                ? p.preferred_styles.filter(s => s !== style)
                : [...p.preferred_styles, style],
        }))
    }

    // ── Password change ───────────────────────────────────────────────────────

    const handlePasswordChange = async () => {
        setPasswordError('')
        if (newPassword.length < 8) {
            setPasswordError('A nova senha deve ter pelo menos 8 caracteres.')
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('As senhas não coincidem.')
            return
        }
        setSavingSection('seguranca')
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        setSavingSection(null)
        if (error) {
            setPasswordError(error.message)
            return
        }
        setNewPassword('')
        setConfirmPassword('')
        markSaved('seguranca')
    }

    // ── Delete account ────────────────────────────────────────────────────────

    const handleDeleteAccount = async () => {
        if (!user || deleteConfirm.toLowerCase() !== 'excluir') return
        setDeletingAccount(true)
        // Delete user data — RLS cascade will handle the rest
        await supabase.from('user_profiles').delete().eq('id', user.id)
        await supabase.auth.signOut()
        navigate('/')
    }

    // ── Notification toggle (auto-save) ───────────────────────────────────────

    const toggleNotification = async (field: 'notifications_email' | 'notifications_promotions') => {
        const newValue = !profile[field]
        setProfile(p => ({ ...p, [field]: newValue }))
        await upsertProfile({ [field]: newValue })
        markSaved('notificacoes')
    }

    // ─────────────────────────────────────────────────────────────────────────

    if (!user) return null

    const initials = getInitials(profile.full_name, user.email ?? '')
    const displayName = profile.full_name.trim() || (user.email ?? '')

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)' }}>
            <Header variant="app" />

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                input:focus, select:focus, textarea:focus { border-color: var(--blue-medium) !important; }
                .settings-input:focus { border-color: var(--blue-medium) !important; }
            `}</style>

            <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 80px' }}>

                {/* Back button + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            width: 36, height: 36, borderRadius: '10px', border: '1.5px solid var(--border-light)',
                            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0,
                        }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-dark)' }}>
                            Configurações
                        </h1>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Gerencie seu perfil, segurança e preferências
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '32px', alignItems: 'flex-start' }}>

                    {/* ── Left nav (sticky) ─────────────────────────────────── */}
                    <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {/* Avatar card */}
                        <div style={{
                            background: '#fff', borderRadius: '16px',
                            border: '1.5px solid var(--border-light)',
                            padding: '20px 16px', textAlign: 'center',
                            marginBottom: '12px',
                        }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%',
                                background: 'var(--blue-medium)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 10px',
                                fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '0.02em',
                            }}>
                                {initials}
                            </div>
                            <div style={{
                                fontSize: '13px', fontWeight: 700, color: 'var(--text-dark)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {displayName}
                            </div>
                            <div style={{
                                fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {user.email}
                            </div>
                        </div>

                        {SECTIONS.map(({ id, label, Icon }) => {
                            const isActive = activeSection === id
                            return (
                                <button
                                    key={id}
                                    onClick={() => scrollTo(id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '10px 14px', borderRadius: '12px',
                                        border: 'none', textAlign: 'left',
                                        background: isActive ? 'var(--blue-pale)' : 'transparent',
                                        color: isActive ? 'var(--blue-medium)' : 'var(--text-muted)',
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: '13px', cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    <Icon size={15} />
                                    {label}
                                </button>
                            )
                        })}
                    </div>

                    {/* ── Right content ─────────────────────────────────────── */}
                    {loadingProfile ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            minHeight: '300px', color: 'var(--text-muted)', fontSize: '14px', gap: '10px',
                        }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                            Carregando perfil…
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                            {/* ── Perfil ─────────────────────────────────────── */}
                            <SectionCard id="perfil" title="Perfil" description="Suas informações pessoais" Icon={User}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <Field label="Nome completo">
                                        <input
                                            className="settings-input"
                                            style={inputStyle}
                                            value={profile.full_name}
                                            onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                                            placeholder="Seu nome completo"
                                        />
                                    </Field>

                                    <Field label="Telefone">
                                        <input
                                            className="settings-input"
                                            style={inputStyle}
                                            value={profile.phone}
                                            onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                                            placeholder="+55 (11) 99999-9999"
                                        />
                                    </Field>

                                    <Field label="Data de nascimento">
                                        <input
                                            className="settings-input"
                                            style={inputStyle}
                                            type="date"
                                            value={profile.birth_date}
                                            onChange={e => setProfile(p => ({ ...p, birth_date: e.target.value }))}
                                        />
                                    </Field>

                                    <Field label="Nacionalidade">
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: '36px' }}
                                                value={profile.nationality}
                                                onChange={e => setProfile(p => ({ ...p, nationality: e.target.value }))}
                                            >
                                                <option value="">Selecionar…</option>
                                                {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                            <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </div>
                                    </Field>
                                </div>

                                <div style={{ marginTop: '16px' }}>
                                    <Field label="E-mail" hint="Para alterar o e-mail, entre em contato com o suporte.">
                                        <input
                                            style={{ ...inputStyle, background: 'var(--snow)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                                            value={user.email ?? ''}
                                            readOnly
                                        />
                                    </Field>
                                </div>

                                <SaveButton
                                    saving={savingSection === 'perfil'}
                                    saved={savedSection === 'perfil'}
                                    onClick={() => saveSection('perfil')}
                                />
                            </SectionCard>

                            {/* ── Segurança ──────────────────────────────────── */}
                            <SectionCard id="seguranca" title="Segurança" description="Atualize sua senha de acesso" Icon={Lock}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="settings-input"
                                                style={{ ...inputStyle, paddingRight: '44px' }}
                                                type={showPasswords.new ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                                            >
                                                {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </Field>

                                    <Field label="Confirmar nova senha">
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="settings-input"
                                                style={{ ...inputStyle, paddingRight: '44px' }}
                                                type={showPasswords.confirm ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                                            >
                                                {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </Field>

                                    {passwordError && (
                                        <p style={{ margin: 0, fontSize: '13px', color: '#ef4444' }}>{passwordError}</p>
                                    )}
                                </div>

                                <SaveButton
                                    saving={savingSection === 'seguranca'}
                                    saved={savedSection === 'seguranca'}
                                    onClick={handlePasswordChange}
                                />
                            </SectionCard>

                            {/* ── Preferências de viagem ─────────────────────── */}
                            <SectionCard id="viagem" title="Preferências de Viagem" description="Personalize suas buscas e roteiros" Icon={Plane}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                    {/* Traveler type */}
                                    <Field label="Perfil de viajante padrão">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginTop: '2px' }}>
                                            {TRAVELER_OPTIONS.map(({ value, label, desc }) => {
                                                const active = profile.default_traveler_type === value
                                                return (
                                                    <button
                                                        key={value}
                                                        onClick={() => setProfile(p => ({ ...p, default_traveler_type: value }))}
                                                        style={{
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                            gap: '4px', padding: '12px 8px', borderRadius: '12px',
                                                            border: `1.5px solid ${active ? 'var(--blue-medium)' : 'var(--border-light)'}`,
                                                            background: active ? 'var(--blue-pale)' : '#fff',
                                                            color: active ? 'var(--blue-medium)' : 'var(--text-muted)',
                                                            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: active ? 'var(--blue-medium)' : 'var(--text-dark)' }}>
                                                            {label}
                                                        </span>
                                                        <span style={{ fontSize: '11px', textAlign: 'center' }}>{desc}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </Field>

                                    {/* Travel styles */}
                                    <Field label="Estilos de viagem preferidos" hint="Selecione um ou mais.">
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
                                            {STYLE_OPTIONS.map(style => {
                                                const active = profile.preferred_styles.includes(style)
                                                return (
                                                    <button
                                                        key={style}
                                                        onClick={() => toggleStyle(style)}
                                                        style={{
                                                            padding: '8px 16px', borderRadius: '999px',
                                                            border: `1.5px solid ${active ? 'var(--blue-medium)' : 'var(--border-light)'}`,
                                                            background: active ? 'var(--blue-pale)' : '#fff',
                                                            color: active ? 'var(--blue-medium)' : 'var(--text-muted)',
                                                            fontSize: '13px', fontWeight: active ? 700 : 500,
                                                            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        {style}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </Field>

                                    {/* Currency */}
                                    <Field label="Moeda de referência">
                                        <div style={{ position: 'relative', maxWidth: '280px' }}>
                                            <select
                                                style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: '36px' }}
                                                value={profile.preferred_currency}
                                                onChange={e => setProfile(p => ({ ...p, preferred_currency: e.target.value }))}
                                            >
                                                {CURRENCY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                            <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </div>
                                    </Field>
                                </div>

                                <SaveButton
                                    saving={savingSection === 'viagem'}
                                    saved={savedSection === 'viagem'}
                                    onClick={() => saveSection('viagem')}
                                />
                            </SectionCard>

                            {/* ── Notificações ───────────────────────────────── */}
                            <SectionCard id="notificacoes" title="Notificações" description="Controle quais alertas você recebe" Icon={Bell}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                    {[
                                        {
                                            field: 'notifications_email' as const,
                                            label: 'Notificações por e-mail',
                                            desc: 'Receba atualizações de buscas e resultados por e-mail.',
                                        },
                                        {
                                            field: 'notifications_promotions' as const,
                                            label: 'Alertas de promoções',
                                            desc: 'Seja o primeiro a saber sobre passagens em promoção.',
                                        },
                                    ].map(({ field, label, desc }, i) => (
                                        <div
                                            key={field}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                gap: '16px', padding: '16px 0',
                                                borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)' }}>{label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
                                            </div>
                                            <Toggle
                                                value={profile[field]}
                                                onChange={() => toggleNotification(field)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <AnimatePresence>
                                    {savedSection === 'notificacoes' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                fontSize: '12px', color: '#16a34a', marginTop: '12px',
                                            }}
                                        >
                                            <Check size={13} /> Preferências salvas
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </SectionCard>

                            {/* ── Conta ──────────────────────────────────────── */}
                            <SectionCard id="conta" title="Conta" description="Ações relacionadas à sua conta" Icon={ShieldCheck}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                    {/* Sign out */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '16px', borderRadius: '14px',
                                        background: 'var(--snow)', border: '1.5px solid var(--border-light)',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)' }}>Sair da conta</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                Encerra a sessão atual neste dispositivo.
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => { await signOut(); navigate('/') }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '10px 18px', borderRadius: '10px',
                                                border: '1.5px solid var(--border-light)',
                                                background: '#fff', color: 'var(--text-muted)',
                                                fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <LogOut size={14} /> Sair
                                        </button>
                                    </div>

                                    {/* Delete account */}
                                    <div style={{
                                        padding: '16px', borderRadius: '14px',
                                        background: 'rgba(239,68,68,0.04)',
                                        border: '1.5px solid rgba(239,68,68,0.2)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <AlertTriangle size={14} color="#ef4444" />
                                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>Excluir conta</span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                                    Todos os seus dados serão permanentemente removidos. Esta ação não pode ser desfeita.
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setShowDeleteConfirm(v => !v)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '10px 18px', borderRadius: '10px',
                                                    border: '1.5px solid rgba(239,68,68,0.4)',
                                                    background: 'rgba(239,68,68,0.08)', color: '#dc2626',
                                                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Trash2 size={14} /> Excluir
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {showDeleteConfirm && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                                            Para confirmar, digite <strong style={{ color: '#dc2626' }}>excluir</strong> no campo abaixo:
                                                        </p>
                                                        <input
                                                            style={{ ...inputStyle, borderColor: 'rgba(239,68,68,0.3)' }}
                                                            value={deleteConfirm}
                                                            onChange={e => setDeleteConfirm(e.target.value)}
                                                            placeholder="excluir"
                                                        />
                                                        <button
                                                            onClick={handleDeleteAccount}
                                                            disabled={deleteConfirm.toLowerCase() !== 'excluir' || deletingAccount}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                                padding: '12px', borderRadius: '10px',
                                                                background: deleteConfirm.toLowerCase() === 'excluir' ? '#dc2626' : 'rgba(239,68,68,0.3)',
                                                                color: '#fff', border: 'none',
                                                                fontSize: '13px', fontWeight: 700, cursor: deleteConfirm.toLowerCase() === 'excluir' ? 'pointer' : 'not-allowed',
                                                                fontFamily: 'inherit', transition: 'background 0.2s',
                                                            }}
                                                        >
                                                            {deletingAccount
                                                                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Excluindo…</>
                                                                : <><Trash2 size={14} /> Confirmar exclusão permanente</>
                                                            }
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </SectionCard>

                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
