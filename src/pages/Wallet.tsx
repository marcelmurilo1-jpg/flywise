import { useState, useEffect } from 'react'
import { Wallet as WalletIcon, Plus, Pencil, Check, X, Trash2, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { PROGRAMS } from '@/lib/airlineMilesMapping'

type MilesMap = Record<string, number>

// Cores por programa
const PROGRAM_COLORS: Record<string, string> = {
    'Smiles': '#FF6B00',
    'LATAM Pass': '#E3000F',
    'TudoAzul': '#003DA5',
    'Livelo': '#8B5CF6',
    'Aeroplan': '#E31837',
    'AAdvantage': '#00467F',
    'MileagePlus': '#005DAA',
    'Flying Blue': '#00A3E0',
    'Lifemiles': '#FF5C00',
    'Miles&More': '#FFCC00',
    'Iberia Plus': '#DC241F',
    'Miles&Go': '#009B3A',
    'ConnectMiles': '#003087',
    'ShebaMiles': '#1A6D3A',
    'Miles&Smiles': '#E30A17',
    'SkyMiles': '#CC0000',
}

function programInitials(name: string): string {
    return name.split(/[\s&]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Wallet() {
    const { user } = useAuth()
    const [miles, setMiles] = useState<MilesMap>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingProgram, setEditingProgram] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [selectedNew, setSelectedNew] = useState('')
    const [newBalance, setNewBalance] = useState('')

    // Carrega saldo do user_metadata do Supabase Auth
    useEffect(() => {
        if (!user) return
        const stored: MilesMap = (user.user_metadata?.miles as MilesMap) ?? {}
        setMiles(stored)
        setLoading(false)
    }, [user])

    const saveMiles = async (updated: MilesMap) => {
        setSaving(true)
        await supabase.auth.updateUser({ data: { miles: updated } })
        setSaving(false)
    }

    const handleEdit = (program: string) => {
        setEditingProgram(program)
        setEditValue(String(miles[program] ?? 0))
    }

    const handleSaveEdit = async () => {
        if (!editingProgram) return
        const val = parseInt(editValue.replace(/\D/g, '')) || 0
        const updated = { ...miles, [editingProgram]: val }
        setMiles(updated)
        setEditingProgram(null)
        await saveMiles(updated)
    }

    const handleDelete = async (program: string) => {
        const updated = { ...miles }
        delete updated[program]
        setMiles(updated)
        await saveMiles(updated)
    }

    const handleAdd = async () => {
        if (!selectedNew) return
        const val = parseInt(newBalance.replace(/\D/g, '')) || 0
        const updated = { ...miles, [selectedNew]: val }
        setMiles(updated)
        setShowAddModal(false)
        setSelectedNew('')
        setNewBalance('')
        await saveMiles(updated)
    }

    const totalMiles = Object.values(miles).reduce((a, b) => a + b, 0)
    const programs = Object.keys(miles)
    const availableToAdd = PROGRAMS.filter(p => !programs.includes(p))

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif', paddingBottom: '60px' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '840px', margin: '40px auto 0', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Minha Carteira</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Gerencie seu saldo de milhas em todos os programas.</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        style={{ background: 'var(--blue-medium)', color: '#fff', padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Adicionar Programa
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <Loader2 size={32} color="var(--blue-medium)" className="spin" />
                    </div>
                ) : (
                    <>
                        {/* Resumo total */}
                        {programs.length > 0 && (
                            <div style={{ background: 'linear-gradient(135deg, #0E2A55, #2A60C2)', borderRadius: '20px', padding: '24px 28px', marginBottom: '24px', color: '#fff' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: '6px' }}>
                                    Total em milhas
                                </p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                    <span style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                                        {totalMiles.toLocaleString('pt-BR')}
                                    </span>
                                    <span style={{ fontSize: '16px', opacity: 0.7 }}>pts</span>
                                </div>
                                <p style={{ fontSize: '13px', opacity: 0.6, marginTop: '4px' }}>
                                    {programs.length} {programs.length === 1 ? 'programa' : 'programas'} cadastrado{programs.length !== 1 ? 's' : ''}
                                    {saving && <span style={{ marginLeft: '8px' }}>· salvando...</span>}
                                </p>
                            </div>
                        )}

                        {/* Lista de programas */}
                        {programs.length === 0 ? (
                            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '48px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--snow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <WalletIcon size={28} color="var(--blue-medium)" />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)' }}>Nenhum programa adicionado</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '320px', fontSize: '14px', lineHeight: 1.6 }}>
                                    Adicione o saldo das suas contas Smiles, LATAM Pass, TudoAzul e Livelo para melhorar a precisão das estratégias de IA.
                                </p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    style={{ background: 'var(--blue-medium)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <Plus size={16} /> Adicionar primeiro programa
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <AnimatePresence>
                                    {programs.map((prog, i) => {
                                        const color = PROGRAM_COLORS[prog] ?? '#0E2A55'
                                        const saldo = miles[prog] ?? 0
                                        const isEditing = editingProgram === prog

                                        return (
                                            <motion.div
                                                key={prog}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ delay: i * 0.04 }}
                                                style={{ background: 'var(--bg-white)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(14,42,85,0.04)' }}
                                            >
                                                {/* Ícone do programa */}
                                                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '0.02em' }}>
                                                        {programInitials(prog)}
                                                    </span>
                                                </div>

                                                {/* Nome + saldo */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '2px' }}>{prog}</div>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editValue}
                                                            autoFocus
                                                            onChange={e => setEditValue(e.target.value.replace(/\D/g, ''))}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingProgram(null) }}
                                                            style={{ border: '1.5px solid var(--blue-medium)', borderRadius: '8px', padding: '4px 10px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, color: 'var(--blue-medium)', outline: 'none', width: '160px' }}
                                                        />
                                                    ) : (
                                                        <div style={{ fontSize: '20px', fontWeight: 900, color: color, letterSpacing: '-0.01em' }}>
                                                            {saldo.toLocaleString('pt-BR')} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>pts</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ações */}
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {isEditing ? (
                                                        <>
                                                            <button onClick={handleSaveEdit} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex' }}>
                                                                <Check size={14} />
                                                            </button>
                                                            <button onClick={() => setEditingProgram(null)} style={{ background: 'var(--snow)', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex' }}>
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleEdit(prog)} style={{ background: 'var(--snow)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', transition: 'background 0.15s' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#eef2f8'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'var(--snow)'}
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button onClick={() => handleDelete(prog)} style={{ background: 'none', border: 'none', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', color: '#EF4444', transition: 'background 0.15s' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Modal adicionar programa */}
            <AnimatePresence>
                {showAddModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(3px)', zIndex: 200 }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(420px, 92vw)', background: 'var(--bg-white)', borderRadius: '20px', padding: '28px', zIndex: 201, boxShadow: '0 24px 80px rgba(14,42,85,0.18)' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-dark)' }}>Adicionar programa</h2>
                                <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Programa</label>
                                    <select
                                        value={selectedNew}
                                        onChange={e => setSelectedNew(e.target.value)}
                                        style={{ width: '100%', border: '1.5px solid var(--border-light)', borderRadius: '10px', padding: '10px 14px', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text-dark)', background: '#fff', outline: 'none', cursor: 'pointer' }}
                                    >
                                        <option value="">Selecione um programa...</option>
                                        {availableToAdd.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Saldo de milhas</label>
                                    <input
                                        type="text"
                                        value={newBalance}
                                        onChange={e => setNewBalance(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Ex: 50000"
                                        style={{ width: '100%', border: '1.5px solid var(--border-light)', borderRadius: '10px', padding: '10px 14px', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text-dark)', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => e.currentTarget.style.borderColor = 'var(--blue-medium)'}
                                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                                    />
                                </div>

                                <button
                                    onClick={handleAdd}
                                    disabled={!selectedNew}
                                    style={{ width: '100%', background: selectedNew ? 'var(--blue-medium)' : '#E2E8F0', color: selectedNew ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '12px', padding: '13px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, cursor: selectedNew ? 'pointer' : 'not-allowed', marginTop: '4px', transition: 'all 0.2s' }}
                                >
                                    Adicionar programa
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
