import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, X } from 'lucide-react'

export interface FilterState {
    programs: string[]
    stops: string[]
    cabin: string
    minMiles: string
    maxMiles: string
}

const PROGRAMS = ['Smiles', 'LATAM Pass', 'TudoAzul']

export function Sidebar({ filters, setFilters }: { filters: FilterState, setFilters: (f: FilterState) => void }) {
    const [sections, setSections] = useState({ programs: true, stops: true, cabin: true, miles: false })
    const toggle = (k: keyof typeof sections) => setSections(s => ({ ...s, [k]: !s[k] }))

    const toggleProgram = (p: string) => {
        const next = filters.programs.includes(p)
            ? filters.programs.filter(x => x !== p)
            : [...filters.programs, p]
        setFilters({ ...filters, programs: next })
    }
    const toggleStop = (s: string) => {
        const next = filters.stops.includes(s)
            ? filters.stops.filter(x => x !== s)
            : [...filters.stops, s]
        setFilters({ ...filters, stops: next })
    }

    const SectionHeader = ({ label, k }: { label: string, k: keyof typeof sections }) => (
        <button onClick={() => toggle(k)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)',
            padding: '14px 0', cursor: 'pointer', fontFamily: 'inherit',
        }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--graphite)' }}>{label}</span>
            {sections[k] ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </button>
    )

    const CheckRow = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 0' }}>
            <div onClick={onChange} style={{
                width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0,
                border: `2px solid ${checked ? 'var(--green-strat)' : 'var(--border-mid)'}`,
                background: checked ? 'var(--green-strat)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
            }}>
                {checked && <CheckCircle size={10} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-body)' }}>{label}</span>
        </label>
    )

    return (
        <aside style={{
            width: '230px', flexShrink: 0,
            background: '#fff',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            padding: '20px',
            height: 'fit-content',
            position: 'sticky',
            top: '80px',
            boxShadow: 'var(--shadow-xs)',
        }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Filtros
            </p>

            {/* Programs */}
            <SectionHeader label="Programas de Milhas" k="programs" />
            {sections.programs && (
                <div style={{ padding: '8px 0' }}>
                    {PROGRAMS.map(p => (
                        <CheckRow key={p} label={p} checked={filters.programs.includes(p)} onChange={() => toggleProgram(p)} />
                    ))}
                </div>
            )}

            {/* Stops */}
            <SectionHeader label="Conexões" k="stops" />
            {sections.stops && (
                <div style={{ padding: '8px 0' }}>
                    {[['Direto', 'direct'], ['1 conexão', '1stop'], ['2+ conexões', '2plus']].map(([label, val]) => (
                        <CheckRow key={val} label={label} checked={filters.stops.includes(val)} onChange={() => toggleStop(val)} />
                    ))}
                </div>
            )}

            {/* Cabin */}
            <SectionHeader label="Classe" k="cabin" />
            {sections.cabin && (
                <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[['Econômica', 'economy'], ['Executiva', 'business'], ['Primeira', 'first']].map(([label, val]) => (
                        <button key={val} onClick={() => setFilters({ ...filters, cabin: val })} style={{
                            padding: '7px 12px', borderRadius: '8px', border: `1px solid ${filters.cabin === val ? 'var(--green-strat)' : 'var(--border-light)'}`,
                            background: filters.cabin === val ? 'rgba(14,107,87,0.08)' : 'transparent',
                            fontFamily: 'inherit', fontSize: '13px', fontWeight: 500,
                            color: filters.cabin === val ? 'var(--green-strat)' : 'var(--text-body)',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}>{label}</button>
                    ))}
                </div>
            )}

            {/* Clear */}
            <button onClick={() => setFilters({ programs: [], stops: [], cabin: 'economy', minMiles: '', maxMiles: '' })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'inherit', fontWeight: 600 }}>
                <X size={12} /> Limpar filtros
            </button>
        </aside>
    )
}
