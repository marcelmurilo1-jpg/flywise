import { Plane, ArrowLeftRight, Search, Loader2 } from 'lucide-react'

interface SearchBarTopProps {
    origin: string
    setOrigin: (v: string) => void
    dest: string
    setDest: (v: string) => void
    dateGo: string
    setDateGo: (v: string) => void
    pax: number
    setPax: (v: number) => void
    loading: boolean
    error: string
    onSubmit: (e: React.FormEvent) => void
}

export function SearchBarTop({
    origin, setOrigin, dest, setDest, dateGo, setDateGo, pax, setPax,
    loading, error, onSubmit
}: SearchBarTopProps) {
    const swap = () => { setOrigin(dest); setDest(origin) }

    return (
        <form onSubmit={onSubmit}>
            <div style={{
                display: 'flex', alignItems: 'stretch', gap: '0',
                background: 'var(--bg-white)',
                border: '1px solid var(--border-light)',
                borderRadius: '14px',
                overflow: 'hidden',
                height: '52px',
                boxShadow: '0 4px 12px rgba(14,42,85,0.04)',
            }}>
                {/* Origin */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: '8px', borderRight: '1px solid var(--border-light)', minWidth: '140px' }}>
                    <Plane size={14} color="var(--text-faint)" />
                    <input type="text" placeholder="De — GRU" value={origin} maxLength={3}
                        onChange={e => setOrigin(e.target.value.toUpperCase())}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-dark)', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, width: '100%', outline: 'none', letterSpacing: '0.04em' }} />
                </div>

                {/* Swap */}
                <button type="button" onClick={swap} style={{
                    padding: '0 10px', background: 'none', border: 'none',
                    borderRight: '1px solid var(--border-light)',
                    cursor: 'pointer', color: 'var(--text-muted)',
                    transition: 'color 0.2s, background 0.2s', flexShrink: 0,
                }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-dark)'; e.currentTarget.style.background = 'var(--snow)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                    <ArrowLeftRight size={14} />
                </button>

                {/* Destination */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: '8px', borderRight: '1px solid var(--border-light)', minWidth: '140px' }}>
                    <Plane size={14} color="var(--text-faint)" style={{ transform: 'scaleX(-1)' }} />
                    <input type="text" placeholder="Para — JFK" value={dest} maxLength={3}
                        onChange={e => setDest(e.target.value.toUpperCase())}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-dark)', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, width: '100%', outline: 'none', letterSpacing: '0.04em' }} />
                </div>

                {/* Date */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderRight: '1px solid var(--border-light)', minWidth: '150px' }}>
                    <input type="date" value={dateGo} onChange={e => setDateGo(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ border: 'none', background: 'transparent', color: dateGo ? 'var(--text-dark)' : 'var(--text-muted)', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 500, outline: 'none', cursor: 'pointer', width: '100%' }} />
                </div>

                {/* Passengers */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRight: '1px solid var(--border-light)', minWidth: '110px' }}>
                    <select value={pax} onChange={e => setPax(Number(e.target.value))}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-dark)', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 500, outline: 'none', cursor: 'pointer', width: '100%' }}>
                        {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n} style={{ background: '#fff' }}>{n} {n === 1 ? 'Adulto' : 'Adultos'}</option>)}
                    </select>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} style={{
                    padding: '0 22px', background: 'var(--blue-medium)', border: 'none',
                    color: '#fff', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background 0.18s', flexShrink: 0, letterSpacing: '0.01em',
                }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--blue-vibrant)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--blue-medium)' }}
                >
                    {loading ? <Loader2 size={16} className="spin" /> : <Search size={15} />}
                    {loading ? 'Analisando...' : 'Analisar'}
                </button>
            </div>

            {/* Error inline */}
            {error && (
                <p style={{ fontSize: '12px', color: '#f87171', marginTop: '8px', paddingLeft: '4px' }}>{error}</p>
            )}
        </form>
    )
}
