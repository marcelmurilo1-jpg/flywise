import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Plane, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

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
            background: `linear-gradient(160deg, var(--petrol-deep) 0%, var(--petrol-mid) 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            position: 'relative',
            fontFamily: 'Manrope, system-ui, sans-serif',
        }}>
            {/* Subtle blobs */}
            <div style={{
                position: 'absolute', top: '-100px', right: '-100px',
                width: '450px', height: '450px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(14,107,87,0.15) 0%, transparent 65%)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute', bottom: '-100px', left: '-100px',
                width: '400px', height: '400px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(18,60,74,0.6) 0%, transparent 65%)',
                pointerEvents: 'none',
            }} />

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}
            >
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '11px',
                            background: 'var(--green-strat)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(14,107,87,0.4)',
                        }}>
                            <Plane size={19} color="#fff" strokeWidth={2.5} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '22px', color: '#fff', letterSpacing: '-0.03em' }}>
                            FlyWise
                        </span>
                    </Link>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13.5px', marginTop: '10px', fontWeight: 400 }}>
                        Inteligência estratégica para milhas
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.10)',
                    padding: '32px',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
                }}>
                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: '11px', padding: '3px', marginBottom: '24px', gap: '3px',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        {(['login', 'signup'] as const).map(t => (
                            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
                                style={{
                                    flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '13.5px', transition: 'all 0.18s ease',
                                    fontFamily: 'inherit', letterSpacing: '-0.01em',
                                    background: tab === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
                                    boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                }}>
                                {t === 'login' ? 'Entrar' : 'Criar conta'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{
                                display: 'block', fontSize: '11px', fontWeight: 600,
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px',
                            }}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={14} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                                <input type="email" placeholder="seu@email.com" value={email}
                                    onChange={e => setEmail(e.target.value)} required
                                    className="input input-dark"
                                    style={{ paddingLeft: '38px' }} />
                            </div>
                        </div>

                        <div>
                            <label style={{
                                display: 'block', fontSize: '11px', fontWeight: 600,
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px',
                            }}>Senha</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={14} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                                <input type={showPass ? 'text' : 'password'} placeholder="••••••••"
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    required minLength={6}
                                    className="input input-dark"
                                    style={{ paddingLeft: '38px', paddingRight: '42px' }} />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    style={{
                                        position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.3)', padding: '4px', display: 'flex',
                                        transition: 'color 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                >
                                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#f87171', fontSize: '13px', alignItems: 'flex-start', overflow: 'hidden' }}>
                                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> {error}
                                </motion.div>
                            )}
                            {success && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'rgba(14,107,87,0.15)', border: '1px solid rgba(31,138,112,0.3)', borderRadius: '10px', color: '#34d399', fontSize: '13px', alignItems: 'flex-start', overflow: 'hidden' }}>
                                    <CheckCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> {success}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button type="submit" disabled={loading}
                            className="btn btn-green"
                            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '14.5px', marginTop: '4px' }}>
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
                </div>

                <p style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
                    <Link to="/" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                    >← Voltar para início</Link>
                </p>
            </motion.div>
        </div>
    )
}
