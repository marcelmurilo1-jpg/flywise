import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plane, Search, Tag, LogOut, User, LayoutGrid, Sliders } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
    variant?: 'landing' | 'app'
}

const NAV_ITEMS = [
    { to: '/home', icon: <Search size={15} />, label: 'Buscar' },
    { to: '/home#insights', icon: <LayoutGrid size={15} />, label: 'Insights' },
    { to: '/promotions', icon: <Tag size={15} />, label: 'Promoções' },
    { to: '/home#settings', icon: <Sliders size={15} />, label: 'Configurações' },
]

export function Header({ variant = 'app' }: HeaderProps) {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleSignOut = async () => {
        await signOut()
        navigate('/')
    }

    /* Landing uses its own header over the photo — nothing to render */
    if (variant === 'landing') return null

    return (
        <header style={{
            background: 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', height: '56px', gap: '16px' }}>

                {/* Logo */}
                <Link to={user ? '/home' : '/'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '9px', marginRight: 'auto' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'var(--green-strat)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(14,107,87,0.4)',
                    }}>
                        <Plane size={13} color="#fff" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: '#fff', letterSpacing: '-0.03em' }}>
                        FlyWise
                    </span>
                </Link>

                {/* App nav */}
                {user && variant === 'app' && (
                    <nav style={{
                        display: 'flex', alignItems: 'center', gap: '2px',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', padding: '4px',
                    }}>
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
                                        textDecoration: 'none', transition: 'all 0.18s ease',
                                        background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                        color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                                        fontSize: '13px', fontWeight: isActive ? 600 : 500,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {item.icon}
                                    {isActive && <span>{item.label}</span>}
                                </Link>
                            )
                        })}
                    </nav>
                )}

                {/* Landing CTAs — handled by FloatingNav in Landing.tsx */}
                {!user && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Link to="/auth" className="btn btn-ghost btn-sm">Entrar</Link>
                        <Link to="/auth?tab=signup" className="btn btn-green btn-sm">Começar grátis</Link>
                    </div>
                )}

                {/* User area */}
                {user && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '8px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '10px', padding: '5px 10px 5px 6px',
                            cursor: 'default',
                        }}>
                            <div style={{
                                width: '26px', height: '26px', borderRadius: '7px',
                                background: 'var(--green-strat)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <User size={13} color="#fff" strokeWidth={2.5} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user.email?.split('@')[0]}
                            </span>
                        </div>
                        <button
                            onClick={handleSignOut}
                            title="Sair"
                            style={{
                                width: '34px', height: '34px', borderRadius: '9px',
                                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                )}
            </div>
        </header>
    )
}
