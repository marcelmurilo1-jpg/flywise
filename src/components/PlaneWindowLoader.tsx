import { motion } from 'framer-motion'

interface PlaneWindowLoaderProps {
    message?: string
    subMessage?: string
}

export function PlaneWindowLoader({ message = 'Buscando os melhores voos...', subMessage = 'Cruzando preços, milhas e promoções ativas' }: PlaneWindowLoaderProps) {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #dbeafe 0%, #f0f9ff 50%, #f5f7fa 100%)',
            gap: '40px',
        }}>
            {/* Airplane window frame */}
            <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                    width: '280px',
                    height: '340px',
                    borderRadius: '50% 50% 48% 48% / 40% 40% 50% 50%',
                    background: 'linear-gradient(180deg, #bfdbfe 0%, #e0f2fe 30%, #f0f9ff 70%, #bfdbfe 100%)',
                    border: '8px solid rgba(255,255,255,0.7)',
                    boxShadow: '0 0 0 4px rgba(147,197,253,0.4), 0 24px 60px rgba(59,130,246,0.2), inset 0 2px 20px rgba(255,255,255,0.6)',
                    position: 'relative',
                    overflow: 'hidden',
                    backdropFilter: 'blur(8px)',
                }}
            >
                {/* Sky gradient inside window */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, #93c5fd 0%, #dbeafe 35%, #e0f2fe 60%, #f0fdf4 100%)',
                }} />

                {/* Sun */}
                <div style={{
                    position: 'absolute', top: '28px', right: '48px',
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 40%, #fef9c3, #fde68a)',
                    boxShadow: '0 0 20px rgba(253,230,138,0.6)',
                }} />

                {/* Cloud 1 */}
                <Cloud style={{ top: '70px', animationDuration: '5s', animationDelay: '0s', width: '90px' }} />
                {/* Cloud 2 */}
                <Cloud style={{ top: '120px', animationDuration: '7s', animationDelay: '1.5s', width: '60px', opacity: 0.7 }} />
                {/* Cloud 3 */}
                <Cloud style={{ top: '55px', animationDuration: '6s', animationDelay: '3s', width: '75px', opacity: 0.6 }} />
                {/* Cloud 4 */}
                <Cloud style={{ top: '145px', animationDuration: '8s', animationDelay: '0.8s', width: '50px', opacity: 0.5 }} />

                {/* Horizon / ground blur */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '80px',
                    background: 'linear-gradient(to top, rgba(209,250,229,0.5), transparent)',
                }} />

                {/* Airplane silhouette */}
                <motion.div
                    animate={{ y: [0, -8, 0], rotate: [-6, -4, -6] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        bottom: '55px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                    }}
                >
                    <svg width="56" height="28" viewBox="0 0 56 28" fill="none">
                        <path d="M2 18L14 4l6 6-8 8 4 2 20-8 4 2-20 8 2 5-6-1-2-4-6 2-2-4z" fill="white" fillOpacity="0.9" />
                        <path d="M14 18l10-5" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" />
                        <path d="M2 18L54 10" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
                    </svg>
                </motion.div>

                {/* Wing reflection */}
                <div style={{
                    position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
                    width: '120px', height: '12px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    borderRadius: '50%',
                }} />

                {/* Pulsing glow ring */}
                <motion.div
                    animate={{ scale: [1, 1.06, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        inset: '20px',
                        borderRadius: '50% 50% 48% 48% / 40% 40% 50% 50%',
                        border: '1px solid rgba(147,197,253,0.4)',
                        pointerEvents: 'none',
                    }}
                />
            </motion.div>

            {/* Text */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                style={{ textAlign: 'center' }}
            >
                {/* AI loading dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
                    {[0, 1, 2].map(i => (
                        <motion.div
                            key={i}
                            animate={{ opacity: [0.2, 1, 0.2], y: [0, -4, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                            style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-start)' }}
                        />
                    ))}
                </div>
                <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {message}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '260px', lineHeight: 1.5 }}>
                    {subMessage}
                </p>
            </motion.div>
        </div>
    )
}

function Cloud({ style }: { style: React.CSSProperties }) {
    return (
        <motion.div
            animate={{ x: [160, -200] }}
            transition={{ duration: parseFloat(String(style.animationDuration ?? '6')), repeat: Infinity, ease: 'linear', delay: parseFloat(String(style.animationDelay ?? '0')) }}
            style={{
                position: 'absolute',
                left: 0,
                ...style,
                animationDuration: undefined,
                animationDelay: undefined,
            }}
        >
            <div style={{
                width: style.width ?? '80px',
                height: '28px',
                background: 'rgba(255,255,255,0.85)',
                borderRadius: '20px',
                boxShadow: '0 2px 8px rgba(147,197,253,0.2)',
                position: 'relative',
            }}>
                <div style={{
                    position: 'absolute', top: '-11px', left: '18px',
                    width: '32px', height: '28px',
                    background: 'rgba(255,255,255,0.85)',
                    borderRadius: '50%',
                }} />
                <div style={{
                    position: 'absolute', top: '-7px', left: '36px',
                    width: '24px', height: '22px',
                    background: 'rgba(255,255,255,0.85)',
                    borderRadius: '50%',
                }} />
            </div>
        </motion.div>
    )
}
