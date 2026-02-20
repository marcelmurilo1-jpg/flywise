import { motion } from 'framer-motion'

/**
 * Large ambient globe positioned in the top-right corner —
 * matches the reference UI background decoration.
 * Fully CSS/SVG, no external deps.
 */
export function GlobeBackground() {
    return (
        <div style={{
            position: 'fixed',
            top: '-80px',
            right: '-120px',
            width: '640px',
            height: '640px',
            pointerEvents: 'none',
            zIndex: 0,
            opacity: 0.55,
        }}>
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
                style={{ width: '100%', height: '100%' }}
            >
                <svg width="640" height="640" viewBox="0 0 640 640">
                    <defs>
                        <radialGradient id="bgGlobeGrad" cx="40%" cy="35%" r="60%">
                            <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.4" />
                            <stop offset="55%" stopColor="#93c5fd" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.05" />
                        </radialGradient>
                        <clipPath id="bgGlobeClip">
                            <circle cx="320" cy="320" r="260" />
                        </clipPath>
                    </defs>

                    {/* Globe sphere */}
                    <circle cx="320" cy="320" r="260" fill="url(#bgGlobeGrad)" />
                    <circle cx="320" cy="320" r="260" fill="none" stroke="rgba(147,197,253,0.3)" strokeWidth="1" />

                    {/* Latitude lines */}
                    {[-100, -60, -20, 20, 60, 100].map(lat => {
                        const ry = Math.cos((lat * Math.PI) / 180) * 258
                        const cy2 = 320 + Math.sin((lat * Math.PI) / 180) * 258
                        return (
                            <ellipse
                                key={lat} cx="320" cy={cy2}
                                rx={ry} ry={ry * 0.22}
                                fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="0.8"
                                clipPath="url(#bgGlobeClip)"
                            />
                        )
                    })}

                    {/* Longitude lines */}
                    {[0, 30, 60, 90, 120, 150].map(lng => (
                        <ellipse
                            key={lng} cx="320" cy="320"
                            rx={Math.abs(Math.cos((lng * Math.PI) / 180) * 260)} ry="260"
                            fill="none" stroke="rgba(59,130,246,0.08)" strokeWidth="0.8"
                            clipPath="url(#bgGlobeClip)"
                            transform={`rotate(${lng}, 320, 320)`}
                        />
                    ))}
                </svg>
            </motion.div>

            {/* Route arc overlay (static) */}
            <svg
                style={{ position: 'absolute', inset: 0 }}
                width="640" height="640" viewBox="0 0 640 640"
            >
                <defs>
                    <linearGradient id="bgArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
                    </linearGradient>
                </defs>
                {/* GRU → JFK arc approximation */}
                <motion.path
                    d="M 520 470 Q 380 200 200 280"
                    fill="none"
                    stroke="url(#bgArcGrad)"
                    strokeWidth="1.5"
                    strokeDasharray="300"
                    initial={{ strokeDashoffset: 300 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 2.5, ease: 'easeInOut', delay: 0.5 }}
                />
                {/* New York dot */}
                <motion.circle cx="200" cy="280" r="5" fill="#3b82f6" fillOpacity="0.6"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.8, duration: 0.3 }}
                    style={{ transformOrigin: '200px 280px' }}
                />
                <motion.circle cx="200" cy="280" r="9" fill="none" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.4"
                    animate={{ r: [9, 16, 9], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: 3 }}
                />
                <text x="170" y="265" fontSize="10" fill="#3b82f6" fillOpacity="0.7" fontFamily="Inter, sans-serif" fontWeight="600">New York</text>

                {/* São Paulo dot */}
                <motion.circle cx="520" cy="470" r="5" fill="#06b6d4" fillOpacity="0.6"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, duration: 0.3 }}
                    style={{ transformOrigin: '520px 470px' }}
                />
                <motion.circle cx="520" cy="470" r="9" fill="none" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.4"
                    animate={{ r: [9, 16, 9], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                />
                <text x="490" y="493" fontSize="10" fill="#06b6d4" fillOpacity="0.7" fontFamily="Inter, sans-serif" fontWeight="600">São Paulo</text>
            </svg>
        </div>
    )
}
