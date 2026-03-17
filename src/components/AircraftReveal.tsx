import { useRef, useState, useCallback, useEffect } from 'react'

/**
 * AircraftReveal — Soft Fluid Spotlight Reveal
 *
 * Keeps the exact aspect ratio of the image (no distortion/stretching).
 * When hovered, a soft "x-ray" spotlight (radial-gradient mask) follows
 * the mouse to smoothly reveal the interior cutaway beneath.
 */
export function AircraftReveal() {
    const containerRef = useRef<HTMLDivElement>(null)
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
    const [hovering, setHovering] = useState(false)
    
    // Smooth trailing effect using RequestAnimationFrame (lerp)
    const rafRef = useRef<number>(0)
    const targetCoords = useRef({ x: 50, y: 50 })
    const currentCoords = useRef({ x: 50, y: 50 })

    useEffect(() => {
        function animate() {
            const dx = targetCoords.current.x - currentCoords.current.x
            const dy = targetCoords.current.y - currentCoords.current.y
            
            if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                // Easing factor (lower is smoother/slower)
                currentCoords.current.x += dx * 0.15
                currentCoords.current.y += dy * 0.15
                setMousePos({ x: currentCoords.current.x, y: currentCoords.current.y })
            }
            rafRef.current = requestAnimationFrame(animate)
        }
        rafRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(rafRef.current)
    }, [])

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        targetCoords.current = {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        }
    }, [])

    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        
        // Snap immediately to entrance point so the animation starts there
        targetCoords.current = { x, y }
        currentCoords.current = { x, y }
        setMousePos({ x, y })
        setHovering(true)
    }, [])

    const handleMouseLeave = () => {
        setHovering(false)
        // Optionally drift back to center or just stay where it left
        // targetCoords.current = { x: 50, y: 50 } 
    }

    // --- Touch Support for Mobile ---
    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (!containerRef.current || !e.touches[0]) return
        const rect = containerRef.current.getBoundingClientRect()
        targetCoords.current = {
            x: ((e.touches[0].clientX - rect.left) / rect.width) * 100,
            y: ((e.touches[0].clientY - rect.top) / rect.height) * 100,
        }
    }, [])

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (!containerRef.current || !e.touches[0]) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100
        const y = ((e.touches[0].clientY - rect.top) / rect.height) * 100
        
        targetCoords.current = { x, y }
        currentCoords.current = { x, y }
        setMousePos({ x, y })
        setHovering(true)
    }, [])

    const handleTouchEnd = () => {
        setHovering(false)
    }

    // Size of the reveal mask (radius limits)
    const MASK_SIZE = '18%'

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                position: 'relative',
                width: '100%',
                // Fixed aspect ratio cropping top and bottom natively
                aspectRatio: '16 / 7.5',
                borderRadius: '24px',
                overflow: 'hidden',
                cursor: 'default',
                boxShadow: '0 32px 80px rgba(14,42,85,0.22)',
                lineHeight: 0, // Removes phantom bottom spacing
                touchAction: 'none', // Prevents scrolling while swiping on the plane
            }}
        >
            {/* BOTTOM LAYER — exterior (Provides the natural container height) */}
            <img
                src="/aircraft-exterior.jpg"
                alt="Fly Wise exterior"
                draggable={false}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            />

            {/* TOP LAYER — interior (Positioned absolute over the exterior) */}
            {/* The CSS mask-image creates a transparent 'hole' over the image based on mouse position */}
            <img
                src="/aircraft-interior.jpg"
                alt="Fly Wise interior"
                draggable={false}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    // Fluid spotlight mask
                    WebkitMaskImage: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) ${MASK_SIZE}, rgba(0,0,0,0) calc(${MASK_SIZE} + 10%))`,
                    maskImage: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) ${MASK_SIZE}, rgba(0,0,0,0) calc(${MASK_SIZE} + 10%))`,
                    
                    // Smooth fade in/out on hover
                    opacity: hovering ? 1 : 0,
                    transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            />

            {/* Hint overlay to encourage interaction (fades on hover) */}
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(6,15,31,0.08)',
                pointerEvents: 'none',
                opacity: hovering ? 0 : 1,
                transition: 'opacity 0.5s ease',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(14,26,50,0.6)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '100px',
                    padding: '10px 22px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    Passe o mouse ou dedo
                </div>
            </div>
        </div>
    )
}
