'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ISO27001Badge, ExportReportButton, ViewStandardLink } from '@/components/dashboard/ISO27001'

// ── Shape coming back from POST /api/container/scan (models.finding.Finding) ──
type BackendFinding = {
  title:              string   // package name, e.g. "curl"
  severity:           string   // CRITICAL / HIGH / MEDIUM / LOW (already normalized, uppercase)
  file:               string   // image name, e.g. "nginx:latest"
  line:               number   // always 0 for container findings
  description:        string
  rule:               string   // CVE id, e.g. "CVE-2026-53615"
  cwe:                string
  owasp:              string
  scanner:            string   // "container"
  installed_version?: string | null
  fixed_version?:     string | null
  cvss?:              number | null
  ecosystem?:         string | null
  iso27001_control?:      string
  iso27001_control_name?: string
  iso27001_description?:  string
}

type Vuln = {
  id:               number
  pkg:              string
  ecosystem:        string
  installed:        string
  fixed:            string | null
  cve:              string
  cvss:             number | null
  severity:         'critical' | 'high' | 'medium' | 'low'
  iso27001Control:     string
  iso27001ControlName: string
  iso27001Description: string
}

function mapSeverity(raw: string): Vuln['severity'] {
  const s = raw?.toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high')     return 'high'
  if (s === 'medium')   return 'medium'
  return 'low'
}

const sevConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)',  label: 'CRITICAL' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)',  label: 'HIGH' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)', label: 'MEDIUM' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)', label: 'LOW' },
}

const BACKEND_URL = 'http://127.0.0.1:8000'

export default function ContainerPage() {
  const [imageName, setImageName]   = useState('nginx:latest')
  const [vulns, setVulns]           = useState<Vuln[]>([])
  const [activeTab, setActiveTab]   = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')
  const [search, setSearch]         = useState('')
  const [scanning, setScanning]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [hasScanned, setHasScanned] = useState(false)
  const [scanTime, setScanTime]     = useState<number | null>(null)

  const normalizeResponse = (data: BackendFinding[]): Vuln[] => {
    return data
      .filter((item) => item.scanner === 'container')
      .map((item, index) => ({
        id: index + 1,
        pkg: item.title || 'Unknown package',
        ecosystem: item.ecosystem || 'unknown',
        installed: item.installed_version || 'Unknown',
        fixed: item.fixed_version && item.fixed_version !== 'No fix available' ? item.fixed_version : null,
        cve: item.rule || 'N/A',
        cvss: item.cvss ?? null,
        severity: mapSeverity(item.severity),
        iso27001Control:     item.iso27001_control      || '8.8',
        iso27001ControlName: item.iso27001_control_name || 'Management of technical vulnerabilities',
        iso27001Description: item.iso27001_description  || 'Information about technical vulnerabilities of information systems in use shall be obtained, the organization\u2019s exposure to such vulnerabilities evaluated, and appropriate measures taken.',
      }))
  }

  const handleScan = async () => {
    if (!imageName.trim()) {
      setError('Please enter a container image name')
      return
    }
    setScanning(true)
    setError(null)
    setVulns([])
    const startTime = Date.now()

    try {
      const response = await fetch(`${BACKEND_URL}/api/container/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_name: imageName.trim() }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Backend error ${response.status}: ${errText}`)
      }

      const data: BackendFinding[] = await response.json()
      if (!Array.isArray(data)) {
        throw new Error('Backend did not return an array of findings')
      }

      setVulns(normalizeResponse(data))
      setHasScanned(true)
      setScanTime(Math.round((Date.now() - startTime) / 1000))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setScanning(false)
    }
  }

  const counts = {
    critical: vulns.filter(v => v.severity === 'critical').length,
    high:     vulns.filter(v => v.severity === 'high').length,
    medium:   vulns.filter(v => v.severity === 'medium').length,
    low:      vulns.filter(v => v.severity === 'low').length,
  }

  const tabs = [
    { key: 'all' as const,      label: 'All',      count: vulns.length },
    { key: 'critical' as const, label: 'Critical',  count: counts.critical },
    { key: 'high' as const,     label: 'High',      count: counts.high },
    { key: 'medium' as const,   label: 'Medium',    count: counts.medium },
    { key: 'low' as const,      label: 'Low',       count: counts.low },
  ]

  const filtered = vulns.filter((v) => {
    if (activeTab !== 'all' && v.severity !== activeTab) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return v.pkg.toLowerCase().includes(q) || v.cve.toLowerCase().includes(q) || v.ecosystem.toLowerCase().includes(q)
    }
    return true
  })

  const exportFindings = vulns.map(v => ({
    title: v.pkg, severity: v.severity, file: imageName, line: 0,
    description: `${v.pkg} ${v.installed} — ${v.cve}`,
    rule: v.cve, cwe: 'CWE-1104', owasp: 'A06:2021', scanner: 'container',
    iso27001_control: v.iso27001Control,
    iso27001_control_name: v.iso27001ControlName,
    iso27001_description: v.iso27001Description,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Container Scan</span>
        </div>

        <div style={{ flexShrink: 0 }}><ViewStandardLink /></div>
        <ExportReportButton
          findings={exportFindings}
          scanType="container"
          repoLabel={imageName}
        />

        <div style={{ flex: 1 }} />

        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            boxShadow: scanning ? 'none' : '0 0 16px rgba(27,127,255,0.3)',
          }}
        >
          {scanning ? (
            <>
              <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Scanning...
            </>
          ) : '⟳ Run scan'}
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        <div style={{ marginBottom: 16, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
          Scan Docker and OCI images using Trivy.
        </div>

        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF', marginBottom: 10 }}>Container Image</div>
          <input
            value={imageName}
            onChange={e => setImageName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="nginx:latest"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: '#F0F4FF', fontSize: 13, outline: 'none',
              fontFamily: 'var(--mono)', boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
            Examples: nginx:latest, ubuntu:22.04, python:3.13
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{
              marginTop: 14, padding: '10px 20px', borderRadius: 8, border: 'none',
              background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
            }}
          >
            {scanning ? 'Scanning...' : 'Run Container Scan'}
          </button>
        </div>

        {scanning && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(27,127,255,0.08)', border: '1px solid rgba(27,127,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(27,127,255,0.3)', borderTopColor: '#4D9FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span style={{ color: '#4D9FFF', fontWeight: 500 }}>Scanning image with Trivy...</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Pulling image → scanning layers → parsing CVEs</span>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(192,55,42,0.08)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>❌</span>
            <div>
              <div style={{ color: '#FF6B6B', fontWeight: 500, marginBottom: 4 }}>Scan failed</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--mono)' }}>{error}</div>
            </div>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {hasScanned && !scanning && !error && (
          <div style={{ marginBottom: 16, padding: '10px 16px', background: counts.critical > 0 ? 'rgba(192,55,42,0.1)' : 'rgba(0,229,118,0.06)', border: `1px solid ${counts.critical > 0 ? 'rgba(192,55,42,0.25)' : 'rgba(0,229,118,0.2)'}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ fontSize: 14 }}>{counts.critical > 0 ? '🚨' : '✅'}</span>
            <span style={{ color: counts.critical > 0 ? '#FF6B6B' : '#00E576', fontWeight: 500 }}>
              {vulns.length === 0 ? 'No vulnerabilities found' : 'Scan complete!'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              {vulns.length === 0 ? `Scanned ${imageName} in ${scanTime}s` : `Found ${vulns.length} vulnerabilit${vulns.length === 1 ? 'y' : 'ies'} in ${imageName} in ${scanTime}s`}
            </span>
          </div>
        )}

        {!hasScanned && !scanning && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🐳</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 8 }}>
              Ready to scan a container image
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 440, lineHeight: 1.6 }}>
              Enter an image tag above and click <strong style={{ color: '#4D9FFF' }}>Run Container Scan</strong> to check it for known CVEs using Trivy.
            </div>
          </div>
        )}

        {hasScanned && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Critical', value: counts.critical, color: '#FF6B6B' },
                { label: 'High',     value: counts.high,     color: '#FFB020' },
                { label: 'Medium',   value: counts.medium,   color: '#4D9FFF' },
                { label: 'Low',      value: counts.low,      color: 'rgba(255,255,255,0.4)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px' }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search package, CVE, ecosystem..."
                  style={{
                    flex: 1, padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)', color: '#F0F4FF', fontSize: 12, outline: 'none',
                    fontFamily: 'var(--mono)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{ padding: '12px 14px', fontSize: 12, fontWeight: activeTab === t.key ? 500 : 400, color: activeTab === t.key ? '#F0F4FF' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? '#1B7FFF' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--body)' }}>
                    {t.label}
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: activeTab === t.key ? 'rgba(27,127,255,0.2)' : 'rgba(255,255,255,0.07)', color: activeTab === t.key ? '#4D9FFF' : 'rgba(255,255,255,0.3)' }}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 90px 1.1fr 1.1fr 1.1fr 70px 90px 90px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Package', 'Ecosystem', 'Installed', 'Fixed', 'CVE', 'CVSS', 'Severity', 'ISO 27001'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No {activeTab === 'all' ? '' : activeTab} findings.
                </div>
              )}

              {filtered.map((v, i) => {
                const sev = sevConfig[v.severity]
                return (
                  <div key={v.id}
                    style={{ display: 'grid', gridTemplateColumns: '1.3fr 90px 1.1fr 1.1fr 1.1fr 70px 90px 90px', padding: '11px 16px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{v.pkg}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{v.ecosystem}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.6)' }}>{v.installed}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: v.fixed ? '#00E576' : 'rgba(255,255,255,0.3)' }}>
                      {v.fixed || 'No fix available'}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#4D9FFF' }}>{v.cve}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: v.cvss == null ? 'rgba(255,255,255,0.3)' : v.cvss >= 9 ? '#FF6B6B' : v.cvss >= 7 ? '#FFB020' : '#4D9FFF' }}>
                      {v.cvss != null ? v.cvss.toFixed(1) : '—'}
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color }}>
                        {sev.label}
                      </span>
                    </div>
                    <div>
                      <ISO27001Badge info={{ control: v.iso27001Control, controlName: v.iso27001ControlName, description: v.iso27001Description }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
