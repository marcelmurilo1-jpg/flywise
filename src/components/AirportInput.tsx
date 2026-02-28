import { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { MapPin, Loader2 } from 'lucide-react'
import { searchAirports, type Airport } from '@/lib/amadeus'

// ─── Local airports (instant, no API needed) ──────────────────────────────────
const LOCAL_AIRPORTS: Airport[] = [
    // Brazil
    { iataCode: 'GRU', name: 'Aeroporto de Guarulhos', cityName: 'São Paulo', countryCode: 'BR', label: '' },
    { iataCode: 'CGH', name: 'Aeroporto de Congonhas', cityName: 'São Paulo', countryCode: 'BR', label: '' },
    { iataCode: 'VCP', name: 'Aeroporto de Viracopos', cityName: 'Campinas', countryCode: 'BR', label: '' },
    { iataCode: 'GIG', name: 'Aeroporto do Galeão', cityName: 'Rio de Janeiro', countryCode: 'BR', label: '' },
    { iataCode: 'SDU', name: 'Aeroporto Santos Dumont', cityName: 'Rio de Janeiro', countryCode: 'BR', label: '' },
    { iataCode: 'BSB', name: 'Aeroporto de Brasília', cityName: 'Brasília', countryCode: 'BR', label: '' },
    { iataCode: 'SSA', name: 'Aeroporto Luís Eduardo Magalhães', cityName: 'Salvador', countryCode: 'BR', label: '' },
    { iataCode: 'FOR', name: 'Aeroporto Pinto Martins', cityName: 'Fortaleza', countryCode: 'BR', label: '' },
    { iataCode: 'REC', name: 'Aeroporto Guararapes', cityName: 'Recife', countryCode: 'BR', label: '' },
    { iataCode: 'POA', name: 'Aeroporto Salgado Filho', cityName: 'Porto Alegre', countryCode: 'BR', label: '' },
    { iataCode: 'CWB', name: 'Aeroporto Afonso Pena', cityName: 'Curitiba', countryCode: 'BR', label: '' },
    { iataCode: 'BEL', name: 'Aeroporto Val de Cans', cityName: 'Belém', countryCode: 'BR', label: '' },
    { iataCode: 'MAO', name: 'Aeroporto Eduardo Gomes', cityName: 'Manaus', countryCode: 'BR', label: '' },
    { iataCode: 'CNF', name: 'Aeroporto Tancredo Neves', cityName: 'Belo Horizonte', countryCode: 'BR', label: '' },
    { iataCode: 'FLN', name: 'Aeroporto Hercílio Luz', cityName: 'Florianópolis', countryCode: 'BR', label: '' },
    { iataCode: 'GYN', name: 'Aeroporto Santa Genoveva', cityName: 'Goiânia', countryCode: 'BR', label: '' },
    { iataCode: 'NAT', name: 'Aeroporto Governador Aluízio Alves', cityName: 'Natal', countryCode: 'BR', label: '' },
    { iataCode: 'MCZ', name: 'Aeroporto Zumbi dos Palmares', cityName: 'Maceió', countryCode: 'BR', label: '' },
    { iataCode: 'THE', name: 'Aeroporto Senador Petrônio Portella', cityName: 'Teresina', countryCode: 'BR', label: '' },
    { iataCode: 'AJU', name: 'Aeroporto Santa Maria', cityName: 'Aracaju', countryCode: 'BR', label: '' },
    // International
    { iataCode: 'JFK', name: 'John F. Kennedy International', cityName: 'Nova York', countryCode: 'US', label: '' },
    { iataCode: 'EWR', name: 'Newark Liberty International', cityName: 'Nova York', countryCode: 'US', label: '' },
    { iataCode: 'MIA', name: 'Miami International', cityName: 'Miami', countryCode: 'US', label: '' },
    { iataCode: 'LAX', name: 'Los Angeles International', cityName: 'Los Angeles', countryCode: 'US', label: '' },
    { iataCode: 'ORD', name: "O'Hare International", cityName: 'Chicago', countryCode: 'US', label: '' },
    { iataCode: 'LIS', name: 'Humberto Delgado', cityName: 'Lisboa', countryCode: 'PT', label: '' },
    { iataCode: 'CDG', name: 'Charles de Gaulle', cityName: 'Paris', countryCode: 'FR', label: '' },
    { iataCode: 'LHR', name: 'London Heathrow', cityName: 'Londres', countryCode: 'GB', label: '' },
    { iataCode: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', cityName: 'Madrid', countryCode: 'ES', label: '' },
    { iataCode: 'FRA', name: 'Frankfurt Airport', cityName: 'Frankfurt', countryCode: 'DE', label: '' },
    { iataCode: 'AMS', name: 'Amsterdam Schiphol', cityName: 'Amsterdam', countryCode: 'NL', label: '' },
    { iataCode: 'FCO', name: 'Leonardo da Vinci', cityName: 'Roma', countryCode: 'IT', label: '' },
    { iataCode: 'BCN', name: 'Barcelona-El Prat', cityName: 'Barcelona', countryCode: 'ES', label: '' },
    { iataCode: 'EZE', name: 'Ministro Pistarini', cityName: 'Buenos Aires', countryCode: 'AR', label: '' },
    { iataCode: 'SCL', name: 'Arturo Merino Benítez', cityName: 'Santiago', countryCode: 'CL', label: '' },
    { iataCode: 'MEX', name: 'Benito Juárez International', cityName: 'Cidade do México', countryCode: 'MX', label: '' },
    { iataCode: 'BOG', name: 'El Dorado International', cityName: 'Bogotá', countryCode: 'CO', label: '' },
    { iataCode: 'LIM', name: 'Jorge Chávez International', cityName: 'Lima', countryCode: 'PE', label: '' },
    { iataCode: 'DXB', name: 'Dubai International', cityName: 'Dubai', countryCode: 'AE', label: '' },
    { iataCode: 'DOH', name: 'Hamad International', cityName: 'Doha', countryCode: 'QA', label: '' },
    { iataCode: 'IST', name: 'Istanbul Airport', cityName: 'Istambul', countryCode: 'TR', label: '' },
    { iataCode: 'NRT', name: 'Narita International', cityName: 'Tóquio', countryCode: 'JP', label: '' },
    { iataCode: 'SIN', name: 'Singapore Changi', cityName: 'Cingapura', countryCode: 'SG', label: '' },
    { iataCode: 'ADD', name: 'Bole International', cityName: 'Adis Abeba', countryCode: 'ET', label: '' },
    { iataCode: 'TP', name: 'Humberto Delgado Airport', cityName: 'Lisboa', countryCode: 'PT', label: '' },
]

function filterLocal(query: string): Airport[] {
    const q = query.toLowerCase().trim()
    if (q.length < 2) return []
    return LOCAL_AIRPORTS.filter(a =>
        a.cityName.toLowerCase().includes(q) ||
        a.iataCode.toLowerCase().startsWith(q) ||
        a.name.toLowerCase().includes(q)
    ).slice(0, 6)
}

function useDebounce<T>(value: T, ms: number): T {
    const [deb, setDeb] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDeb(value), ms)
        return () => clearTimeout(t)
    }, [value, ms])
    return deb
}

// ─── Portal dropdown renders at <body> — bypasses all parent overflow:hidden ──
function Portal({ anchorRef, open, children }: {
    anchorRef: React.RefObject<HTMLElement | null>
    open: boolean
    children: React.ReactNode
}) {
    const [rect, setRect] = useState<DOMRect | null>(null)

    useEffect(() => {
        if (!open) { setRect(null); return }
        const el = anchorRef.current
        if (!el) return
        const update = () => setRect(el.getBoundingClientRect())
        update()
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => {
            window.removeEventListener('scroll', update, true)
            window.removeEventListener('resize', update)
        }
    }, [open, anchorRef])

    if (!open || !rect) return null

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 280),
            background: '#fff',
            border: '1px solid #E2EAF5',
            borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(14,42,85,0.18)',
            zIndex: 99999,
            overflow: 'hidden',
            fontFamily: 'Manrope, Inter, system-ui, sans-serif',
        }}>
            {children}
        </div>,
        document.body
    )
}

interface AirportInputProps {
    value: string
    iataCode: string
    onChange: (display: string, iata: string) => void
    placeholder?: string
    icon?: React.ReactNode
}

export function AirportInput({ value, iataCode, onChange, placeholder = 'Cidade ou aeroporto', icon }: AirportInputProps) {
    const [query, setQuery] = useState(value)
    const [suggestions, setSuggestions] = useState<Airport[]>([])
    const [apiLoading, setApiLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const debQ = useDebounce(query, 350)

    // Sync external value changes (e.g. swap)
    useEffect(() => { setQuery(value) }, [value])

    // Outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                // Check portal dropdowns
                if ((e.target as HTMLElement)?.closest?.('[data-airport-portal]')) return
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Search: show local results instantly, then merge with API
    useEffect(() => {
        if (debQ.length < 2) { setSuggestions([]); setOpen(false); return }

        // Direct IATA code
        if (/^[A-Za-z]{3}$/.test(debQ.trim())) {
            const iata = debQ.trim().toUpperCase()
            const local = filterLocal(iata)
            if (local.length > 0) {
                setSuggestions(local)
                setOpen(true)
                return
            }
            // Could be a valid code — just let user select it
            setSuggestions([{ iataCode: iata, name: `Aeroporto ${iata}`, cityName: iata, countryCode: '', label: '' }])
            setOpen(true)
            return
        }

        // Show local results immediately
        const local = filterLocal(debQ)
        setSuggestions(local)
        setOpen(local.length > 0)

        // Then fetch from API and merge
        setApiLoading(true)
        searchAirports(debQ).then(api => {
            const apiCodes = new Set(api.map(a => a.iataCode))
            const merged = [...api, ...local.filter(l => !apiCodes.has(l.iataCode))].slice(0, 7)
            setSuggestions(merged.length > 0 ? merged : local)
            setOpen(merged.length > 0 || local.length > 0)
        }).catch(() => {
            // API failed — keep local results
            setSuggestions(local)
            setOpen(local.length > 0)
        }).finally(() => setApiLoading(false))
    }, [debQ])

    const handleSelect = useCallback((airport: Airport) => {
        const label = airport.cityName || airport.name
        setQuery(label)
        onChange(label, airport.iataCode)
        setOpen(false)
        setSuggestions([])
    }, [onChange])

    return (
        <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, position: 'relative' }}>
            {icon}

            <input
                type="text"
                value={query}
                placeholder={placeholder}
                onChange={e => { const v = e.target.value; setQuery(v); onChange(v, '') }}
                onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
                style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    color: 'var(--text-dark)', fontFamily: 'inherit',
                    fontSize: '13.5px', fontWeight: 600, width: '100%', minWidth: 0,
                }}
                autoComplete="off"
                spellCheck={false}
            />

            {iataCode && (
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#2A60C2', background: '#EEF2F8', padding: '2px 6px', borderRadius: '5px', flexShrink: 0, letterSpacing: '0.05em' }}>
                    {iataCode}
                </span>
            )}

            {apiLoading && <Loader2 size={12} color="#94A3B8" style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />}

            <Portal anchorRef={containerRef} open={open}>
                <div data-airport-portal="true">
                    {suggestions.map((airport, i) => (
                        <button
                            key={airport.iataCode + i}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); handleSelect(airport) }}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 14px', background: 'none', border: 'none',
                                cursor: 'pointer', textAlign: 'left',
                                borderBottom: i < suggestions.length - 1 ? '1px solid #F1F5F9' : 'none',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F7F9FC'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <MapPin size={13} color="#2A60C2" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0E2A55', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{airport.cityName || airport.name}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#2A60C2', background: '#EEF2F8', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>{airport.iataCode}</span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {airport.name}{airport.countryCode ? ` · ${airport.countryCode}` : ''}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </Portal>
        </div>
    )
}
