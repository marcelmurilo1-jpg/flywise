import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

const NAVY = '#0E2A55'
const BLUE = '#2A60C2'

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

    const switchTab = (t: 'login' | 'signup') => { setTab(t); setError(''); setSuccess('') }

    const handleSubmit = async (e: React.FormEvent, formType: 'login' | 'signup') => {
        e.preventDefault()
        if (formType !== tab) return
        setError(''); setSuccess(''); setLoading(true)
        try {
            if (formType === 'login') {
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

    const inputBase: React.CSSProperties = {
        width: '100%', background: '#F7F9FC', border: '1.5px solid #E2EAF5',
        borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit',
        color: NAVY, outline: 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    }

    const renderForm = (formType: 'login' | 'signup') => {
        const isActive = tab === formType
        return (
            <form onSubmit={(e) => handleSubmit(e, formType)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Email */}
                <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Email</label>
                    <div style={{ position: 'relative' }}>
                        <Mail size={14} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#A0AECB' }} />
                        <input
                            type="email" placeholder="seu@email.com" value={email}
                            onChange={e => setEmail(e.target.value)} required
                            tabIndex={isActive ? 0 : -1}
                            style={{ ...inputBase, padding: '11px 14px 11px 38px' }}
                            onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = '0 0 0 3px rgba(42,96,194,0.12)' }}
                            onBlur={e => { e.target.style.borderColor = '#E2EAF5'; e.target.style.boxShadow = 'none' }}
                        />
                    </div>
                </div>

                {/* Senha */}
                <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Senha</label>
                    <div style={{ position: 'relative' }}>
                        <Lock size={14} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#A0AECB' }} />
                        <input
                            type={showPass ? 'text' : 'password'} placeholder="••••••••"
                            value={password} onChange={e => setPassword(e.target.value)}
                            required minLength={6}
                            tabIndex={isActive ? 0 : -1}
                            style={{ ...inputBase, padding: '11px 42px 11px 38px' }}
                            onFocus={e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = '0 0 0 3px rgba(42,96,194,0.12)' }}
                            onBlur={e => { e.target.style.borderColor = '#E2EAF5'; e.target.style.boxShadow = 'none' }}
                        />
                        <button type="button" onClick={() => setShowPass(!showPass)} tabIndex={isActive ? 0 : -1}
                            style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A0AECB', padding: '4px', display: 'flex' }}>
                            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>

                {/* Feedback */}
                <AnimatePresence>
                    {error && isActive && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: '10px', color: '#dc2626', fontSize: '13px', alignItems: 'flex-start', overflow: 'hidden' }}>
                            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> {error}
                        </motion.div>
                    )}
                    {success && isActive && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'rgba(42,96,194,0.08)', border: '1px solid rgba(42,96,194,0.22)', borderRadius: '10px', color: BLUE, fontSize: '13px', alignItems: 'flex-start', overflow: 'hidden' }}>
                            <CheckCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> {success}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Submit */}
                <button type="submit" disabled={loading && isActive} tabIndex={isActive ? 0 : -1}
                    style={{
                        width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        gap: '8px', padding: '13px', fontSize: '14.5px', marginTop: '4px',
                        background: (loading && isActive) ? 'rgba(42,96,194,0.55)' : BLUE,
                        color: '#fff', border: 'none', borderRadius: '11px',
                        cursor: (loading && isActive) ? 'not-allowed' : 'pointer',
                        fontWeight: 700, fontFamily: 'inherit', letterSpacing: '-0.01em',
                        boxShadow: (loading && isActive) ? 'none' : '0 4px 18px rgba(42,96,194,0.35)',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { if (!(loading && isActive)) { e.currentTarget.style.background = '#1A4EA8'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                    onMouseLeave={e => { e.currentTarget.style.background = (loading && isActive) ? 'rgba(42,96,194,0.55)' : BLUE; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                    {loading && isActive ? (
                        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="spin">
                                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                                <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            {formType === 'login' ? 'Entrando...' : 'Criando conta...'}
                        </span>
                    ) : formType === 'login' ? 'Entrar na Plataforma' : 'Criar conta grátis'}
                </button>
            </form>
        )
    }

    const panelBtn: React.CSSProperties = {
        background: 'none', border: '2px solid rgba(255,255,255,0.65)',
        borderRadius: '10px', padding: '10px 28px', color: '#fff',
        fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 0.2s',
    }

    return (
        <div style={{ height: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>

            {/* ── Desktop layout ── */}
            <div className="auth-desktop" style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>

                {/* Left column: Login form */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#fff' }}>
                    <div style={{ width: '100%', maxWidth: '380px' }}>
                        <div style={{ marginBottom: '28px' }}>
                            <h1 style={{ fontSize: '22px', fontWeight: 800, color: NAVY, letterSpacing: '-0.03em', margin: '0 0 4px' }}>Bem-vindo de volta</h1>
                            <p style={{ fontSize: '13.5px', color: '#6B7A99', margin: 0 }}>Entre para acessar suas análises estratégicas</p>
                        </div>
                        {renderForm('login')}
                        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px' }}>
                            <Link to="/" style={{ color: '#6B7A99', textDecoration: 'none', fontWeight: 500 }}>← Voltar para início</Link>
                        </p>
                    </div>
                </div>

                {/* Right column: Signup form */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#F7F9FC' }}>
                    <div style={{ width: '100%', maxWidth: '380px' }}>
                        <div style={{ marginBottom: '28px' }}>
                            <h1 style={{ fontSize: '22px', fontWeight: 800, color: NAVY, letterSpacing: '-0.03em', margin: '0 0 4px' }}>Crie sua conta</h1>
                            <p style={{ fontSize: '13.5px', color: '#6B7A99', margin: 0 }}>Comece grátis e viaje com mais inteligência</p>
                        </div>
                        {renderForm('signup')}
                        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px' }}>
                            <Link to="/" style={{ color: '#6B7A99', textDecoration: 'none', fontWeight: 500 }}>← Voltar para início</Link>
                        </p>
                    </div>
                </div>

                {/* ── Sliding blue panel ── */}
                <motion.div
                    animate={{ left: tab === 'login' ? '50%' : '0%' }}
                    transition={{ type: 'spring', stiffness: 65, damping: 18 }}
                    style={{
                        position: 'absolute', top: 0, width: '50%', height: '100%',
                        background: `linear-gradient(145deg, ${NAVY} 0%, ${BLUE} 100%)`,
                        zIndex: 10, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '40px',
                        padding: '80px 60px 100px', overflow: 'hidden',
                    }}
                >
                    {/* Decorative blobs */}
                    <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,144,226,0.28) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

                    {/* Logo centralizada */}
                    <img src="/logo_login.png" alt="FlyWise" style={{ height: '130px', objectFit: 'contain', position: 'relative', zIndex: 1 }} />

                    {/* Texto + CTA dinâmicos — invertidos */}
                    <AnimatePresence mode="wait">
                        {tab === 'login' ? (
                            <motion.div key="panel-signup-cta"
                                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                                transition={{ duration: 0.28 }}
                                style={{ textAlign: 'center', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
                            >
                                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.2, margin: 0 }}>Bem-vindo de volta!</h2>
                                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '15px', lineHeight: 1.65, margin: 0 }}>
                                    Continue sua jornada estratégica de viagens.
                                </p>
                                <button style={panelBtn} onClick={() => switchTab('signup')}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                    Criar conta →
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div key="panel-login-cta"
                                initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                                transition={{ duration: 0.28 }}
                                style={{ textAlign: 'center', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
                            >
                                <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.2, margin: 0 }}>Novo por aqui?</h2>
                                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '15px', lineHeight: 1.65, margin: 0 }}>
                                    Crie sua conta e comece a transformar milhas em viagens estratégicas.
                                </p>
                                <button style={panelBtn} onClick={() => switchTab('login')}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                    ← Entrar
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* ── Mobile layout ── */}
            <div className="auth-mobile" style={{ display: 'none', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '40px 24px' }}>
                <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }} style={{ width: '100%', maxWidth: '420px' }}>
                    <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <Link to="/" style={{ textDecoration: 'none' }}>
                            <img src="/logo.png" alt="FlyWise" style={{ height: '80px', objectFit: 'contain' }} />
                        </Link>
                        <p style={{ color: '#6B7A99', fontSize: '14px', margin: 0 }}>Inteligência estratégica para milhas</p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '22px', fontWeight: 800, color: NAVY, letterSpacing: '-0.03em', margin: '0 0 4px' }}>
                            {tab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                        </h1>
                        <p style={{ fontSize: '13.5px', color: '#6B7A99', margin: 0 }}>
                            {tab === 'login' ? 'Entre para acessar suas análises estratégicas' : 'Comece grátis e viaje com mais inteligência'}
                        </p>
                    </div>

                    {/* Mobile tab toggle */}
                    <div style={{ display: 'flex', background: '#EEF2F8', borderRadius: '12px', padding: '4px', marginBottom: '24px', gap: '4px', border: '1px solid #E2EAF5' }}>
                        {(['login', 'signup'] as const).map(t => (
                            <button key={t} onClick={() => switchTab(t)} style={{
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

                    {renderForm(tab)}

                    <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px' }}>
                        <Link to="/" style={{ color: '#6B7A99', textDecoration: 'none', fontWeight: 500 }}>← Voltar para início</Link>
                    </p>
                </motion.div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                .spin { animation: spin 0.8s linear infinite }
                @media (max-width: 860px) {
                    .auth-desktop { display: none !important; }
                    .auth-mobile { display: flex !important; }
                }
            `}</style>
        </div>
    )
}
