'use client'
import Link from 'next/link'

export default function Navbar() {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(3,8,15,0.85)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div
            style={{
              width: 34, height: 34,
              background: 'var(--blue)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font)', fontSize: 13, fontWeight: 800, color: '#fff',
            }}
          >
            SF
          </div>
          <span style={{ fontFamily: 'var(--font)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            Secure<span style={{ color: 'var(--blue)' }}>Flow</span>
          </span>
        </Link>

        {/* Nav Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {['Features', 'How it works', 'Integrations', 'Pricing', 'Docs'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '')}`}
              style={{
                fontSize: 13, color: 'var(--text2)', padding: '6px 12px',
                borderRadius: 6, textDecoration: 'none', transition: 'color .15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text2)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Right CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="#"
            style={{
              fontFamily: 'var(--font)', fontSize: 13, fontWeight: 500,
              padding: '8px 16px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text2)', textDecoration: 'none',
            }}
          >
            Sign in
          </a>
          <a
            href="#"
            style={{
              fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600,
              padding: '8px 18px', borderRadius: 7,
              background: 'var(--blue)', color: '#fff', textDecoration: 'none',
              boxShadow: '0 0 20px rgba(27,127,255,0.3)',
            }}
          >
            Start free →
          </a>
        </div>
      </div>
    </nav>
  )
}
