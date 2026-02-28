import { Plane, Search } from 'lucide-react'
import { Header } from '@/components/Header'
import { useNavigate } from 'react-router-dom'

export default function SavedStrategies() {
    const navigate = useNavigate()

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif', paddingBottom: '60px' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '840px', margin: '40px auto 0', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Estratégias Salvas</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Histórico das suas melhores rotas e análises personalizadas.</p>
                    </div>
                </div>

                <div className="card" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(14,42,85,0.04)', border: '1px solid var(--border-light)', background: 'var(--bg-white)' }}>
                    <div style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--snow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plane size={28} color="var(--blue-medium)" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)' }}>Nenhuma estratégia salva</h3>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto', fontSize: '14px', lineHeight: 1.6 }}>
                            Você ainda não salvou nenhuma rota. Realize uma busca para encontrar as melhores emissões.
                        </p>
                        <button onClick={() => navigate('/home')} style={{ marginTop: '8px', background: 'var(--snow)', color: 'var(--text-dark)', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eef2f8'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--snow)'}
                        >
                            <Search size={16} color="var(--blue-medium)" /> Fazer Nova Busca
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}
