import { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { MapPin, Loader2 } from 'lucide-react'
import { searchAirports, type Airport } from '@/lib/amadeus'

interface AirportInputProps {
    value: string
    iataCode: string
    onChange: (display: string, iata: string) => void
    placeholder?: string
    icon?: React.ReactNode
    inputStyle?: React.CSSProperties
}

function useDebounce<T>(value: T, delay: number): T {
    const [deb, setDeb] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDeb(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return deb
}

// ─── Portal dropdown — renders at <body> level so no parent clips it ──────────
function DropdownPortal({ anchorRef, children, open }: {
    anchorRef: React.RefObject<HTMLDivElement | null>
    children: React.ReactNode
    open: boolean
}) {
    const [rect, setRect] = useState<DOMRect | null>(null)

    useEffect(() => {
        if (!open || !anchorRef.current) return
        const update = () => {
            if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect())
        }
        update()
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
    }, [open, anchorRef])

    if (!open || !rect) return null

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: rect.bottom + 6,
            left: rect.left,
            width: Math.max(rect.width, 300),
            background: '#fff',
            border: '1px solid #E2EAF5',
            borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(14,42,85,0.16)',
            zIndex: 99999,
            overflow: 'hidden',
            fontFamily: 'Manrope, Inter, system-ui, sans-serif',
        }}>
            {children}
        </div>,
        document.body
    )
}

export function AirportInput({
    value, iataCode, onChange, placeholder = 'Cidade ou aeroporto', icon, inputStyle
}: AirportInputProps) {
    const [query, setQuery] = useState(value)
    const [results, setResults] = useState<Airport[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const debouncedQuery = useDebounce(query, 380)

    // Sync query if value changes externally (e.g. swap)
    useEffect(() => {
        setQuery(value)
    }, [value])

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                // Also check if click is inside portal dropdown
                const portals = document.querySelectorAll('[data-airport-dropdown]')
                for (const p of portals) {
                    if (p.contains(e.target as Node)) return
                }
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Fetch suggestions
    useEffect(() => {
        if (debouncedQuery.length < 2) { setResults([]); setOpen(false); return }
        if (/^[A-Z]{3}$/.test(debouncedQuery)) {
            // User typed a 3-letter code directly — use it
            onChange(debouncedQuery, debouncedQuery)
            setOpen(false)
            return
        }
        setLoading(true)
        searchAirports(debouncedQuery)
            .then(res => { setResults(res); setOpen(res.length > 0) })
            .catch(() => setResults([]))
            .finally(() => setLoading(false))
    }, [debouncedQuery])

    const handleSelect = useCallback((airport: Airport) => {
        const label = airport.cityName || airport.name
        setQuery(label)
        onChange(label, airport.iataCode)
        setOpen(false)
    }, [onChange])

    return (
        <div ref={containerRef} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            {icon}

            <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder={placeholder}
                onChange={e => { setQuery(e.target.value); onChange(e.target.value, '') }}
                onFocus={() => { if (results.length > 0) setOpen(true) }}
                style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    color: 'var(--text-dark)', fontFamily: 'inherit',
                    fontSize: '13.5px', fontWeight: 600, width: '100%',
                    minWidth: 0,
                    ...inputStyle,
                }}
                autoComplete="off"
                spellCheck={false}
            />

            {/* IATA badge */}
            {iataCode && (
                <span style={{
                    fontSize: '10.5px', fontWeight: 800, color: '#2A60C2',
                    background: '#EEF2F8', padding: '2px 6px',
                    borderRadius: '5px', flexShrink: 0, letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                }}>
                    {iataCode}
                </span>
            )}

            {loading && (
                <Loader2 size={13} color="var(--text-faint)"
                    style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
            )}

            {/* Portal dropdown — bypasses parent overflow clipping */}
            <DropdownPortal anchorRef={containerRef} open={open}>
                <div data-airport-dropdown="true">
                    {results.map((airport, i) => (
                        <button
                            key={airport.iataCode}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); handleSelect(airport) }}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 14px', background: 'none', border: 'none',
                                cursor: 'pointer', textAlign: 'left',
                                borderBottom: i < results.length - 1 ? '1px solid #F1F5F9' : 'none',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F7F9FC'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            <div style={{
                                width: '30px', height: '30px', borderRadius: '7px',
                                background: '#EEF2F8', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', flexShrink: 0,
                            }}>
                                <MapPin size={13} color="#2A60C2" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0E2A55', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {airport.cityName || airport.name}
                                    </span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#2A60C2', background: '#EEF2F8', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>
                                        {airport.iataCode}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {airport.name} · {airport.countryCode}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </DropdownPortal>
        </div>
    )
}
