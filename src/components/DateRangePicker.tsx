import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isAfter, isBefore, isToday, startOfDay, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createPortal } from 'react-dom'

interface DateRangePickerProps {
    dateGo: string         // YYYY-MM-DD
    dateBack: string       // YYYY-MM-DD
    tripType: 'one-way' | 'round-trip'
    onDateGoChange: (val: string) => void
    onDateBackChange: (val: string) => void
}

function parseLocal(s: string): Date | null {
    if (!s) return null
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function toYMD(d: Date): string {
    return format(d, 'yyyy-MM-dd')
}

function formatDisplay(s: string): string {
    if (!s) return ''
    const d = parseLocal(s)
    if (!d) return ''
    return format(d, "d 'de' MMM yyyy", { locale: ptBR })
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface CalendarProps {
    viewDate: Date
    selectedStart: Date | null
    selectedEnd: Date | null
    hoverDate: Date | null
    onDayClick: (d: Date) => void
    onDayHover: (d: Date | null) => void
    onPrev: () => void
    onNext: () => void
    showNav: 'both' | 'prev' | 'next' | 'none'
}

function Calendar({ viewDate, selectedStart, selectedEnd, hoverDate, onDayClick, onDayHover, onPrev, onNext, showNav }: CalendarProps) {
    const today = startOfDay(new Date())
    const monthStart = startOfMonth(viewDate)
    const monthEnd = endOfMonth(viewDate)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const startPad = getDay(monthStart)

    const isInRange = (d: Date) => {
        if (!selectedStart) return false
        const end = selectedEnd || hoverDate
        if (!end) return false
        return (isAfter(d, selectedStart) || isSameDay(d, selectedStart)) &&
            (isBefore(d, end) || isSameDay(d, end))
    }

    const isRangeStart = (d: Date) => selectedStart ? isSameDay(d, selectedStart) : false
    const isRangeEnd = (d: Date) => selectedEnd ? isSameDay(d, selectedEnd) : (hoverDate && selectedStart ? isSameDay(d, hoverDate) : false)

    return (
        <div style={{ flex: 1, minWidth: 260 }}>
            {/* Month header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button
                    type="button"
                    onClick={onPrev}
                    style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none',
                        background: showNav === 'next' ? 'transparent' : '#F1F5F9',
                        cursor: showNav === 'next' ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: showNav === 'next' ? 0 : 1,
                    }}
                    disabled={showNav === 'next'}
                >
                    <ChevronLeft size={15} color="#64748B" />
                </button>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0E2A55', textTransform: 'capitalize' }}>
                    {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button
                    type="button"
                    onClick={onNext}
                    style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none',
                        background: showNav === 'prev' ? 'transparent' : '#F1F5F9',
                        cursor: showNav === 'prev' ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: showNav === 'prev' ? 0 : 1,
                    }}
                    disabled={showNav === 'prev'}
                >
                    <ChevronRight size={15} color="#64748B" />
                </button>
            </div>

            {/* Week days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
                {DAYS_PT.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8', paddingBottom: 4 }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                {days.map(day => {
                    const isPast = isBefore(day, today)
                    const isStart = isRangeStart(day)
                    const isEnd = isRangeEnd(day)
                    const inRange = isInRange(day)
                    const isT = isToday(day)
                    const inCurMonth = isSameMonth(day, viewDate)

                    let bg = 'transparent'
                    let color = inCurMonth ? '#1E293B' : '#CBD5E1'
                    let borderRadius = '10px'
                    let fontWeight = 500

                    if (isStart || isEnd) {
                        bg = '#2A60C2'
                        color = '#fff'
                        fontWeight = 700
                        borderRadius = isStart && isEnd ? '10px' : isStart ? '10px 0 0 10px' : '0 10px 10px 0'
                    } else if (inRange) {
                        bg = '#EEF4FF'
                        color = '#2A60C2'
                        borderRadius = '0'
                        fontWeight = 600
                    }

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            disabled={isPast || !inCurMonth}
                            onClick={() => !isPast && inCurMonth && onDayClick(day)}
                            onMouseEnter={() => !isPast && inCurMonth && onDayHover(day)}
                            onMouseLeave={() => onDayHover(null)}
                            style={{
                                padding: 0, border: 'none', background: 'none', cursor: isPast || !inCurMonth ? 'default' : 'pointer',
                                position: 'relative',
                            }}
                        >
                            <div style={{
                                margin: '1px 0',
                                background: inRange && !isStart && !isEnd ? '#EEF4FF' : 'transparent',
                                borderRadius: (() => {
                                    // Handle range edges
                                    const dayOfWeek = getDay(day)
                                    if (isStart || (!isStart && !isEnd && dayOfWeek === 0)) return '10px 0 0 10px'
                                    if (isEnd || (!isStart && !isEnd && dayOfWeek === 6)) return '0 10px 10px 0'
                                    return '0'
                                })(),
                            }}>
                                <div style={{
                                    height: 34, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius, background: bg, color,
                                    fontSize: 13, fontWeight,
                                    ...(isT && !isStart && !isEnd ? { outline: '1.5px solid #2A60C2', outlineOffset: '-1px' } : {}),
                                    opacity: isPast || !inCurMonth ? 0.35 : 1,
                                    transition: 'background 0.12s',
                                }}>
                                    {format(day, 'd')}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export function DateRangePicker({ dateGo, dateBack, tripType, onDateGoChange, onDateBackChange }: DateRangePickerProps) {
    const [open, setOpen] = useState(false)
    const [selecting, setSelecting] = useState<'start' | 'end'>('start')
    const [tempStart, setTempStart] = useState<Date | null>(parseLocal(dateGo))
    const [tempEnd, setTempEnd] = useState<Date | null>(parseLocal(dateBack))
    const [hoverDate, setHoverDate] = useState<Date | null>(null)
    const [viewLeft, setViewLeft] = useState(startOfMonth(parseLocal(dateGo) || new Date()))
    const [dropRect, setDropRect] = useState<{ top: number; left: number } | null>(null)

    const triggerRef = useRef<HTMLDivElement>(null)

    // Keep local temp state in sync when external props change
    useEffect(() => { setTempStart(parseLocal(dateGo)) }, [dateGo])
    useEffect(() => { setTempEnd(parseLocal(dateBack)) }, [dateBack])

    const viewRight = addMonths(viewLeft, 1)

    function openPicker() {
        setOpen(true)
        setSelecting(tempStart ? 'end' : 'start')
        const el = triggerRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setDropRect({ top: r.bottom + window.scrollY + 8, left: r.left + window.scrollX })
    }

    function handleDayClick(d: Date) {
        if (selecting === 'start' || tripType === 'one-way') {
            setTempStart(d)
            setTempEnd(null)
            onDateGoChange(toYMD(d))
            onDateBackChange('')
            if (tripType !== 'one-way') {
                setSelecting('end')
            } else {
                setOpen(false)
            }
        } else {
            // selecting end
            if (tempStart && (isBefore(d, tempStart) || isSameDay(d, tempStart))) {
                // Clicked before start → reset start
                setTempStart(d)
                setTempEnd(null)
                onDateGoChange(toYMD(d))
                onDateBackChange('')
                setSelecting('end')
            } else {
                setTempEnd(d)
                onDateBackChange(toYMD(d))
                setOpen(false)
            }
        }
    }

    // Outside click
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            if (triggerRef.current?.contains(t)) return
            if (t.closest('[data-drp-panel]')) return
            setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const displayGo = formatDisplay(dateGo)
    const displayBack = formatDisplay(dateBack)

    const panel = open && dropRect ? (
        <div
            data-drp-panel="true"
            style={{
                position: 'fixed',
                top: dropRect.top - window.scrollY,
                left: dropRect.left - window.scrollX,
                zIndex: 999998,
                background: '#fff',
                border: '1px solid #D4E2F4',
                borderRadius: 20,
                boxShadow: '0 24px 80px rgba(14,42,85,0.18)',
                padding: '20px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                minWidth: 600,
                fontFamily: 'Manrope, Inter, sans-serif',
            }}
        >
            {/* Top bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{
                        padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
                        background: selecting === 'start' ? '#EEF4FF' : 'transparent',
                        border: selecting === 'start' ? '1.5px solid #2A60C2' : '1.5px solid transparent',
                        transition: 'all 0.1s',
                    }} onClick={() => setSelecting('start')}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Ida</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0E2A55' }}>
                            {displayGo || <span style={{ color: '#CBD5E1' }}>Selecione</span>}
                        </div>
                    </div>
                    {tripType !== 'one-way' && (
                        <>
                            <div style={{ width: 1, background: '#E2EAF5', alignSelf: 'stretch' }} />
                            <div style={{
                                padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
                                background: selecting === 'end' ? '#EEF4FF' : 'transparent',
                                border: selecting === 'end' ? '1.5px solid #2A60C2' : '1.5px solid transparent',
                                transition: 'all 0.1s',
                            }} onClick={() => setSelecting('end')}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Volta</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#0E2A55' }}>
                                    {displayBack || <span style={{ color: '#CBD5E1' }}>Selecione</span>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <X size={14} color="#64748B" />
                </button>
            </div>

            {/* Calendars */}
            <div style={{ display: 'flex', gap: 24 }}>
                <Calendar
                    viewDate={viewLeft}
                    selectedStart={tempStart}
                    selectedEnd={tripType !== 'one-way' ? tempEnd : null}
                    hoverDate={tripType !== 'one-way' ? hoverDate : null}
                    onDayClick={handleDayClick}
                    onDayHover={setHoverDate}
                    onPrev={() => setViewLeft(v => subMonths(v, 1))}
                    onNext={() => setViewLeft(v => addMonths(v, 1))}
                    showNav="prev"
                />
                <div style={{ width: 1, background: '#E2EAF5' }} />
                <Calendar
                    viewDate={viewRight}
                    selectedStart={tempStart}
                    selectedEnd={tripType !== 'one-way' ? tempEnd : null}
                    hoverDate={tripType !== 'one-way' ? hoverDate : null}
                    onDayClick={handleDayClick}
                    onDayHover={setHoverDate}
                    onPrev={() => setViewLeft(v => subMonths(v, 1))}
                    onNext={() => setViewLeft(v => addMonths(v, 1))}
                    showNav="next"
                />
            </div>

            {/* Footer hint */}
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                {selecting === 'start' ? 'Clique para selecionar a data de ida' : 'Clique para selecionar a data de volta'}
            </div>
        </div>
    ) : null

    return (
        <>
            <div ref={triggerRef} onClick={openPicker} style={{ display: 'flex', gap: 0, cursor: 'pointer' }}>
                {/* Ida field */}
                <div style={{
                    border: `1.5px solid ${open && selecting === 'start' ? '#2A60C2' : 'var(--border-light)'}`,
                    borderRadius: '12px 0 0 12px',
                    padding: '10px 14px', background: '#fff',
                    borderRight: 'none',
                    transition: 'border-color 0.15s',
                    minWidth: 120,
                }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', pointerEvents: 'none' }}>Ida</label>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: displayGo ? 'var(--text-dark)' : '#CBD5E1' }}>
                        {displayGo || 'dd/mm/aaaa'}
                    </span>
                </div>

                {/* Volta field (if round-trip) */}
                {tripType !== 'one-way' && (
                    <div style={{
                        border: `1.5px solid ${open && selecting === 'end' ? '#2A60C2' : 'var(--border-light)'}`,
                        borderRadius: '0 12px 12px 0',
                        padding: '10px 14px', background: '#fff',
                        transition: 'border-color 0.15s',
                        minWidth: 120,
                    }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', pointerEvents: 'none' }}>Volta</label>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: displayBack ? 'var(--text-dark)' : '#CBD5E1' }}>
                            {displayBack || 'dd/mm/aaaa'}
                        </span>
                    </div>
                )}
            </div>

            {panel && createPortal(panel, document.body)}
        </>
    )
}
