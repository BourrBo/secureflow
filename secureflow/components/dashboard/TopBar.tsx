'use client'

interface TopBarProps {
  title: string
  breadcrumb?: { label: string; href?: string }[]
  actions?: React.ReactNode
}

export default function TopBar({ title, breadcrumb, actions }: TopBarProps) {
  return (
    <div style={{
      height: 56, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      background: 'var(--bg, #03080F)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Left: title or breadcrumb */}
      <div>
        {breadcrumb ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span>/</span>}
                {i === breadcrumb.length - 1
                  ? <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{crumb.label}</span>
                  : <a href={crumb.href} style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>{crumb.label}</a>
                }
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>{title}</div>
        )}
      </div>

      {/* Right: search + notif + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 7, padding: '5px 12px', width: 200,
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>⌕</span>
          <input
            placeholder="Search findings…"
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 12, color: '#F0F4FF', width: '100%',
              fontFamily: 'var(--body)',
            }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>⌘K</span>
        </div>

        {/* Notification bell */}
        <button style={{
          width: 32, height: 32, borderRadius: 7,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', fontSize: 14, color: 'rgba(255,255,255,0.5)',
        }}>
          🔔
          <div style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: '#C0372A', border: '1.5px solid var(--bg)' }} />
        </button>

        {/* Custom actions */}
        {actions}
      </div>
    </div>
  )
}
