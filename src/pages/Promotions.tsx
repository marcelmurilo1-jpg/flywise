import { Header } from '@/components/Header'
import { PromotionsSection } from '@/components/PromotionsSection'
import { Tag } from 'lucide-react'

export default function Promotions() {
    return (
        <div style={{ minHeight: '100vh', background: '#080a10' }}>
            <Header variant="app" />

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px 80px' }}>
                {/* Page header */}
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Tag size={20} color="#f59e0b" />
                        </div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9' }}>
                            Promoções de Milhas
                        </h1>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '500px' }}>
                        Promoções extraídas automaticamente do Passageiro de Primeira, atualizadas a cada hora.
                        Clique em qualquer card para ver o artigo completo.
                    </p>
                </div>

                <PromotionsSection limit={24} />
            </div>
        </div>
    )
}
