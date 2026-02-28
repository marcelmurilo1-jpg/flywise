import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Loader2 } from 'lucide-react'
import { searchAirports, type Airport } from '@/lib/amadeus'

// ─── Static airports for instant (no-API) suggestions ────────────────────────
const LOCAL_AIRPORTS: Airport[] = [
    { iataCode: 'GRU', name: 'Guarulhos Intl.', cityName: 'São Paulo', countryCode: 'BR', label: '' },
    { iataCode: 'CGH', name: 'Congonhas', cityName: 'São Paulo', countryCode: 'BR', label: '' },
    { iataCode: 'VCP', name: 'Viracopos Intl.', cityName: 'Campinas', countryCode: 'BR', label: '' },
    { iataCode: 'GIG', name: 'Galeão Intl.', cityName: 'Rio de Janeiro', countryCode: 'BR', label: '' },
    { iataCode: 'SDU', name: 'Santos Dumont', cityName: 'Rio de Janeiro', countryCode: 'BR', label: '' },
    { iataCode: 'BSB', name: 'Brasília Intl.', cityName: 'Brasília', countryCode: 'BR', label: '' },
    { iataCode: 'SSA', name: 'Luís Eduardo Magalhães Intl.', cityName: 'Salvador', countryCode: 'BR', label: '' },
    { iataCode: 'FOR', name: 'Pinto Martins Intl.', cityName: 'Fortaleza', countryCode: 'BR', label: '' },
    { iataCode: 'REC', name: 'Guararapes Intl.', cityName: 'Recife', countryCode: 'BR', label: '' },
    { iataCode: 'POA', name: 'Salgado Filho Intl.', cityName: 'Porto Alegre', countryCode: 'BR', label: '' },
    { iataCode: 'CWB', name: 'Afonso Pena Intl.', cityName: 'Curitiba', countryCode: 'BR', label: '' },
    { iataCode: 'BEL', name: 'Val de Cans Intl.', cityName: 'Belém', countryCode: 'BR', label: '' },
    { iataCode: 'MAO', name: 'Eduardo Gomes Intl.', cityName: 'Manaus', countryCode: 'BR', label: '' },
    { iataCode: 'CNF', name: 'Tancredo Neves Intl.', cityName: 'Belo Horizonte', countryCode: 'BR', label: '' },
    { iataCode: 'FLN', name: 'Hercílio Luz Intl.', cityName: 'Florianópolis', countryCode: 'BR', label: '' },
    { iataCode: 'GYN', name: 'Santa Genoveva', cityName: 'Goiânia', countryCode: 'BR', label: '' },
    { iataCode: 'NAT', name: 'Gov. Aluízio Alves Intl.', cityName: 'Natal', countryCode: 'BR', label: '' },
    { iataCode: 'MCZ', name: 'Zumbi dos Palmares Intl.', cityName: 'Maceió', countryCode: 'BR', label: '' },
    { iataCode: 'JFK', name: 'John F. Kennedy Intl.', cityName: 'Nova York', countryCode: 'US', label: '' },
    { iataCode: 'EWR', name: 'Newark Liberty Intl.', cityName: 'Nova York', countryCode: 'US', label: '' },
    { iataCode: 'MIA', name: 'Miami Intl.', cityName: 'Miami', countryCode: 'US', label: '' },
    { iataCode: 'LAX', name: 'Los Angeles Intl.', cityName: 'Los Angeles', countryCode: 'US', label: '' },
    { iataCode: 'ORD', name: "O'Hare Intl.", cityName: 'Chicago', countryCode: 'US', label: '' },
    { iataCode: 'LIS', name: 'Humberto Delgado', cityName: 'Lisboa', countryCode: 'PT', label: '' },
    { iataCode: 'CDG', name: 'Charles de Gaulle', cityName: 'Paris', countryCode: 'FR', label: '' },
    { iataCode: 'LHR', name: 'London Heathrow', cityName: 'Londres', countryCode: 'GB', label: '' },
    { iataCode: 'MAD', name: 'Madrid-Barajas', cityName: 'Madrid', countryCode: 'ES', label: '' },
    { iataCode: 'FRA', name: 'Frankfurt Airport', cityName: 'Frankfurt', countryCode: 'DE', label: '' },
    { iataCode: 'AMS', name: 'Amsterdam Schiphol', cityName: 'Amsterdam', countryCode: 'NL', label: '' },
    { iataCode: 'FCO', name: 'Leonardo da Vinci', cityName: 'Roma', countryCode: 'IT', label: '' },
    { iataCode: 'BCN', name: 'Barcelona-El Prat', cityName: 'Barcelona', countryCode: 'ES', label: '' },
    { iataCode: 'EZE', name: 'Ministro Pistarini', cityName: 'Buenos Aires', countryCode: 'AR', label: '' },
    { iataCode: 'SCL', name: 'Arturo Merino Benítez', cityName: 'Santiago', countryCode: 'CL', label: '' },
    { iataCode: 'MEX', name: 'Benito Juárez Intl.', cityName: 'Cidade do México', countryCode: 'MX', label: '' },
    { iataCode: 'BOG', name: 'El Dorado Intl.', cityName: 'Bogotá', countryCode: 'CO', label: '' },
    { iataCode: 'LIM', name: 'Jorge Chávez Intl.', cityName: 'Lima', countryCode: 'PE', label: '' },
    { iataCode: 'DXB', name: 'Dubai Intl.', cityName: 'Dubai', countryCode: 'AE', label: '' },
    { iataCode: 'DOH', name: 'Hamad Intl.', cityName: 'Doha', countryCode: 'QA', label: '' },
    { iataCode: 'IST', name: 'Istanbul Airport', cityName: 'Istambul', countryCode: 'TR', label: '' },
    { iataCode: 'NRT', name: 'Narita Intl.', cityName: 'Tóquio', countryCode: 'JP', label: '' },
    { iataCode: 'SIN', name: 'Singapore Changi', cityName: 'Cingapura', countryCode: 'SG', label: '' },
]

function filterLocal(q: string): Airport[] {
    const lq = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (lq.length < 2) return []
    return LOCAL_AIRPORTS.filter(a => {
        const city = a.cityName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const name = a.name.toLowerCase()
        const code = a.iataCode.toLowerCase()
        return city.includes(lq) || code.startsWith(lq) || name.includes(lq)
    }).slice(0, 6)
}

function useDebounce<T>(value: T, ms: number): T {
    const [deb, setDeb] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDeb(value), ms)
        return () => clearTimeout(t)
    }, [value, ms])
    return deb
}

interface Props {
    value: string
    iataCode: string
    onChange: (display: string, iata: string) => void
    placeholder?: string
    icon?: React.ReactNode
}

export function AirportInput({ value, iataCode, onChange, placeholder = 'Cidade ou aeroporto', icon }: Props) {
    const [query, setQuery] = useState(value)
    const [open, setOpen] = useState(false)
    const [list, setList] = useState<Airport[]>([])
    const [apiLoading, setApiLoading] = useState(false)
    const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const justSelected = useRef(false)
    const internalQuery = useRef(value)     // tracks value changed by user typing
    const hasFocused = useRef(false)        // MUST be true for dropdown to ever open
    const debQ = useDebounce(query, 300)

    // Sync from parent ONLY when value changes externally (not from the user's own typing)
    useEffect(() => {
        if (value === internalQuery.current) return
        // External injection (swap buttons, Resultados setting origin, etc.)
        // → sync text but NEVER allow dropdown to open; also reset user-focus state
        justSelected.current = true
        hasFocused.current = false   // user didn't focus this newly-set value
        internalQuery.current = value
        setQuery(value)
        setOpen(false)
        setList([])
    }, [value])

    // Update dropdown position whenever it opens
    useEffect(() => {
        if (!open) { setDropRect(null); return }
        const el = wrapRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setDropRect({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width })
    }, [open])

    // Recalculate on scroll/resize
    useEffect(() => {
        if (!open) return
        const update = () => {
            const el = wrapRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            setDropRect({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width })
        }
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => {
            window.removeEventListener('scroll', update, true)
            window.removeEventListener('resize', update)
        }
    }, [open])

    // Outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            if (wrapRef.current?.contains(t)) return
            if (t.closest?.('[data-ap-drop]')) return
            setOpen(false)
            hasFocused.current = false
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Search effect — dropdown ONLY opens when hasFocused is true
    useEffect(() => {
        if (justSelected.current) { justSelected.current = false; return }
        if (debQ.length < 2) { setList([]); setOpen(false); return }
        if (!hasFocused.current) return  // ← THE KEY GATE: do nothing without user focus

        const local = filterLocal(debQ)
        setList(local)
        setOpen(local.length > 0)

        let cancelled = false
        setApiLoading(true)
        searchAirports(debQ)
            .then(api => {
                if (cancelled || justSelected.current || !hasFocused.current) return
                const seen = new Set(api.map(a => a.iataCode))
                const extras = local.filter(l => !seen.has(l.iataCode))
                const merged = [...api, ...extras].slice(0, 7)
                const final = merged.length > 0 ? merged : local
                setList(final)
                setOpen(final.length > 0 && hasFocused.current)
            })
            .catch(() => { /* keep local */ })
            .finally(() => { if (!cancelled) setApiLoading(false) })
        return () => { cancelled = true }
    }, [debQ])

    const select = useCallback((airport: Airport) => {
        justSelected.current = true
        hasFocused.current = false
        const label = airport.cityName || airport.name
        setQuery(label)
        setOpen(false)
        setList([])
        onChange(label, airport.iataCode)
    }, [onChange])

    // Dropdown rendered as a fixed-position div directly via a global overlay
    const dropdown = open && list.length > 0 && dropRect ? (
        <div
            data-ap-drop="true"
            style={{
                position: 'fixed',
                top: dropRect.top - window.scrollY + 4,
                left: dropRect.left - window.scrollX,
                width: Math.max(dropRect.width, 280),
                background: '#fff',
                border: '1px solid #D4E2F4',
                borderRadius: '14px',
                boxShadow: '0 20px 60px rgba(14,42,85,0.2)',
                zIndex: 999999,
                overflow: 'hidden',
                fontFamily: 'Manrope, Inter, sans-serif',
                pointerEvents: 'all',
            }}
        >
            {list.map((airport, i) => (
                <button
                    key={`${airport.iataCode}-${i}`}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); select(airport) }}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                        borderBottom: i < list.length - 1 ? '1px solid #F1F5F9' : 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <div style={{
                        width: 28, height: 28, borderRadius: 7, background: '#EEF2F8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <MapPin size={13} color="#2A60C2" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                                fontSize: 13, fontWeight: 700, color: '#0E2A55',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {airport.cityName || airport.name}
                            </span>
                            <span style={{
                                fontSize: 10, fontWeight: 800, color: '#2A60C2',
                                background: '#EEF2F8', padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                            }}>
                                {airport.iataCode}
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {airport.name}{airport.countryCode ? ` · ${airport.countryCode}` : ''}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    ) : null

    return (
        <>
            <div
                ref={wrapRef}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}
            >
                {icon}
                <input
                    type="text"
                    value={query}
                    placeholder={placeholder}
                    onChange={e => {
                        justSelected.current = false
                        const v = e.target.value
                        internalQuery.current = v  // track as internal change
                        setQuery(v)
                        onChange(v, '')
                    }}
                    onFocus={() => {
                        hasFocused.current = true   // user explicitly focused: now allow dropdown
                        if (list.length > 0 && !justSelected.current) setOpen(true)
                    }}
                    style={{
                        border: 'none', background: 'transparent', outline: 'none',
                        color: 'var(--text-dark)', fontFamily: 'inherit',
                        fontSize: '13.5px', fontWeight: 600, width: '100%', minWidth: 0,
                    }}
                    autoComplete="off"
                    spellCheck={false}
                />
                {iataCode && (
                    <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
                        color: '#2A60C2', background: '#EEF2F8',
                        padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                    }}>
                        {iataCode}
                    </span>
                )}
                {apiLoading && (
                    <Loader2 size={12} color="#94A3B8" style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }} />
                )}
            </div>

            {/* Dropdown via portal to body — bypasses any parent overflow:hidden */}
            {dropdown && createPortal(dropdown, document.body)}
        </>
    )
}
