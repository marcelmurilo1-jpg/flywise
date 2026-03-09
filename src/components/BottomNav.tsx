import { Link, useLocation } from 'react-router-dom'
import { Search, Tag, Wallet, Plane, Map } from 'lucide-react'

const NAV_ITEMS = [
    { to: '/home', icon: Search, label: 'Buscar' },
    { to: '/promotions', icon: Tag, label: 'Promoções' },
    { to: '/wallet', icon: Wallet, label: 'Carteira' },
    { to: '/saved-strategies', icon: Plane, label: 'Estratégias' },
    { to: '/roteiro', icon: Map, label: 'Roteiro' },
]

export function BottomNav() {
    const location = useLocation()

    return (
        <nav className="bottom-nav" aria-label="Navegação principal">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname.startsWith(to)
                return (
                    <Link
                        key={to}
                        to={to}
                        className={`bottom-nav-item${isActive ? ' active' : ''}`}
                    >
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        <span>{label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
