'use client'
import { useState } from 'react'
import Link from 'next/link'

const dependencies = [
  { id: 1,  name: 'lodash',          version: '4.17.20', fixedIn: '4.17.21', ecosystem: 'npm',    cve: 'CVE-2021-23337', cvss: 7.2,  severity: 'high',     license: 'MIT',   transitive: false, projects: ['api-gateway', 'frontend-app'] },
  { id: 2,  name: 'axios',           version: '0.21.1',  fixedIn: '0.21.2',  ecosystem: 'npm',    cve: 'CVE-2021-3749',  cvss: 6.1,  severity: 'medium',   license: 'MIT',   transitive: false, projects: ['api-gateway'] },
  { id: 3,  name: 'log4j-core',      version: '2.14.0',  fixedIn: '2.17.1',  ecosystem: 'maven',  cve: 'CVE-2021-44228', cvss: 10.0, severity: 'critical', license: 'Apache', transitive: true,  projects: ['payment-ms'] },
  { id: 4,  name: 'minimist',        version: '1.2.5',   fixedIn: '1.2.6',   ecosystem: 'npm',    cve: 'CVE-2021-44906', cvss: 9.8,  severity: 'critical', license: 'MIT',   transitive: true,  projects: ['api-gateway', 'auth-service'] },
  { id: 5,  name: 'django',          version: '3.2.12',  fixedIn: '3.2.13',  ecosystem: 'pip',    cve: 'CVE-2022-28346', cvss: 9.8,  severity: 'critical', license: 'BSD',   transitive: false, projects: ['auth-service'] },
  { id: 6,  name: 'moment',          version: '2.29.1',  fixedIn: '2.29.4',  ecosystem: 'npm',    cve: 'CVE-2022-24785', cvss: 7.5,  severity: 'high',     license: 'MIT',   transitive: false, projects: ['frontend-app'] },
  { id: 7,  name: 'xmldom',          version: '0.6.0',   fixedIn: '0.8.3',   ecosystem: 'npm',    cve: 'CVE-2022-37616', cvss: 9.8,  severity: 'critical', license: 'MIT',   transitive: true,  projects: ['api-gateway'] },
  { id: 8,  name: 'express',         version: '4.17.1',  fixedIn: '4.18.2',  ecosystem: 'npm',    cve: 'CVE-2022-24999', cvss: 7.5,  severity: 'high',     license: 'MIT',   transitive: false, projects: ['api-gateway', 'notification-svc'] },
  { id: 9,  name: 'requests',        version: '2.27.0',  fixedIn: '2.28.0',  ecosystem: 'pip',    cve: 'CVE-2023-32681', cvss: 6.1,  severity: 'medium',   license: 'Apache', transitive: false, projects: ['auth-service', 'data-pipeline'] },
  { id: 10, name: 'cryptography',    version: '3.4.8',   fixedIn: '41.0.3',  ecosystem: 'pip',    cve: 'CVE-2023-38325', cvss: 7.5,  severity: 'high',     license: 'Apache', transitive: false, projects: ['auth-service'] },
  { id: 11, name: 'semver',          version: '7.3.7',   fixedIn: '7.5.2',   ecosystem: 'npm',    cve: 'CVE-2022-25883', cvss: 5.3,  severity: 'medium',   license: 'ISC',   transitive: true,  projects: ['api-gateway'] },
  { id: 12, name: 'tough-cookie',    version: '4.0.0',   fixedIn: '4.1.3',   ecosystem: 'npm',    cve: 'CVE-2023-26136', cvss: 6.5,  severity: 'medium',   license: 'BSD',   transitive: true,  projects: ['frontend-app'] },
]

const sevConfig: Record<string, { color: string; bg: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)' },
}

const ecoColors: Record<string, string> = {
  npm: '#CB3837', maven: '#C71A36', pip: '#3572A5', go: '#00ADD8',
}

const tabs = [
  { key: 'all',      label: 'All',      count: 12 },
  { key: 'critical', label: 'Critical', count: 4 },
  { key: 'high',     label: 'High',     count: 4 },
  { key: 'medium',   label: 'Medium',   count: 4 },
]

export default function SCAPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [scanning, setScanning] = useState(false)

  const filtered = dependencies.filter((d) => {
    if (activeTab === 'critical') return d.severity === 'critical'
    if (activeTab === 'high')     return d.severity === 'high'
    if (activeTab === 'medium')   return d.severity === 'medium'
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>SCA — Dependencies</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
            Export SBOM
          </button>
          <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
            Export CSV
          </button>
          <button
            onClick={() => { setScanning(true); setTimeout(() => setScanning(false), 3000) }}
            disabled={scanning}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {scanning ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Scanning...</> : '⟳ Re-scan'}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Zero-day banner */}
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(192,55,42,0.1)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <span style={{ color: '#FF6B6B', fontWeight: 500 }}>Log4Shell detected:</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Critical CVE-2021-44228 (CVSS 10.0) in log4j-core used by payment-ms.</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#FF6B6B', fontWeight: 500, whiteSpace: 'nowrap' }}>Patch immediately →</span>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Vulnerable', value: '12', color: '#F0F4FF', sub: 'across 287 deps' },
            { label: 'Critical CVEs',    value: '4',  color: '#FF6B6B', sub: '▲ 1 new this week' },
            { label: 'High CVEs',        value: '4',  color: '#FFB020', sub: 'No change' },
            { label: 'Auto-fixable',     value: '9',  color: '#00E576', sub: 'with npm update' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>{s.sub}</div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
            </div>
          ))}
        </div>

        {/* TABLE */}
        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '12px 14px', fontSize: 12, fontWeight: activeTab === t.key ? 500 : 400, color: activeTab === t.key ? '#F0F4FF' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? '#1B7FFF' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--body)' }}>
                {t.label}
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: activeTab === t.key ? 'rgba(27,127,255,0.2)' : 'rgba(255,255,255,0.07)', color: activeTab === t.key ? '#4D9FFF' : 'rgba(255,255,255,0.3)' }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 100px 100px 80px 1.5fr 80px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {['Package', 'Ecosystem', 'Version', 'Fix In', 'CVE', 'CVSS', 'Affected Projects', 'Severity'].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((dep, i) => {
            const sev = sevConfig[dep.severity]
            return (
              <div key={dep.id} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 100px 100px 80px 1.5fr 80px', padding: '11px 16px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4FF' }}>{dep.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                    {dep.transitive ? '↳ transitive' : 'direct'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${ecoColors[dep.ecosystem]}22`, color: ecoColors[dep.ecosystem] || '#aaa' }}>{dep.ecosystem}</span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#FF6B6B' }}>{dep.version}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#00E576' }}>{dep.fixedIn}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#4D9FFF' }}>{dep.cve}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: dep.cvss >= 9 ? '#FF6B6B' : dep.cvss >= 7 ? '#FFB020' : '#4D9FFF' }}>{dep.cvss}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {dep.projects.map((p) => (
                    <span key={p} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>{p}</span>
                  ))}
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color }}>{dep.severity}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
