import { useState } from 'react'

/**
 * AircraftReveal — Lando Norris-style hover slide reveal.
 *
 * On hover: the interior image slides in smoothly from left (CSS transition only).
 * No cursor tracking. Clean, instant, modern.
 *
 * A thin glowing vertical "sweep" line travels across the image as the
 * reveal animates, disappearing once settled.
 */
export function AircraftReveal() {
    const [hovered, setHovered] = useState(false)

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                cursor: 'pointer',
            }}
        >
            {/* BOTTOM — exterior (always visible behind) */}
            <img
                src="/aircraft-exterior.png"
                alt="Fly Wise exterior"
                draggable={false}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            />

            {/* TOP — interior that slides in on hover */}
            <img
                src="/aircraft-interior.png"
                alt="Fly Wise interior"
                draggable={false}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    // Slide wipe from right edge → reveals fully on hover
                    clipPath: hovered
                        ? 'inset(0 0% 0 0 round 0px)'
                        : 'inset(0 100% 0 0 round 0px)',
                    transition: 'clip-path 0.85s cubic-bezier(0.76, 0, 0.24, 1)',
                }}
            />

            {/* Sweep line — travels across during animation, then fades */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '3px',
                    background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.95) 20%, #fff 50%, rgba(255,255,255,0.95) 80%, transparent 100%)',
                    boxShadow: '0 0 16px rgba(255,255,255,0.7), 0 0 32px rgba(74,144,226,0.5)',
                    // Line moves with the wipe: 0% → 100% on hover, reverse on leave
                    left: hovered ? '100%' : '0%',
                    transform: 'translateX(-50%)',
                    transition: 'left 0.85s cubic-bezier(0.76, 0, 0.24, 1)',
                    opacity: 0.9,
                    pointerEvents: 'none',
                    zIndex: 10,
                }}
            />

            {/* Dark gradient overlay (bottom) — for text readability */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(6,15,31,0.25) 0%, rgba(6,15,31,0.08) 40%, rgba(6,15,31,0.55) 100%)',
                pointerEvents: 'none',
                zIndex: 5,
            }} />

            {/* Label badges — bottom corners */}
            <div style={{
                position: 'absolute',
                bottom: '24px',
                left: '28px',
                right: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                zIndex: 11,
                pointerEvents: 'none',
            }}>
                {/* Left: exterior label */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(6,15,31,0.60)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '100px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: hovered ? 'rgba(255,255,255,0.3)' : '#fff',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    transition: 'color 0.5s ease',
                }}>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#4A90E2',
                        display: 'inline-block',
                        boxShadow: '0 0 5px #4A90E2',
                    }} />
                    Exterior
                </div>

                {/* Center: brand */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                        <path d="M7 1L1 7m0 0l6 6M1 7h16" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ opacity: hovered ? 0 : 1, transition: 'opacity 0.3s' }}>
                        Hover para revelar
                    </span>
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                        <path d="M11 1l6 6m0 0l-6 6m6-6H1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>

                {/* Right: interior label */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(6,15,31,0.60)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '100px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: hovered ? '#fff' : 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    transition: 'color 0.5s ease 0.3s',
                }}>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#34d399',
                        display: 'inline-block',
                        boxShadow: '0 0 5px #34d399',
                    }} />
                    Interior
                </div>
            </div>
        </div>
    )
}
