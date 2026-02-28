import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { searchAirports, type Airport } from '@/lib/amadeus'

interface AirportInputProps {
    value: string           // display value (city name or code)
    iataCode: string        // selected IATA code
    onChange: (display: string, iata: string) => void
    placeholder?: string
    icon?: React.ReactNode
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

export function AirportInput({ value, iataCode, onChange, placeholder = 'Cidade ou aeroporto', icon }: AirportInputProps) {
    const [query, setQuery] = useState(value)
    const [results, setResults] = useState<Airport[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [focused, setFocused] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const debouncedQuery = useDebounce(query, 350)

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Search airports when query changes
    useEffect(() => {
        if (!focused) return
        if (debouncedQuery.length < 2) { setResults([]); setOpen(false); return }

        // If user typed a valid 3-letter IATA code directly, use it
        if (/^[A-Z]{3}$/.test(debouncedQuery)) {
            onChange(debouncedQuery, debouncedQuery)
            setOpen(false)
            return
        }

        setLoading(true)
        searchAirports(debouncedQuery)
            .then(res => {
                setResults(res)
                setOpen(res.length > 0)
            })
            .catch(() => setResults([]))
            .finally(() => setLoading(false))
    }, [debouncedQuery, focused])

    const handleSelect = useCallback((airport: Airport) => {
        setQuery(airport.cityName || airport.name)
        onChange(airport.cityName || airport.name, airport.iataCode)
        setOpen(false)
        setResults([])
    }, [onChange])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value
        setQuery(v)
        // Clear IATA code while user is typing
        onChange(v, '')
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
            {icon}

            <input
                type="text"
                value={query}
                placeholder={placeholder}
                onChange={handleChange}
                onFocus={() => { setFocused(true); if (results.length > 0) setOpen(true) }}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
                style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    color: 'var(--text-dark)', fontFamily: 'inherit',
                    fontSize: '13.5px', fontWeight: 600, width: '100%',
                    letterSpacing: '0.01em',
                }}
                autoComplete="off"
                spellCheck={false}
            />

            {/* IATA badge */}
            {iataCode && (
                <span style={{
                    fontSize: '11px', fontWeight: 800, color: '#2A60C2',
                    background: '#EEF2F8', padding: '2px 6px',
                    borderRadius: '5px', flexShrink: 0, letterSpacing: '0.05em',
                }}>
                    {iataCode}
                </span>
            )}

            {loading && <Loader2 size={13} color="var(--text-faint)" style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />}

            {/* Dropdown */}
            {open && results.length > 0 && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: '-14px',
                    width: '320px', background: '#fff',
                    border: '1px solid #E2EAF5',
                    borderRadius: '14px',
                    boxShadow: '0 12px 40px rgba(14,42,85,0.14)',
                    zIndex: 999, overflow: 'hidden',
                }}>
                    {results.map((airport, i) => (
                        <button
                            key={airport.iataCode}
                            type="button"
                            onMouseDown={() => handleSelect(airport)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '11px 16px', background: 'none', border: 'none',
                                cursor: 'pointer', textAlign: 'left',
                                borderBottom: i < results.length - 1 ? '1px solid #F1F5F9' : 'none',
                                transition: 'background 0.12s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F7F9FC'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                background: '#EEF2F8', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', flexShrink: 0,
                            }}>
                                <MapPin size={14} color="#2A60C2" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0E2A55', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {airport.cityName || airport.name}
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#2A60C2', background: '#EEF2F8', padding: '1px 5px', borderRadius: '4px' }}>
                                        {airport.iataCode}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {airport.name} · {airport.countryCode}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
