'use client'
import Link from 'next/link'

const weeklyData = [55, 62, 48, 70, 80, 65, 45, 50, 55, 42, 35, 30, 42, 55, 40, 25]

const topProjects = [
  { name: 'api-gateway',     lang: 'Node.js', files: 34, sev: 'critical', count: 8,  color: '#FF6B6B' },
  { name: 'auth-service',    lang: 'Python',  files: 18, sev: 'high',     count: 14, color: '#FFB020' },
  { name: 'payment-ms',      lang: 'Java',    files: 52, sev: 'high',     count: 9,  color: '#FFB020' },
  { name: 'frontend-app',    lang: 'React',   files: 87, sev: 'medium',   count: 22, color: '#4D9FFF' },
  { name: 'infra-terraform', lang: 'IaC',     files: 14, sev: 'medium',   count: 17, color: '#4D9FFF' },
]

const recentScans = [
  { project: 'api-gateway',   module: 'SAST',    ago: '2h ago',   status: 'critical', label: '8 new' },
  { project: 'auth-service',  module: 'SCA',     ago: '4h ago',   status: 'high',     label: '2 CVEs' },
  { project: 'infra-tf',      module: 'IaC',     ago: 'Yesterday',status: 'medium',   label: '5 issues' },
  { project: 'frontend-app',  module: 'Secrets', ago: '2 days',   status: 'clean',    label: 'Clean' },
  { project: 'payment-ms',    module: 'SAST',    ago: '3 days',   status: 'high',     label: '1 new' },
]

const modules = [
  { name: 'SAST',      pct: 100, color: '#1B7FFF' },
  { name: 'SCA',       pct: 87,  color: '#00E576' },
  { name: 'Secrets',   pct: 72,  color: '#FFB020' },
  { name: 'IaC',       pct: 45,  color: '#FF3B5C' },
  { name: 'Container', pct: 0,   color: '#3D5070', phase: 'Ph3' },
]

const sevColors: Record<string, string> = {
  critical: '#FF6B6B', high: '#FFB020', medium: '#4D9FFF', clean: '#00E576',
}

export default function DashboardPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── TOP BAR ── */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>Security Overview</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 12px', width: 200 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>⌕</span>
            <input placeholder="Search findings…" style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#F0F4FF', width: '100%', fontFamily: 'var(--body)' }} />
          </div>
          <button style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
            🔔
            <div style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: '#C0372A', border: '1.5px solid var(--bg)' }} />
          </button>
          <Link href="/dashboard/sast" style={{ fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, background: '#1B7FFF', color: '#fff', textDecoration: 'none', boxShadow: '0 0 16px rgba(27,127,255,0.3)', whiteSpace: 'nowrap' }}>
            + New Scan
          </Link>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Zero-day banner */}
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(192,55,42,0.1)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <span style={{ color: '#FF6B6B', fontWeight: 500 }}>Zero-day alert:</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Critical CVE-2025-1234 found in lodash@4.17.20 used by 3 of your projects.</span>
          <Link href="/dashboard/sca" style={{ marginLeft: 'auto', fontSize: 11, color: '#FF6B6B', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}>View affected →</Link>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Security Score', value: '64', sub: '▼ 3 pts vs last week', subDown: true, color: '#FFB020' },
            { label: 'Open Critical', value: '17', sub: '▲ 4 added today', subDown: true, color: '#FF3B5C' },
            { label: 'Fixed — 30 days', value: '142', sub: '▲ +23 vs last month', subUp: true, color: '#00E576' },
            { label: 'MTTR', value: '6.2d', sub: '▼ Improved 1.1d', subUp: true, color: '#1B7FFF' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, marginTop: 5, color: s.subDown ? '#FF3B5C' : s.subUp ? '#00E576' : 'rgba(255,255,255,0.35)' }}>{s.sub}</div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
            </div>
          ))}
        </div>

        {/* ── CHART + TOP RISKS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12, marginBottom: 12 }}>

          {/* Trend chart */}
          <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>Vulnerability trend — 16 weeks</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[{ c: '#C0372A', l: 'Critical' }, { c: '#B86A00', l: 'High' }, { c: '#1B7FFF', l: 'Medium' }].map(({ c, l }) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
              {weeklyData.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i < 6 ? '#C0372A' : i < 10 ? '#B86A00' : '#1B7FFF', opacity: 0.75, minWidth: 0, transition: 'opacity .15s', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {['W1', 'W4', 'W8', 'W12', 'W16'].map((w) => (
                <span key={w} style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--mono)' }}>{w}</span>
              ))}
            </div>
          </div>

          {/* Top risky projects */}
          <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>Top risky projects</div>
              <Link href="/dashboard/projects" style={{ fontSize: 11, color: '#4D9FFF', textDecoration: 'none' }}>View all →</Link>
            </div>
            {topProjects.map((p) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{p.lang} · {p.files} files</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: `${p.color}20`, color: p.color, whiteSpace: 'nowrap' }}>
                  {p.count} {p.sev}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MODULE COVERAGE + RECENT SCANS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Module coverage */}
          <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 14 }}>Module scan coverage</div>
            {modules.map((m) => (
              <div key={m.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    {m.name}
                    {m.phase && <span style={{ fontSize: 9, marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: 'rgba(27,127,255,0.15)', color: '#4D9FFF' }}>{m.phase}</span>}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: m.pct === 0 ? 'rgba(255,255,255,0.25)' : m.pct < 50 ? '#FF3B5C' : m.pct < 80 ? '#FFB020' : '#00E576' }}>
                    {m.pct === 0 ? 'Not started' : `${m.pct}%`}
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${m.pct}%`, background: m.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent scan activity */}
          <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>Recent scan activity</div>
              <Link href="/dashboard/sast" style={{ fontSize: 11, color: '#4D9FFF', textDecoration: 'none' }}>See all →</Link>
            </div>
            {recentScans.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentScans.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                  {s.module === 'SAST' ? '⬡' : s.module === 'SCA' ? '◉' : s.module === 'Secrets' ? '◈' : '◫'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.project} · {s.module}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{s.ago}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: `${sevColors[s.status] || '#00E576'}18`, color: sevColors[s.status] || '#00E576', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
