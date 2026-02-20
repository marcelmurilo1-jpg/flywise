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
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 50%, #f5f3ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            position: 'relative',
        }}>
            {/* Decorative blobs */}
            <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(147,197,253,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,181,253,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}
            >
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
                            <Plane size={19} color="#fff" strokeWidth={2.5} />
                        </div>
                        <span style={{ fontWeight: 900, fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                            Fly<span className="gradient-text">Wise</span>
                        </span>
                    </Link>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                        Inteligência aérea de última geração
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--bg-surface)', borderRadius: '20px',
                    border: '1px solid var(--border-faint)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '32px',
                    backdropFilter: 'blur(10px)',
                }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: '10px', padding: '3px', marginBottom: '24px', gap: '3px' }}>
                        {(['login', 'signup'] as const).map(t => (
                            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
                                style={{
                                    flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '13.5px', transition: 'all 0.18s ease',
                                    fontFamily: 'inherit',
                                    background: tab === t ? 'var(--bg-surface)' : 'transparent',
                                    color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                                    boxShadow: tab === t ? 'var(--shadow-xs)' : 'none',
                                }}>
                                {t === 'login' ? 'Entrar' : 'Criar conta'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label className="input-label">Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                                <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="input" style={{ paddingLeft: '38px' }} />
                            </div>
                        </div>

                        <div>
                            <label className="input-label">Senha</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="input" style={{ paddingLeft: '38px', paddingRight: '42px' }} />
                                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '4px', display: 'flex' }}>
                                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '9px', color: 'var(--red)', fontSize: '13px', alignItems: 'flex-start' }}>
                                    <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
                                </motion.div>
                            )}
                            {success && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    style={{ display: 'flex', gap: '8px', padding: '11px 13px', background: 'var(--green-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '9px', color: 'var(--green)', fontSize: '13px', alignItems: 'flex-start' }}>
                                    <CheckCircle size={15} style={{ flexShrink: 0 }} /> {success}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14.5px', justifyContent: 'center' }}>
                            {loading ? (
                                <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="spin">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                                        <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                    {tab === 'login' ? 'Entrando...' : 'Criando conta...'}
                                </span>
                            ) : tab === 'login' ? 'Entrar' : 'Criar conta grátis'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Voltar para início</Link>
                </p>
            </motion.div>
        </div>
    )
}
