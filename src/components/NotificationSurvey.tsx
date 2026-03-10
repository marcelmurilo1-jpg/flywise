import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Plane, Coins, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const PROGRAMAS = [
  'Smiles',
  'TudoAzul',
  'LATAM Pass',
  'Livelo',
  'Esfera',
  'Flying Blue',
  'AAdvantage',
  'MileagePlus',
  'Outro',
]

type Step = 'intro' | 'tipos' | 'milhas' | 'done'

interface Props {
  onClose: () => void
}

export function NotificationSurvey({ onClose }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('intro')
  const [passagens, setPassagens] = useState(false)
  const [milhas, setMilhas] = useState(false)
  const [programas, setProgramas] = useState<string[]>([])
  const [alertaPromocao, setAlertaPromocao] = useState(true)
  const [alertaAwardSpace, setAlertaAwardSpace] = useState(true)
  const [saving, setSaving] = useState(false)

  const togglePrograma = (p: string) => {
    setProgramas(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const saveToSupabase = async (opts: {
    notificacoes_ativas: boolean
    passagens: boolean
    milhas: boolean
    programas: string[]
    alerta_promocao: boolean
    alerta_award_space: boolean
  }) => {
    if (!user) return
    await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      ...opts,
    })
  }

  const handleDismiss = async () => {
    await saveToSupabase({
      notificacoes_ativas: false,
      passagens: false,
      milhas: false,
      programas: [],
      alerta_promocao: false,
      alerta_award_space: false,
    })
    onClose()
  }

  const handleTiposContinue = () => {
    if (!passagens && !milhas) return
    if (milhas) {
      setStep('milhas')
    } else {
      handleSave()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await saveToSupabase({
      notificacoes_ativas: passagens || milhas,
      passagens,
      milhas,
      programas: milhas ? programas : [],
      alerta_promocao: alertaPromocao,
      alerta_award_space: alertaAwardSpace,
    })
    setSaving(false)
    setStep('done')
    setTimeout(onClose, 2200)
  }

  const nothingSelected = !passagens && !milhas

  const content = (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(8, 10, 16, 0.55)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={handleDismiss}
      />

      <motion.div
        key="sheet"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: 'var(--card-bg, #fff)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 48px rgba(14,42,85,0.14)',
          maxHeight: '92vh',
          overflowY: 'auto',
          fontFamily: 'Manrope, system-ui, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-light, #e2e8f0)' }} />
        </div>

        <div style={{ padding: '20px 24px 40px' }}>
          <AnimatePresence mode="wait">

            {/* ── INTRO ── */}
            {step === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: 'linear-gradient(135deg, #0E2A55, #4a90e2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bell size={22} color="#fff" />
                  </div>
                  <button onClick={handleDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={20} color="var(--text-muted, #94a3b8)" />
                  </button>
                </div>

                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-dark, #0f172a)', marginBottom: 8, lineHeight: 1.3 }}>
                  Quer receber alertas de viagem?
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted, #64748b)', lineHeight: 1.6, marginBottom: 28 }}>
                  Te avisamos quando o preço cair numa rota que você buscou ou quando abrir espaço em milhas — para você nunca perder uma oportunidade.
                </p>

                <button
                  onClick={() => setStep('tipos')}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14,
                    background: 'var(--blue-medium, #4a90e2)', color: '#fff',
                    fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(74,144,226,0.3)', marginBottom: 10,
                  }}
                >
                  Sim, quero alertas
                </button>
                <button
                  onClick={handleDismiss}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 14,
                    background: 'transparent', color: 'var(--text-muted, #64748b)',
                    fontSize: 14, fontWeight: 600, border: '1.5px solid var(--border-light, #e2e8f0)',
                    cursor: 'pointer',
                  }}
                >
                  Agora não
                </button>
              </motion.div>
            )}

            {/* ── TIPOS ── */}
            {step === 'tipos' && (
              <motion.div key="tipos" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <button onClick={() => setStep('intro')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: 'var(--text-muted, #64748b)', fontSize: 13, fontWeight: 600 }}>
                    ← Voltar
                  </button>
                </div>

                <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-dark, #0f172a)', marginBottom: 6 }}>
                  O que te interessa?
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 24 }}>
                  Pode marcar os dois.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  <TipoCard
                    icon={<Plane size={20} color={passagens ? '#fff' : 'var(--blue-medium, #4a90e2)'} />}
                    title="Passagens em dinheiro"
                    description="Aviso quando o preço cair nas rotas que você pesquisar."
                    selected={passagens}
                    onToggle={() => setPassagens(v => !v)}
                  />
                  <TipoCard
                    icon={<Coins size={20} color={milhas ? '#fff' : 'var(--blue-medium, #4a90e2)'} />}
                    title="Milhas"
                    description="Promoções de transferência, espaço em award e vencimento."
                    selected={milhas}
                    onToggle={() => setMilhas(v => !v)}
                  />
                </div>

                <button
                  onClick={handleTiposContinue}
                  disabled={nothingSelected}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14,
                    background: nothingSelected ? 'var(--border-light, #e2e8f0)' : 'var(--blue-medium, #4a90e2)',
                    color: nothingSelected ? 'var(--text-muted, #94a3b8)' : '#fff',
                    fontSize: 15, fontWeight: 700, border: 'none',
                    cursor: nothingSelected ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Continuar →
                </button>
              </motion.div>
            )}

            {/* ── MILHAS ── */}
            {step === 'milhas' && (
              <motion.div key="milhas" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <button onClick={() => setStep('tipos')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: 'var(--text-muted, #64748b)', fontSize: 13, fontWeight: 600 }}>
                    ← Voltar
                  </button>
                </div>

                <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-dark, #0f172a)', marginBottom: 6 }}>
                  Quais programas você usa?
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 20 }}>
                  Só enviaremos alertas dos programas que você selecionar.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                  {PROGRAMAS.map(p => (
                    <ProgramaChip
                      key={p}
                      label={p}
                      selected={programas.includes(p)}
                      onToggle={() => togglePrograma(p)}
                    />
                  ))}
                </div>

                <div style={{
                  borderTop: '1px solid var(--border-light, #e2e8f0)',
                  paddingTop: 20, marginBottom: 28,
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark, #0f172a)', marginBottom: 14 }}>
                    Quais alertas quer receber?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <AlertaToggle
                      label="Promoções de transferência"
                      description="Quando um programa oferecer bônus para você turbinar seus pontos."
                      value={alertaPromocao}
                      onChange={setAlertaPromocao}
                    />
                    <AlertaToggle
                      label="Espaço em milhas (award space)"
                      description="Quando abrir assento em milhas nas suas rotas monitoradas."
                      value={alertaAwardSpace}
                      onChange={setAlertaAwardSpace}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14,
                    background: 'var(--blue-medium, #4a90e2)', color: '#fff',
                    fontSize: 15, fontWeight: 700, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 6px 20px rgba(74,144,226,0.3)',
                    opacity: saving ? 0.75 : 1, transition: 'opacity 0.2s',
                  }}
                >
                  {saving ? 'Salvando...' : 'Salvar preferências'}
                </button>
              </motion.div>
            )}

            {/* ── DONE ── */}
            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28 }}
                style={{ textAlign: 'center', padding: '24px 0 16px' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 260, delay: 0.1 }}
                  style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                  }}
                >
                  <Check size={28} color="#fff" strokeWidth={3} />
                </motion.div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-dark, #0f172a)', marginBottom: 8 }}>
                  Tudo certo!
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted, #64748b)', lineHeight: 1.6 }}>
                  Suas preferências foram salvas. Você vai receber alertas personalizados conforme o que configurou.
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TipoCard({
  icon, title, description, selected, onToggle,
}: {
  icon: React.ReactNode
  title: string
  description: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px', borderRadius: 14, cursor: 'pointer',
        border: selected ? '2px solid var(--blue-medium, #4a90e2)' : '2px solid var(--border-light, #e2e8f0)',
        background: selected ? 'var(--blue-medium, #4a90e2)' : 'var(--card-bg, #fff)',
        transition: 'all 0.18s', textAlign: 'left', width: '100%',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: selected ? 'rgba(255,255,255,0.2)' : 'rgba(74,144,226,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: selected ? '#fff' : 'var(--text-dark, #0f172a)', marginBottom: 3 }}>
          {title}
        </p>
        <p style={{ fontSize: 12.5, color: selected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted, #64748b)', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: selected ? '2px solid rgba(255,255,255,0.6)' : '2px solid var(--border-light, #e2e8f0)',
          background: selected ? 'rgba(255,255,255,0.9)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue-medium, #4a90e2)' }} />}
        </div>
      </div>
    </button>
  )
}

function ProgramaChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        border: selected ? '1.5px solid var(--blue-medium, #4a90e2)' : '1.5px solid var(--border-light, #e2e8f0)',
        background: selected ? 'rgba(74,144,226,0.1)' : 'var(--card-bg, #fff)',
        color: selected ? 'var(--blue-medium, #4a90e2)' : 'var(--text-muted, #64748b)',
        transition: 'all 0.15s',
      }}
    >
      {selected ? '✓ ' : ''}{label}
    </button>
  )
}

function AlertaToggle({
  label, description, value, onChange,
}: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', borderRadius: 12,
        background: value ? 'rgba(74,144,226,0.05)' : 'var(--snow, #f8fafc)',
        border: '1px solid var(--border-light, #e2e8f0)',
        cursor: 'pointer',
      }}
      onClick={() => onChange(!value)}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark, #0f172a)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', lineHeight: 1.5 }}>{description}</p>
      </div>
      {/* Toggle switch */}
      <div
        style={{
          width: 42, height: 24, borderRadius: 12, flexShrink: 0, marginTop: 2,
          background: value ? 'var(--blue-medium, #4a90e2)' : 'var(--border-light, #cbd5e1)',
          position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 3,
          left: value ? 21 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )
}
