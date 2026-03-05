import { useState } from "react"
import { motion } from "framer-motion"
import type { FC } from "react"

interface NavItem {
  name: string
  url: string
  icon: FC<{ size?: number; strokeWidth?: number }>
}

interface NavBarProps {
  items: NavItem[]
}

export function NavBar({ items }: NavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0].name)
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  const highlighted = hoveredTab ?? activeTab

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '14px',
      padding: '5px',
      gap: '2px',
    }}>
      {items.map((item) => {
        const Icon = item.icon
        const isHighlighted = highlighted === item.name

        return (
          <a
            key={item.name}
            href={item.url}
            onClick={() => setActiveTab(item.name)}
            onMouseEnter={() => setHoveredTab(item.name)}
            onMouseLeave={() => setHoveredTab(null)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: 500,
              padding: '7px 16px',
              borderRadius: '10px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              color: isHighlighted ? '#fff' : 'rgba(255,255,255,0.65)',
              transition: 'color 0.18s ease',
            }}
          >
            <span style={{ display: 'none' }} className="mobile-icon">
              <Icon size={18} strokeWidth={2.5} />
            </span>
            <span>{item.name}</span>

            {isHighlighted && (
              <motion.div
                layoutId="lamp"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.10)',
                  zIndex: -1,
                }}
                initial={false}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {/* Efeito lamp — brilho no topo */}
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px',
                  height: '3px',
                  borderRadius: '0 0 4px 4px',
                  background: '#4A90E2',
                }}>
                  <div style={{
                    position: 'absolute',
                    width: '48px',
                    height: '20px',
                    background: 'rgba(74,144,226,0.25)',
                    borderRadius: '50%',
                    filter: 'blur(8px)',
                    top: '-6px',
                    left: '-8px',
                  }} />
                </div>
              </motion.div>
            )}
          </a>
        )
      })}
    </div>
  )
}
