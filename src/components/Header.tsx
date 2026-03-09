import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Tag, Wallet, Plane, User, Settings, LogOut, Map } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'
import { ThemeToggle } from '@/components/ThemeToggle'

interface HeaderProps {
    variant?: 'landing' | 'app'
}

const NAV_ITEMS = [
    { title: 'Buscar', icon: Search, to: '/home' },
    { title: 'Promoções', icon: Tag, to: '/promotions' },
    { title: 'Carteira', icon: Wallet, to: '/wallet' },
    { title: 'Estratégias', icon: Plane, to: '/saved-strategies' },
    { title: 'Roteiro', icon: Map, to: '/roteiro' },
]

export function Header({ variant = 'app' }: HeaderProps) {
    const { user, signOut } = useAuth()
    const { isDark } = useTheme()
    const navigate = useNavigate()
    const location = useLocation()
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const activeIndex = NAV_ITEMS.findIndex(item =>
        location.pathname.startsWith(item.to)
    )

    // Fechar menu ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSignOut = async () => {
        await signOut()
        navigate('/')
    }

    if (variant === 'landing') return null

    return (
        <>
        <header style={{
            background: isDark ? 'rgba(15,17,23,0.95)' : 'rgba(255,255,255,0.95)',
            borderBottom: isDark ? '1px solid #1e293b' : '1px solid rgba(14,42,85,0.08)',
            position: 'relative',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
        }}>
<<<<<<< HEAD
            <div className="fly-header-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', height: '110px', padding: '0 8px', maxWidth: '880px', margin: '0 auto' }}>

                {/* Left: Logo */}
                <Link to={user ? '/home' : '/'} style={{ display: 'flex', alignItems: 'center', justifySelf: 'start' }}>
                    <img src="/logo.png" alt="FlyWise" className="fly-logo" style={{ height: '96px', objectFit: 'contain' }} />
                </Link>

                {/* Center: Navigation Icons */}
                {user && variant === 'app' ? (
                    <div className="fly-nav-tabs" style={{ justifySelf: 'center' }}>
=======
            <div className="flywise-header-inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', height: '110px', padding: '0 8px', maxWidth: '880px', margin: '0 auto' }}>

                {/* Left: Logo */}
                <Link to={user ? '/home' : '/'} style={{ display: 'flex', alignItems: 'center', justifySelf: 'start' }}>
                    <img src="/logo.png" alt="FlyWise" className="flywise-header-logo" style={{ height: '96px', objectFit: 'contain' }} />
                </Link>


                {/* Center: Navigation Icons — hidden on mobile (BottomNav takes over) */}
                {user && variant === 'app' ? (
                    <div className="flywise-header-nav" style={{ justifySelf: 'center' }}>
>>>>>>> 26740e5 (mobile)
                        <ExpandableTabs
                            tabs={NAV_ITEMS}
                            activeIndex={activeIndex}
                            onSelect={(i) => navigate(NAV_ITEMS[i].to)}
                        />
                    </div>
                ) : <div />}

                {/* Right: Theme Toggle + User Menu */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                    <span className="flywise-header-theme-toggle"><ThemeToggle /></span>
                    {!user ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Link to="/auth" className="btn btn-outline-white btn-sm fly-hide-xs">Entrar</Link>
                            <Link to="/auth?tab=signup" className="btn btn-green btn-sm">Criar conta</Link>
                        </div>
                    ) : (
                        <div ref={menuRef} style={{ position: 'relative' }}>
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '42px', height: '42px', borderRadius: '50%',
                                    background: 'var(--bg-white)', border: '1px solid var(--border-light)',
                                    cursor: 'pointer', transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(14,42,85,0.06)',
                                    color: 'var(--text-dark)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,42,85,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(14,42,85,0.06)'}
                            >
                                <User size={18} strokeWidth={2.5} />
                            </button>

                            <AnimatePresence>
                                {userMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        style={{
                                            position: 'absolute', top: 'calc(100% + 12px)', right: 0,
                                            width: '240px', background: 'var(--bg-white)',
                                            borderRadius: '16px', boxShadow: 'var(--shadow-lg)',
                                            border: '1px solid var(--border-light)',
                                            padding: '8px', zIndex: 100,
                                        }}
                                    >
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', marginBottom: '8px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Logado como</p>
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
                                        </div>
                                        <Link to="/configuracoes" onClick={() => setUserMenuOpen(false)} style={{
                                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
                                            borderRadius: '10px', textDecoration: 'none', color: 'var(--text-body)',
                                            fontWeight: 600, fontSize: '14px', transition: 'background 0.2s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--snow)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <Settings size={16} color="var(--text-muted)" />
                                            Configurações Pessoais
                                        </Link>
                                        <button onClick={() => { setUserMenuOpen(false); handleSignOut(); }} style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
                                            borderRadius: '10px', border: 'none', background: 'transparent', color: '#EF4444',
                                            fontWeight: 600, fontSize: '14px', transition: 'background 0.2s', cursor: 'pointer', marginTop: '4px',
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                        >
                                            <LogOut size={16} />
                                            Sair da conta
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </header>

        {/* Mobile bottom navigation */}
        {user && variant === 'app' && (
            <nav className="fly-bottom-nav">
                {NAV_ITEMS.map((item, i) => {
                    const Icon = item.icon
                    const isActive = activeIndex === i
                    return (
                        <button key={item.to} onClick={() => navigate(item.to)} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                            padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '10px', fontWeight: 600,
                            color: isActive ? 'var(--blue-navy)' : 'var(--text-muted)',
                            transition: 'color 0.15s', minWidth: 0, flex: 1,
                        }}>
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{item.title}</span>
                        </button>
                    )
                })}
            </nav>
        )}

        <style>{`
            @media (max-width: 768px) {
                .fly-header-grid { height: 64px !important; padding: 0 16px !important; max-width: 100% !important; }
                .fly-logo { height: 48px !important; }
                .fly-nav-tabs { display: none !important; }
                .fly-hide-xs { display: none !important; }
                .fly-bottom-nav {
                    display: flex !important;
                    position: fixed; bottom: 0; left: 0; right: 0;
                    background: var(--bg-white);
                    border-top: 1px solid var(--border-light);
                    z-index: 200;
                    padding-bottom: env(safe-area-inset-bottom, 8px);
                    justify-content: space-around;
                }
            }
            .fly-bottom-nav { display: none; }
        `}</style>
        </>
    )
}
