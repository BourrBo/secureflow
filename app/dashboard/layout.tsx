'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const navSections = [
  {
    label: 'Overview',
    items: [
      { icon: '▦', label: 'Dashboard', href: '/dashboard' },
      { icon: '◧', label: 'Projects', href: '/dashboard/projects', badge: '14', badgeColor: '#1B7FFF' },
    ],
  },
  {
    label: 'Scan Modules',
    items: [
      { icon: '⬡', label: 'SAST', href: '/dashboard/sast', badge: '8', badgeColor: '#C0372A' },
      { icon: '◉', label: 'SCA — Dependencies', href: '/dashboard/sca' },
      { icon: '◈', label: 'Secrets Detection', href: '/dashboard/secrets', badge: '3', badgeColor: '#C0372A' },
      { icon: '◫', label: 'IaC Security', href: '/dashboard/iac' },
      { icon: '⬟', label: 'Container Scan', href: '/dashboard/container', phase: 'Ph3' },
      { icon: '◎', label: 'DAST', href: '/dashboard/dast', phase: 'Ph3' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { icon: '⊞', label: 'Compliance', href: '/dashboard/compliance' },
      { icon: '◫', label: 'Reports', href: '/dashboard/reports' },
      { icon: '◌', label: 'Settings', href: '/dashboard/settings' },
    ],
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--body)' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: collapsed ? 60 : 220,
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        position: 'relative', zIndex: 50,
      }}>

        {/* Brand */}
        <div style={{ padding: '0 14px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {!collapsed && (
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
              <div style={{ width: 28, height: 28, background: '#1B7FFF', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>SF</div>
              <span style={{ fontFamily: 'var(--font)', fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                Secure<span style={{ color: '#4D9FFF' }}>Flow</span>
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', textDecoration: 'none' }}>
              <div style={{ width: 28, height: 28, background: '#1B7FFF', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)', fontSize: 11, fontWeight: 800, color: '#fff' }}>SF</div>
            </Link>
          )}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: 4, lineHeight: 1 }}>←</button>
          )}
        </div>

        {collapsed && (
          <button onClick={() => setCollapsed(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: '8px', width: '100%', textAlign: 'center' }}>→</button>
        )}

        {/* Org selector */}
        {!collapsed && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: '#1B7FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>A</div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Acme Corp</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>▾</span>
            </div>
          </div>
        )}

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 18px 4px', fontFamily: 'var(--mono)' }}>
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: collapsed ? 0 : 9,
                      padding: collapsed ? '9px 0' : '7px 14px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      fontSize: 12, textDecoration: 'none',
                      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                      background: active ? 'rgba(27,127,255,0.18)' : 'transparent',
                      borderLeft: active ? '2px solid #1B7FFF' : '2px solid transparent',
                      transition: 'all .12s',
                      position: 'relative',
                      fontWeight: active ? 500 : 400,
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' } }}
                  >
                    <span style={{ fontSize: 13, flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                    {!collapsed && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: item.badgeColor, color: '#fff', flexShrink: 0 }}>{item.badge}</span>
                    )}
                    {!collapsed && item.phase && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'rgba(27,127,255,0.15)', color: '#4D9FFF', flexShrink: 0 }}>{item.phase}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Theme toggle row */}
        <div style={{ padding: collapsed ? '10px 0' : '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start', flexShrink: 0 }}>
          <ThemeToggle compact />
        </div>

        {/* User footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1B7FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>RK</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Rahul Kumar</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>AppSec Lead</div>
              </div>
              <Link href="/login" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }} title="Sign out">⎋</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1B7FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>RK</div>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
