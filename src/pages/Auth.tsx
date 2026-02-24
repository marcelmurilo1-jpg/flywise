import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Paleta da Landing Page ───────────────────────────────────────────────────
const NAVY = '#0E2A55'
const BLUE = '#2A60C2'
const MEDIUM = '#4A90E2'


// ─── Auth Page ────────────────────────────────────────────────────────────────
export default function Auth() {
    const [searchParams] = useSearchParams()
    const [tab, setTab] = useState<'login' | 'signup'>(searchParams.get('tab') === 'signup' ? 'signup' : 'login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const { signIn, signUp, user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => { if (user) navigate('/home') }, [user, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setSuccess(''); setLoading(true)
        try {
            if (tab === 'login') {
                const { error } = await signIn(email, password)
                if (error) setError(error.message || 'Credenciais inválidas.')
                else navigate('/home')
            } else {
                const { error } = await signUp(email, password)
                if (error) setError(error.message || 'Erro ao criar conta.')
                else setSuccess('Conta criada! Verifique seu email ou faça login.')
            }
        } finally { setLoading(false) }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#F7F9FC',
            display: 'flex',
            fontFamily: 'Inter, system-ui, sans-serif',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* ── Painel esquerdo — visual decorativo ── */}
            <div style={{
                display: 'none',
                position: 'relative',
                flex: '1',
                background: `linear-gradient(145deg, ${NAVY} 0%, ${BLUE} 100%)`,
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px',
                flexDirection: 'column',
                gap: '40px',
            }}
                className="auth-left-panel"
            >
                {/* Blob decorativo */}
                <div style={{
                    position: 'absolute', top: '-80px', right: '-80px',
                    width: '360px', height: '360px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(74,144,226,0.30) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', bottom: '-60px', left: '-60px',
                    width: '280px', height: '280px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                {/* Conteúdo hero */}
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#fff' }}>
                    <img src="/logo.png" alt="FlyWise" style={{ height: '110px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    <h2 style={{
                        fontSize: '32px', fontWeight: 900, letterSpacing: '-0.04em',
                        lineHeight: 1.15, margin: '28px 0 14px',
                    }}>
                        Viaje com Mais<br />
                        <span style={{ color: MEDIUM }}>Inteligência.</span>
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '16px', lineHeight: 1.65 }}>
                        Transforme suas milhas em decisões estratégicas — calculando o valor real e gerando o melhor plano de viagem.
                    </p>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1 }}>
                    {[
                        { v: '12k+', l: 'Usuários' },
                        { v: '98%', l: 'Satisfação' },
                        { v: '40+', l: 'Programas' },
                    ].map(s => (
                        <div key={s.l} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>{s.v}</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginTop: '3px' }}>{s.l}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Painel direito — formulário ── */}
            <div style={{
                flex: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 24px',
                background: '#fff',
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    style={{ width: '100%', maxWidth: '420px' }}
                >
                    {/* Logo */}
                    <div style={{ marginBottom: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src="/logo.png" alt="FlyWise" style={{ height: '90px', objectFit: 'contain' }} />
                        </Link>
                        <p style={{ color: '#6B7A99', fontSize: '14px', margin: 0 }}>
                            Inteligência estratégica para milhas
                        </p>
                    </div>

                    {/* Título contextual */}
                    <div style={{ marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '22px', fontWeight: 800, color: NAVY, letterSpacing: '-0.03em', margin: '0 0 4px' }}>
                            {tab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                        </h1>
                        <p style={{ fontSize: '13.5px', color: '#6B7A99', margin: 0 }}>
                            {tab === 'login'
                                ? 'Entre para acessar suas análises estratégicas'
                                : 'Comece grátis e viaje com mais inteligência'
                            }
                        </p>
                    </div>

                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        background: '#EEF2F8',
                        borderRadius: '12px', padding: '4px', marginBottom: '24px', gap: '4px',
                        border: '1px solid #E2EAF5',
                    }}>
                        {(['login', 'signup'] as const).map(t => (
                            <button key={t}
                                onClick={() => { setTab(t); setError(''); setSuccess('') }}
                                style={{
                                    flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '13.5px', transition: 'all 0.18s ease',
                                    fontFamily: 'inherit', letterSpacing: '-0.01em',
                                    background: tab === t ? '#fff' : 'transparent',
                                    color: tab === t ? NAVY : '#6B7A99',
                                    boxShadow: tab === t ? '0 1px 6px rgba(14,42,85,0.10)' : 'none',
                                }}>
                                {t === 'login' ? 'Entrar' : 'Criar conta'}
                            </button>
                        ))}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Email */}
                        <div>
                            <label style={{
                                display: 'block', fontSize: '11px', fontWeight: 700,
                                color: '#6B7A99', textTransform: 'uppercase',
                                letterSpacing: '0.07em', marginBottom: '7px',
                            }}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={14} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#A0AECB' }} />
                                <input
                                    type="email" placeholder="seu@email.com" value={email}
                                    onChange={e => setEmail(e.target.value)} required
                                    style={{
                                        width: '100%', paddingLeft: '38px', paddingRight: '14px',
                                        padding: '11px 14px 11px 38px',
                                        background: '#F7F9FC', border: '1.5px solid #E2EAF5',
                                        borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit',
                                        color: NAVY, outline: 'none',
                                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px rgba(42,96,194,0.12)` }}
                                    onBlur={e => { e.target.style.borderColor = '#E2EAF5'; e.target.style.boxShadow = 'none' }}
                                />
                            </div>
                        </div>

                        {/* Senha */}
                        <div>
                            <label style={{
                                display: 'block', fontSize: '11px', fontWeight: 700,
                                color: '#6B7A99', textTransform: 'uppercase',
                                letterSpacing: '0.07em', marginBottom: '7px',
                            }}>Senha</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={14} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#A0AECB' }} />
                                <input
                                    type={showPass ? 'text' : 'password'} placeholder="••••••••"
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    required minLength={6}
                                    style={{
                                        width: '100%', padding: '11px 42px 11px 38px',
                                        background: '#F7F9FC', border: '1.5px solid #E2EAF5',
                                        borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit',
                                        color: NAVY, outline: 'none',
                                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px rgba(42,96,194,0.12)` }}
                                    onBlur={e => { e.target.style.borderColor = '#E2EAF5'; e.target.style.boxShadow = 'none' }}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    style={{
                                        position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: '#A0AECB', padding: '4px', display: 'flex',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = NAVY}
                                    onMouseLeave={e => e.currentTarget.style.color = '#A0AECB'}
                                >
                                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Feedback */}
                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: '10px', color: '#dc2626', fontSize: '13px', alignItems: 'flex-start', overflow: 'hidden' }}>
                                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> {error}
                                </motion.div>
                            )}
                            {success && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'rgba(42,96,194,0.08)', border: '1px solid rgba(42,96,194,0.22)', borderRadius: '10px', color: BLUE, fontSize: '13px', alignItems: 'flex-start', overflow: 'hidden' }}>
                                    <CheckCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> {success}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit */}
                        <button type="submit" disabled={loading}
                            style={{
                                width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                gap: '8px', padding: '13px', fontSize: '14.5px', marginTop: '4px',
                                background: loading ? `rgba(42,96,194,0.55)` : BLUE,
                                color: '#fff', border: 'none', borderRadius: '11px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 700, fontFamily: 'inherit', letterSpacing: '-0.01em',
                                boxShadow: loading ? 'none' : '0 4px 18px rgba(42,96,194,0.35)',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#1A4EA8'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(42,96,194,0.45)' } }}
                            onMouseLeave={e => { e.currentTarget.style.background = loading ? 'rgba(42,96,194,0.55)' : BLUE; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 18px rgba(42,96,194,0.35)' }}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="spin">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                                        <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                    {tab === 'login' ? 'Entrando...' : 'Criando conta...'}
                                </span>
                            ) : tab === 'login' ? 'Entrar na Plataforma' : 'Criar conta grátis'}
                        </button>
                    </form>

                    {/* Voltar */}
                    <p style={{ textAlign: 'center', marginTop: '24px', color: '#A0AECB', fontSize: '13px' }}>
                        <Link to="/"
                            style={{ color: '#6B7A99', textDecoration: 'none', transition: 'color 0.2s', fontWeight: 500 }}
                            onMouseEnter={e => e.currentTarget.style.color = NAVY}
                            onMouseLeave={e => e.currentTarget.style.color = '#6B7A99'}
                        >← Voltar para início</Link>
                    </p>
                </motion.div>
            </div>

            {/* Responsive style */}
            <style>{`
                @media (min-width: 860px) {
                    .auth-left-panel { display: flex !important; }
                }
            `}</style>
        </div>
    )
}
