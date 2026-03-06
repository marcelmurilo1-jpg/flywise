import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface ThemeToggleProps {
    style?: React.CSSProperties
}

export function ThemeToggle({ style }: ThemeToggleProps) {
    const { isDark, toggleTheme } = useTheme()

    return (
        <div
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && toggleTheme()}
            title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            style={{
                display: 'flex',
                alignItems: 'center',
                width: '56px',
                height: '30px',
                padding: '3px',
                borderRadius: '999px',
                cursor: 'pointer',
                transition: 'background 0.3s ease, border-color 0.3s ease',
                background: isDark ? '#18212f' : '#f1f5f9',
                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                flexShrink: 0,
                position: 'relative',
                ...style,
            }}
        >
            {/* Sliding knob */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease',
                transform: isDark ? 'translateX(26px)' : 'translateX(0)',
                background: isDark ? '#1e40af' : '#ffffff',
                boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.12)',
            }}>
                {isDark
                    ? <Moon size={13} strokeWidth={2} color="#93c5fd" />
                    : <Sun size={13} strokeWidth={2} color="#f59e0b" />
                }
            </div>
        </div>
    )
}
