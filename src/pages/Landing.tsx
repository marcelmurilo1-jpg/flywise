import { Link } from 'react-router-dom'
import { Plane, ArrowRight, Zap, TrendingDown, Brain, Star, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Header } from '@/components/Header'
import { PromotionsSection } from '@/components/PromotionsSection'
import { GlobeRoute } from '@/components/GlobeRoute'

export default function Landing() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
            <Header variant="landing" />

            {/* Hero */}
            <section style={{
                padding: '80px 24px 100px',
                maxWidth: '1180px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '60px',
                alignItems: 'center',
            }}>
                <motion.div
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    style={{ maxWidth: '580px' }}
                >
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <span className="pill pill-blue" style={{ marginBottom: '24px', display: 'inline-flex' }}>
                            <Zap size={12} /> IA que decide o melhor voo por você
                        </span>
                    </motion.div>

                    <h1 style={{
                        fontSize: 'clamp(38px, 5vw, 64px)',
                        fontWeight: 900,
                        lineHeight: 1.07,
                        letterSpacing: '-0.035em',
                        color: 'var(--text-primary)',
                        marginBottom: '20px',
                    }}>
                        Viaje mais,<br />
                        pague <span className="gradient-text">muito menos</span>
                    </h1>

                    <p style={{
                        fontSize: '18px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                        marginBottom: '36px',
                        maxWidth: '460px',
                    }}>
                        Cruzamos automaticamente preços em dinheiro, promoções de milhas e
                        transferências com bônus. Você recebe o melhor plano — em segundos.
                    </p>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '40px' }}>
                        <Link to="/auth?tab=signup" className="btn btn-primary btn-lg">
                            Começar grátis <ArrowRight size={17} />
                        </Link>
                        <Link to="/auth" className="btn btn-outline btn-lg">
                            Já tenho conta
                        </Link>
                    </div>

                    {/* Social proof */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex' }}>
                            {['#93c5fd', '#a5b4fc', '#6ee7b7', '#fca5a5'].map((c, i) => (
                                <div key={i} style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: '2px solid white', marginLeft: i > 0 ? '-8px' : 0, boxShadow: 'var(--shadow-xs)' }} />
                            ))}
                        </div>
                        <div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={13} fill="#f59e0b" color="#f59e0b" />)}
                            </div>
                            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>+2.400 viajantes já economizaram</span>
                        </div>
                    </div>
                </motion.div>

                {/* Globe */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    style={{ flexShrink: 0, marginBottom: '32px' }}
                >
                    <GlobeRoute origem="GRU" destino="JFK" />
                </motion.div>
            </section>

            {/* How it works */}
            <section style={{
                background: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-faint)',
                borderBottom: '1px solid var(--border-faint)',
                padding: '80px 24px',
            }}>
                <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '52px' }}>
                        <span className="pill pill-blue" style={{ marginBottom: '14px' }}>Como funciona</span>
                        <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '10px' }}>
                            Simples como deve ser
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Três passos para economizar centenas de reais</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                        {[
                            { icon: <Search16 />, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', title: 'Busque seu voo', desc: 'Origem, destino, datas e seus saldos de milhas (Smiles, LATAM, TudoAzul).', step: '01' },
                            { icon: <TrendingDown size={22} />, color: '#10b981', bg: 'rgba(16,185,129,0.08)', title: 'Pré-check automático', desc: 'Cruzamos CPM, promoções de transferência e alternativas antes de qualquer clique.', step: '02' },
                            { icon: <Brain size={22} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', title: 'Estratégia da IA', desc: 'Um plano em português simples: qual programa, quando transferir, como emitir.', step: '03' },
                        ].map((f, i) => (
                            <motion.div
                                key={f.step}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="card"
                                style={{ padding: '28px', position: 'relative', overflow: 'hidden', cursor: 'default' }}
                                whileHover={{ y: -4 }}
                            >
                                <div style={{ position: 'absolute', top: '16px', right: '18px', fontSize: '48px', fontWeight: 900, color: 'rgba(0,0,0,0.03)', lineHeight: 1 }}>{f.step}</div>
                                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: '18px' }}>
                                    {f.icon}
                                </div>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{f.title}</h3>
                                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.65 }}>{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Promotions */}
            <section style={{ padding: '80px 24px', maxWidth: '1180px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '4px' }}>Promoções ao vivo</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Atualizado a cada hora pelo nosso scraper</p>
                    </div>
                    <Link to="/auth" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Ver todas <ChevronRight size={14} />
                    </Link>
                </div>
                <PromotionsSection limit={3} />
            </section>

            {/* CTA */}
            <section style={{ padding: '0 24px 100px', maxWidth: '1180px', margin: '0 auto' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)',
                        border: '1px solid rgba(59,130,246,0.15)',
                        borderRadius: '24px', padding: '56px 40px', textAlign: 'center',
                        boxShadow: '0 4px 40px rgba(59,130,246,0.08)',
                    }}
                >
                    <h2 style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Pronto para economizar?
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '28px', maxWidth: '440px', margin: '0 auto 28px' }}>
                        Crie uma conta grátis e comece a encontrar as melhores estratégias de viagem hoje.
                    </p>
                    <Link to="/auth?tab=signup" className="btn btn-primary btn-lg">
                        Começar agora — grátis <ArrowRight size={17} />
                    </Link>
                </motion.div>
            </section>

            {/* Footer */}
            <footer style={{ borderTop: '1px solid var(--border-faint)', padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginBottom: '6px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plane size={11} color="#fff" />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>FlyWise</span>
                </div>
                <p style={{ color: 'var(--text-faint)', fontSize: '12px' }}>© 2026 FlyWise · Inteligência aérea</p>
            </footer>
        </div>
    )
}

function Search16() {
    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
}
