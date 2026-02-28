import { Plane, ArrowLeftRight, Search, Loader2 } from 'lucide-react'
import { AirportInput } from './AirportInput'

interface SearchBarTopProps {
    origin: string
    setOrigin: (v: string) => void
    originIata: string
    setOriginIata: (v: string) => void
    dest: string
    setDest: (v: string) => void
    destIata: string
    setDestIata: (v: string) => void
    dateGo: string
    setDateGo: (v: string) => void
    dateBack?: string
    setDateBack?: (v: string) => void
    tripType?: 'one-way' | 'round-trip'
    setTripType?: (v: 'one-way' | 'round-trip') => void
    pax: number
    setPax: (v: number) => void
    loading: boolean
    error: string
    onSubmit: (e: React.FormEvent) => void
}

export function SearchBarTop({
    origin, setOrigin, originIata, setOriginIata,
    dest, setDest, destIata, setDestIata,
    dateGo, setDateGo,
    dateBack = '', setDateBack,
    tripType = 'round-trip', setTripType,
    pax, setPax,
    loading, error, onSubmit
}: SearchBarTopProps) {
    const swap = () => {
        const tmpL = origin; const tmpI = originIata
        setOrigin(dest); setOriginIata(destIata)
        setDest(tmpL); setDestIata(tmpI)
    }

    return (
        <form onSubmit={onSubmit}>
            {/* Trip type selector */}
            {setTripType && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {(['round-trip', 'one-way'] as const).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTripType(t)}
                            style={{
                                padding: '4px 12px', borderRadius: '999px',
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                                background: tripType === t ? 'var(--blue-medium)' : 'var(--bg-white)',
                                color: tripType === t ? '#fff' : 'var(--text-muted)',
                                border: tripType === t ? '1px solid var(--blue-medium)' : '1px solid var(--border-light)',
                                transition: 'all 0.15s',
                            }}
                        >
                            {t === 'round-trip' ? '⇄ Ida e volta' : '→ Só ida'}
                        </button>
                    ))}
                </div>
            )}

            <div style={{
                display: 'flex', alignItems: 'stretch',
                background: 'var(--bg-white)',
                border: '1px solid var(--border-light)',
                borderRadius: '14px',
                height: '52px',
                boxShadow: '0 4px 12px rgba(14,42,85,0.04)',
                overflow: 'visible',
            }}>
                {/* Origin */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: '6px', borderRight: '1px solid var(--border-light)', flex: '1 1 160px', minWidth: 0, overflow: 'visible' }}>
                    <AirportInput
                        value={origin} iataCode={originIata}
                        onChange={(d, i) => { setOrigin(d); setOriginIata(i) }}
                        placeholder="De — GRU"
                        icon={<Plane size={13} color="var(--text-faint)" style={{ flexShrink: 0 }} />}
                    />
                </div>

                {/* Swap */}
                <button type="button" onClick={swap} style={{
                    padding: '0 9px', background: 'none', border: 'none',
                    borderRight: '1px solid var(--border-light)',
                    cursor: 'pointer', color: 'var(--text-muted)',
                    transition: 'color 0.2s, background 0.2s', flexShrink: 0,
                }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-dark)'; e.currentTarget.style.background = 'var(--snow)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                    <ArrowLeftRight size={13} />
                </button>

                {/* Destination */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: '6px', borderRight: '1px solid var(--border-light)', flex: '1 1 160px', minWidth: 0, overflow: 'visible' }}>
                    <AirportInput
                        value={dest} iataCode={destIata}
                        onChange={(d, i) => { setDest(d); setDestIata(i) }}
                        placeholder="Para — JFK"
                        icon={<Plane size={13} color="var(--text-faint)" style={{ transform: 'scaleX(-1)', flexShrink: 0 }} />}
                    />
                </div>

                {/* Date Ida */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', borderRight: '1px solid var(--border-light)', minWidth: '130px' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ida</span>
                    <input type="date" value={dateGo} onChange={e => setDateGo(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ border: 'none', background: 'transparent', color: dateGo ? 'var(--text-dark)' : 'var(--text-muted)', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%' }} />
                </div>

                {/* Date Volta — only when round-trip */}
                {tripType === 'round-trip' && setDateBack && (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', borderRight: '1px solid var(--border-light)', minWidth: '130px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volta</span>
                        <input type="date" value={dateBack} onChange={e => setDateBack(e.target.value)}
                            min={dateGo || new Date().toISOString().split('T')[0]}
                            style={{ border: 'none', background: 'transparent', color: dateBack ? 'var(--text-dark)' : 'var(--text-muted)', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%' }} />
                    </div>
                )}

                {/* Passengers */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRight: '1px solid var(--border-light)', minWidth: '140px' }}>
                    <select value={pax} onChange={e => setPax(Number(e.target.value))}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-dark)', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%' }}>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                            <option key={n} value={n} style={{ background: '#fff' }}>
                                {n} {n === 1 ? 'Passageiro' : 'Passageiros'}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} style={{
                    padding: '0 20px', background: 'var(--blue-medium)', border: 'none',
                    color: '#fff', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1,
                    display: 'flex', alignItems: 'center', gap: '7px',
                    transition: 'background 0.18s', flexShrink: 0,
                    borderRadius: '0 13px 13px 0',
                }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--blue-vibrant)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--blue-medium)' }}
                >
                    {loading ? <Loader2 size={15} className="spin" /> : <Search size={14} />}
                    {loading ? 'Buscando...' : 'Buscar'}
                </button>
            </div>

            {error && (
                <p style={{ fontSize: '12px', color: '#f87171', marginTop: '8px', paddingLeft: '4px' }}>{error}</p>
            )}
        </form>
    )
}
