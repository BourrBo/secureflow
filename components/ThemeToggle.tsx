'use client'
import { useEffect, useState } from 'react'

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('secureflow-theme') as 'dark' | 'light') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('secureflow-theme', next)
  }

  if (!mounted) {
    return <div style={{ width: compact ? 32 : 90, height: compact ? 32 : 24 }} />
  }

  const isDark = theme === 'dark'

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 14,
          color: 'var(--text2)',
          transition: 'all .15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        {isDark ? '☀️' : '🌙'}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>
        {isDark ? '🌙 Dark mode' : '☀️ Light mode'}
      </span>
      <div
        onClick={toggleTheme}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: isDark ? 'var(--blue)' : 'var(--border)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background .2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            top: 3,
            left: isDark ? 23 : 3,
            transition: 'left .2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
          }}
        >
          {isDark ? '🌙' : '☀️'}
        </div>
      </div>
    </div>
  )
}
