'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── Shape coming back from the backend (shared Finding model — SAST + SCA mixed) ──
type BackendFinding = {
  title:              string
  severity:           string   // Trivy: CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN
  file:               string
  line:               number
  description:        string
  rule:               string   // CVE-... / GHSA-... for SCA findings
  cwe:                string
  owasp:              string
  scanner:            string   // "semgrep" | "trivy" — we only keep "trivy" on this page
  installed_version?: string | null
  fixed_version?:     string | null
  cvss?:              number | null
  ecosystem?:         string | null
}

type Dependency = {
  id:                number
  name:              string
  severity:          'critical' | 'high' | 'medium' | 'low'
  installedVersion:  string
  fixedVersion:      string
  cve:               string
  cvss:              number | null
  ecosystem:         string
  file:              string
  description:       string
  cwe:               string
}

// ── Map Trivy's severity scale → SecureFlow's display scale ──
function mapSeverity(raw: string): Dependency['severity'] {
  const s = raw?.toUpperCase()
  if (s === 'CRITICAL') return 'critical'
  if (s === 'HIGH')     return 'high'
  if (s === 'MEDIUM')   return 'medium'
  return 'low' // LOW or UNKNOWN
}

const sevConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)', label: 'Critical' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)',  label: 'High' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)', label: 'Medium' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)', label: 'Low' },
}

const ecoColors: Record<string, string> = {
  npm: '#CB3837', maven: '#C71A36', pip: '#3572A5', go: '#00ADD8', gomod: '#00ADD8',
}

const BACKEND_URL = 'http://127.0.0.1:8000'

export default function SCAPage() {
  const [repoUrl, setRepoUrl]         = useState('https://github.com/pallets/flask')
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [activeTab, setActiveTab]     = useState('all')
  const [scanning, setScanning]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [hasScanned, setHasScanned]   = useState(false)
  const [scanTime, setScanTime]       = useState<number | null>(null)

  const [scanMode, setScanMode]       = useState<'github' | 'local'>('github')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // ── Shared normalize step: takes the full mixed Finding[] response and keeps only Trivy/SCA ones ──
  const normalizeResponse = (data: BackendFinding[]): Dependency[] => {
    return data
      .filter((item) => item.scanner === 'trivy')
      .map((item, index) => ({
        id: index + 1,
        name: item.title || 'Unknown Package',
        severity: mapSeverity(item.severity),
        installedVersion: item.installed_version || '—',
        fixedVersion: item.fixed_version || 'No fix available',
        cve: item.rule || '—',
        cvss: item.cvss ?? null,
        ecosystem: item.ecosystem || 'unknown',
        file: item.file || 'unknown',
        description: item.description || '',
        cwe: item.cwe || 'CWE-000',
      }))
  }

  const handleScan = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }
    setScanning(true)
    setError(null)
    setDependencies([])
    const startTime = Date.now()

    try {
      const response = await fetch(`${BACKEND_URL}/api/sast/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl.trim() }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Backend error ${response.status}: ${errText}`)
      }

      const data: BackendFinding[] = await response.json()
      if (!Array.isArray(data)) {
        throw new Error('Backend did not return an array of findings')
      }

      setDependencies(normalizeResponse(data))
      setHasScanned(true)
      setScanTime(Math.round((Date.now() - startTime) / 1000))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setScanning(false)
    }
  }

  const handleScanLocal = async () => {
    if (!selectedFile) {
      setError('Please select a .zip file to upload')
      return
    }
    setScanning(true)
    setError(null)
    setDependencies([])
    const startTime = Date.now()

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${BACKEND_URL}/api/sast/scan-local`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Backend error ${response.status}: ${errText}`)
      }

      const data: BackendFinding[] = await response.json()
      if (!Array.isArray(data)) {
        throw new Error('Backend did not return an array of findings')
      }

      setDependencies(normalizeResponse(data))
      setHasScanned(true)
      setScanTime(Math.round((Date.now() - startTime) / 1000))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setScanning(false)
    }
  }

  const filtered = dependencies.filter((d) => {
    if (activeTab === 'critical') return d.severity === 'critical'
    if (activeTab === 'high')     return d.severity === 'high'
    if (activeTab === 'medium')   return d.severity === 'medium'
    if (activeTab === 'low')      return d.severity === 'low'
    return true
  })

  const counts = {
    critical: dependencies.filter(d => d.severity === 'critical').length,
    high:     dependencies.filter(d => d.severity === 'high').length,
    medium:   dependencies.filter(d => d.severity === 'medium').length,
    low:      dependencies.filter(d => d.severity === 'low').length,
  }

  const tabs = [
    { key: 'all',      label: 'All',      count: dependencies.length },
    { key: 'critical', label: 'Critical', count: counts.critical },
    { key: 'high',     label: 'High',     count: counts.high },
    { key: 'medium',   label: 'Medium',   count: counts.medium },
    { key: 'low',      label: 'Low',      count: counts.low },
  ]

  const uniquePackages = new Set(dependencies.map(d => d.name)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)', gap: 12 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>SCA Results</span>
        </div>

        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden', flexShrink: 0 }}>
          {(['github', 'local'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setScanMode(mode); setError(null) }}
              style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: scanMode === mode ? '#1B7FFF' : 'rgba(255,255,255,0.05)',
                color: scanMode === mode ? '#fff' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font)',
              }}
            >
              {mode === 'github' ? 'GitHub URL' : 'Upload Local'}
            </button>
          ))}
        </div>

        {scanMode === 'github' && (
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="https://github.com/owner/repo"
            style={{
              flex: 1, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: '#F0F4FF', fontSize: 13, outline: 'none',
              fontFamily: 'var(--mono)',
            }}
          />
        )}

        {scanMode === 'local' && (
          <label
            htmlFor="sca-zip-upload"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8,
              border: `1px solid ${selectedFile ? 'rgba(27,127,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
              background: 'rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'border-color .15s',
            }}
          >
            <input
              id="sca-zip-upload"
              type="file"
              accept=".zip"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
            <span style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 6, background: 'rgba(27,127,255,0.15)',
              color: '#4D9FFF', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Choose .zip
            </span>
            <span style={{
              fontSize: 12, color: selectedFile ? '#F0F4FF' : 'rgba(255,255,255,0.3)', fontFamily: 'var(--mono)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {selectedFile ? selectedFile.name : 'No file selected'}
            </span>
            {selectedFile && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedFile(null) }}
                style={{ flexShrink: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
              >
                ✕
              </button>
            )}
          </label>
        )}

        <button
          onClick={scanMode === 'github' ? handleScan : handleScanLocal}
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
          ) : '⟳ Run SCA Scan'}
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {scanning && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(27,127,255,0.08)', border: '1px solid rgba(27,127,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(27,127,255,0.3)', borderTopColor: '#4D9FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <div>
              <span style={{ color: '#4D9FFF', fontWeight: 500 }}>Running Trivy SCA scan...</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 10 }}>
                {scanMode === 'github' ? 'Cloning repo → Scanning dependency manifests → Parsing CVEs' : 'Extracting upload → Scanning dependency manifests → Parsing CVEs'}
              </span>
            </div>
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
          <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(0,229,118,0.06)', border: '1px solid rgba(0,229,118,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ fontSize: 14 }}>✅</span>
            <span style={{ color: '#00E576', fontWeight: 500 }}>Scan complete!</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              Found {dependencies.length} vulnerable dependenc{dependencies.length === 1 ? 'y' : 'ies'} across {uniquePackages} package{uniquePackages === 1 ? '' : 's'} in {scanTime}s
            </span>
          </div>
        )}

        {!hasScanned && !scanning && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 8 }}>
              Ready to scan dependencies
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 420, lineHeight: 1.6 }}>
              {scanMode === 'github' ? (
                <>Enter a GitHub repository URL above and click <strong style={{ color: '#4D9FFF' }}>Run SCA Scan</strong> to check dependency manifests (package-lock.json, requirements.txt, go.mod, etc.) for known CVEs using Trivy.</>
              ) : (
                <>Select a <strong style={{ color: '#4D9FFF' }}>.zip</strong> file and click <strong style={{ color: '#4D9FFF' }}>Run SCA Scan</strong> to check its dependencies for known CVEs using Trivy.</>
              )}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 90px 100px 100px 1.3fr 70px 80px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Package', 'Ecosystem', 'Installed', 'Fix In', 'CVE', 'CVSS', 'Severity'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No {activeTab === 'all' ? '' : activeTab} vulnerable dependencies found.
                </div>
              )}

              {filtered.map((dep, i) => {
                const sev = sevConfig[dep.severity]
                return (
                  <div key={dep.id}
                    title={dep.description}
                    style={{ display: 'grid', gridTemplateColumns: '1.6fr 90px 100px 100px 1.3fr 70px 80px', padding: '11px 16px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4FF' }}>{dep.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dep.cwe}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${ecoColors[dep.ecosystem] || '#888'}22`, color: ecoColors[dep.ecosystem] || '#aaa' }}>
                        {dep.ecosystem}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#FF6B6B' }}>{dep.installedVersion}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#00E576', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep.fixedVersion}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#4D9FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep.cve}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: !dep.cvss ? 'rgba(255,255,255,0.3)' : dep.cvss >= 9 ? '#FF6B6B' : dep.cvss >= 7 ? '#FFB020' : '#4D9FFF' }}>
                      {dep.cvss ?? 'N/A'}
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color }}>
                        {sev.label}
                      </span>
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
