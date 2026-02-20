import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plane, Search, Tag, LogOut, User, LayoutGrid, Users, Sliders } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
    variant?: 'landing' | 'app'
}

const NAV_ITEMS = [
    { to: '/home', icon: <Search size={16} />, label: 'Buscar' },
    { to: '/home#insights', icon: <LayoutGrid size={16} />, label: 'Insights' },
    { to: '/home', icon: <Plane size={16} />, label: 'Voos', labelShort: 'Voos' },
    { to: '/promotions', icon: <Users size={16} />, label: 'Promoções' },
    { to: '/home#settings', icon: <Sliders size={16} />, label: 'Configurações' },
]

export function Header({ variant = 'app' }: HeaderProps) {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleSignOut = async () => {
        await signOut()
        navigate('/')
    }

    return (
        <header style={{
            position: 'sticky', top: 0, zIndex: 50,
            background: 'rgba(255,255,255,0.80)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid var(--border-faint)',
        }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '58px', gap: '16px' }}>

                    {/* Logo */}
                    <Link to={user ? '/home' : '/'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '9px', marginRight: 'auto' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,0.28)' }}>
                            <Plane size={14} color="#fff" strokeWidth={2.5} />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                            Fly<span className="gradient-text">Wise</span>
                        </span>
                    </Link>

                    {/* App nav — AirAxis pill style */}
                    {user && variant === 'app' && (
                        <nav style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'var(--bg-subtle)', border: '1px solid var(--border-faint)', borderRadius: '13px', padding: '4px' }}>
                            {NAV_ITEMS.map((item) => {
                                const isActive = location.pathname === item.to && !item.to.includes('#')
                                return (
                                    <Link
                                        key={item.label}
                                        to={item.to}
                                        title={item.label}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '6px 12px', borderRadius: '9px',
                                            textDecoration: 'none', transition: 'all 0.15s ease',
                                            background: isActive ? '#1a1a2e' : 'transparent',
                                            color: isActive ? '#fff' : 'var(--text-muted)',
                                            fontSize: '13px', fontWeight: isActive ? 600 : 500,
                                            boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {item.icon}
                                        {/* Show label only for active to keep compact */}
                                        {isActive && item.labelShort !== undefined && (
                                            <span>{item.labelShort}</span>
                                        )}
                                    </Link>
                                )
                            })}
                        </nav>
                    )}

                    {/* Landing CTAs */}
                    {!user && variant === 'landing' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Link to="/auth" className="btn btn-ghost btn-sm">Entrar</Link>
                            <Link to="/auth?tab=signup" className="btn btn-primary btn-sm">Começar grátis</Link>
                        </div>
                    )}

                    {/* User */}
                    {user && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '8px' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'var(--bg-surface)', border: '1px solid var(--border-faint)',
                                borderRadius: '10px', padding: '5px 10px 5px 6px',
                                boxShadow: 'var(--shadow-xs)', cursor: 'default',
                            }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={14} color="#fff" strokeWidth={2.5} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.email?.split('@')[0]}
                                </span>
                            </div>
                            <button onClick={handleSignOut} className="icon-btn" title="Sair" style={{ width: '34px', height: '34px' }}>
                                <LogOut size={14} />
                            </button>
                        </div>
                    )}

                    {/* Landing: tag promo quick */}
                    {user && variant === 'app' && (
                        <Link to="/promotions" className="icon-btn" title="Promoções" style={{ textDecoration: 'none', width: '34px', height: '34px' }}>
                            <Tag size={15} />
                        </Link>
                    )}
                </div>
            </div>
        </header>
    )
}
