import { createContext, useContext, useEffect } from 'react'

interface ThemeContextValue {
    theme: 'light'
    toggleTheme: () => void
    isDark: false
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => {},
    isDark: false,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'light')
        localStorage.removeItem('flywise-theme')
    }, [])

    return (
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {}, isDark: false }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    return useContext(ThemeContext)
}
