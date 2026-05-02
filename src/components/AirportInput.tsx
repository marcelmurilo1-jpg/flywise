import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin } from 'lucide-react'
import { type Airport } from '@/lib/amadeus'
import { searchAirportsLocal } from '@/lib/airports'

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
    const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const justSelected = useRef(false)
    const internalQuery = useRef(value)     // tracks value changed by user typing
    const hasFocused = useRef(false)        // MUST be true for dropdown to ever open
    const debQ = useDebounce(query, 150)

    // Sync from parent ONLY when value changes externally (not from the user's own typing)
    useEffect(() => {
        if (value === internalQuery.current) return
        justSelected.current = true
        hasFocused.current = false
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

    // Synchronous search — no API call, no loading state
    useEffect(() => {
        if (justSelected.current) {
            justSelected.current = false
            return
        }
        if (debQ.length < 2) {
            setList([])
            setOpen(false)
            return
        }
        if (!hasFocused.current) return

        const results = searchAirportsLocal(debQ)
        setList(results)
        setOpen(results.length > 0)
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
                        internalQuery.current = v
                        setQuery(v)
                        onChange(v, '')
                    }}
                    onFocus={() => {
                        hasFocused.current = true
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
            </div>

            {/* Dropdown via portal to body — bypasses any parent overflow:hidden */}
            {dropdown && createPortal(dropdown, document.body)}
        </>
    )
}
