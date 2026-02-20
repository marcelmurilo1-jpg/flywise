import { motion } from 'framer-motion'

interface GlobeRouteProps {
    origem: string
    destino: string
}

export function GlobeRoute({ origem, destino }: GlobeRouteProps) {
    return (
        <div style={{ position: 'relative', width: '280px', height: '280px', margin: '0 auto' }}>
            {/* Outer glow ring */}
            <motion.div
                animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    position: 'absolute', inset: '-10px',
                    borderRadius: '50%',
                    border: '1px solid rgba(59,130,246,0.25)',
                }}
            />

            {/* Globe SVG */}
            <svg
                width="280" height="280" viewBox="0 0 280 280"
                style={{ position: 'absolute', inset: 0 }}
            >
                <defs>
                    <radialGradient id="globeGrad" cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#eff6ff" />
                        <stop offset="40%" stopColor="#dbeafe" />
                        <stop offset="100%" stopColor="#bfdbfe" />
                    </radialGradient>
                    <radialGradient id="globeShine" cx="30%" cy="25%" r="50%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </radialGradient>
                    <filter id="globeShadow">
                        <feDropShadow dx="0" dy="8" stdDeviation="16" floodColor="rgba(59,130,246,0.15)" />
                    </filter>
                    <clipPath id="globeCircle">
                        <circle cx="140" cy="140" r="110" />
                    </clipPath>
                </defs>

                {/* Globe base */}
                <circle cx="140" cy="140" r="110" fill="url(#globeGrad)" filter="url(#globeShadow)" />

                {/* Latitude lines */}
                {[-55, -25, 0, 25, 55].map(lat => {
                    const ry = Math.cos((lat * Math.PI) / 180) * 108
                    const cy2 = 140 + Math.sin((lat * Math.PI) / 180) * 108
                    return (
                        <ellipse
                            key={lat}
                            cx="140" cy={cy2}
                            rx={ry} ry={ry * 0.22}
                            fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="0.8"
                            clipPath="url(#globeCircle)"
                        />
                    )
                })}

                {/* Longitude lines */}
                {[0, 30, 60, 90, 120, 150].map(lng => (
                    <ellipse
                        key={lng}
                        cx="140" cy="140"
                        rx={Math.abs(Math.cos((lng * Math.PI) / 180) * 110)} ry="110"
                        fill="none" stroke="rgba(59,130,246,0.09)" strokeWidth="0.8"
                        clipPath="url(#globeCircle)"
                        transform={`rotate(${lng}, 140, 140)`}
                    />
                ))}

                {/* Land masses (simplified) */}
                <g clipPath="url(#globeCircle)" fill="rgba(167,210,255,0.25)" stroke="rgba(59,130,246,0.15)" strokeWidth="0.5">
                    <ellipse cx="110" cy="115" rx="28" ry="22" />
                    <ellipse cx="165" cy="120" rx="20" ry="15" />
                    <ellipse cx="155" cy="155" rx="18" ry="12" />
                    <ellipse cx="90" cy="150" rx="14" ry="10" />
                    <ellipse cx="180" cy="100" rx="12" ry="9" />
                    <ellipse cx="130" cy="100" rx="10" ry="7" />
                </g>

                {/* Shine overlay */}
                <circle cx="140" cy="140" r="110" fill="url(#globeShine)" />
                <circle cx="140" cy="140" r="110" fill="none" stroke="rgba(147,197,253,0.4)" strokeWidth="1" />

                {/* Route arc */}
                <motion.path
                    d="M 88 165 Q 140 70 192 145"
                    fill="none"
                    stroke="url(#routeGradient)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="200"
                    initial={{ strokeDashoffset: 200 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }}
                />
                <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
                    </linearGradient>
                </defs>

                {/* Origin dot */}
                <motion.circle
                    cx="88" cy="165" r="5"
                    fill="#3b82f6"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    style={{ transformOrigin: '88px 165px' }}
                />
                {/* Origin pulse */}
                <motion.circle
                    cx="88" cy="165" r="9"
                    fill="none" stroke="#3b82f6" strokeWidth="1.5"
                    animate={{ r: [9, 14, 9], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />

                {/* Destination dot */}
                <motion.circle
                    cx="192" cy="145" r="5"
                    fill="#06b6d4"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 1.8, duration: 0.3 }}
                    style={{ transformOrigin: '192px 145px' }}
                />
                <motion.circle
                    cx="192" cy="145" r="9"
                    fill="none" stroke="#06b6d4" strokeWidth="1.5"
                    animate={{ r: [9, 14, 9], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 2, ease: 'easeOut' }}
                />

                {/* Animated plane along arc (keyframe waypoints) */}
                <motion.g
                    initial={{ x: 88, y: 165 }}
                    animate={{ x: [88, 120, 155, 192], y: [165, 95, 88, 145] }}
                    transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }}
                >
                    <g transform="translate(-7,-7)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#3b82f6" />
                        </svg>
                    </g>
                </motion.g>
            </svg>

            {/* Labels */}
            <div style={{
                position: 'absolute', bottom: '-32px', left: 0, right: 0,
                display: 'flex', justifyContent: 'space-between', padding: '0 24px',
            }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-start)', letterSpacing: '0.1em' }}>{origem}</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#06b6d4', letterSpacing: '0.1em' }}>{destino}</span>
            </div>
        </div>
    )
}
