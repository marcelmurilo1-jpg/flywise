import { Wallet as WalletIcon, Plus } from 'lucide-react'
import { Header } from '@/components/Header'

export default function Wallet() {

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif', paddingBottom: '60px' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '840px', margin: '40px auto 0', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Minha Carteira</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Gerencie seu saldo de milhas em todos os programas.</p>
                    </div>
                    <button className="btn" style={{ background: 'var(--blue-medium)', color: '#fff', padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer' }}>
                        <Plus size={16} /> Adicionar Programa
                    </button>
                </div>

                <div className="card" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(14,42,85,0.04)', border: '1px solid var(--border-light)', background: 'var(--bg-white)' }}>
                    {/* Placeholder content for wallet */}
                    <div style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--snow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <WalletIcon size={28} color="var(--blue-medium)" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)' }}>Nenhum programa adicionado</h3>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto', fontSize: '14px', lineHeight: 1.6 }}>
                            Adicione o saldo das suas contas Smiles, LATAM Pass, TudoAzul e Livelo para melhorar a precisão das estratégias.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
