'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── Types matching your backend response ──
type BackendFinding = {
  title:       string
  severity:    string       // "WARNING", "ERROR", "INFO"
  file:        string
  line:        number
  description: string
  rule:        string
}

type Finding = {
  id:          number
  title:       string
  severity:    'critical' | 'high' | 'medium' | 'low'
  file:        string
  line:        number
  description: string
  rule:        string
  cwe:         string
  owasp:       string
  status:      string
}

// ── Map backend severity → SecureFlow severity ──
function mapSeverity(raw: string): Finding['severity'] {
  const s = raw?.toUpperCase()
  if (s === 'ERROR')   return 'critical'
  if (s === 'WARNING') return 'high'
  if (s === 'INFO')    return 'medium'
  return 'low'
}

// ── Try to extract CWE from rule ID ──
function extractCWE(rule: string): string {
  if (rule.includes('sql'))        return 'CWE-89'
  if (rule.includes('xss'))        return 'CWE-79'
  if (rule.includes('csrf'))       return 'CWE-352'
  if (rule.includes('hardcode'))   return 'CWE-798'
  if (rule.includes('path'))       return 'CWE-22'
  if (rule.includes('exec'))       return 'CWE-78'
  if (rule.includes('injection'))  return 'CWE-89'
  if (rule.includes('crypto'))     return 'CWE-327'
  if (rule.includes('auth'))       return 'CWE-287'
  return 'CWE-000'
}

// ── Try to extract OWASP from rule ID ──
function extractOWASP(rule: string): string {
  if (rule.includes('sql') || rule.includes('injection') || rule.includes('xss')) return 'A03:2021'
  if (rule.includes('csrf'))       return 'A01:2021'
  if (rule.includes('hardcode') || rule.includes('secret') || rule.includes('crypto')) return 'A02:2021'
  if (rule.includes('auth'))       return 'A07:2021'
  if (rule.includes('path'))       return 'A01:2021'
  if (rule.includes('exec'))       return 'A03:2021'
  return 'A05:2021'
}

// ── Severity config ──
const sevConfig = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)', label: 'Critical' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)',  label: 'High' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)', label: 'Medium' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)', label: 'Low' },
}

const BACKEND_URL = 'http://127.0.0.1:8000'

export default function SASTPage() {
  const [repoUrl, setRepoUrl]     = useState('https://github.com/pallets/flask')
  const [findings, setFindings]   = useState<Finding[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [scanning, setScanning]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [hasScanned, setHasScanned] = useState(false)
  const [selected, setSelected]   = useState<number[]>([])
  const [scanTime, setScanTime]   = useState<number | null>(null)

  // ── Scan mode: GitHub URL vs local zip upload ──
  const [scanMode, setScanMode]   = useState<'github' | 'local'>('github')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // ── Run scan (GitHub URL) ──
  const handleScan = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }

    setScanning(true)
    setError(null)
    setFindings([])
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

      // Your backend returns array directly: [ {...}, {...} ]
      const data: BackendFinding[] = await response.json()

      if (!Array.isArray(data)) {
        throw new Error('Backend did not return an array of findings')
      }

      // Normalize backend format → SecureFlow format
      const normalized: Finding[] = data.map((item, index) => ({
        id:          index + 1,
        title:       item.title       || 'Untitled Finding',
        severity:    mapSeverity(item.severity),
        file:        item.file        || 'unknown',
        line:        item.line        || 0,
        description: item.description || '',
        rule:        item.rule        || '',
        cwe:         extractCWE(item.rule?.toLowerCase() || ''),
        owasp:       extractOWASP(item.rule?.toLowerCase() || ''),
        status:      'open',
      }))

      setFindings(normalized)
      setHasScanned(true)
      setScanTime(Math.round((Date.now() - startTime) / 1000))

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setScanning(false)
    }
  }

  // ── Run scan (local zip upload) ──
  const handleScanLocal = async () => {
    if (!selectedFile) {
      setError('Please select a .zip file to upload')
      return
    }

    setScanning(true)
    setError(null)
    setFindings([])
    const startTime = Date.now()

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${BACKEND_URL}/api/sast/scan-local`, {
        method: 'POST',
        body: formData, // no Content-Type header — browser sets the multipart boundary automatically
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Backend error ${response.status}: ${errText}`)
      }

      const data: BackendFinding[] = await response.json()

      if (!Array.isArray(data)) {
        throw new Error('Backend did not return an array of findings')
      }

      const normalized: Finding[] = data.map((item, index) => ({
        id:          index + 1,
        title:       item.title       || 'Untitled Finding',
        severity:    mapSeverity(item.severity),
        file:        item.file        || 'unknown',
        line:        item.line        || 0,
        description: item.description || '',
        rule:        item.rule        || '',
        cwe:         extractCWE(item.rule?.toLowerCase() || ''),
        owasp:       extractOWASP(item.rule?.toLowerCase() || ''),
        status:      'open',
      }))

      setFindings(normalized)
      setHasScanned(true)
      setScanTime(Math.round((Date.now() - startTime) / 1000))

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setScanning(false)
    }
  }

  // ── Filter by tab ──
  const filtered = findings.filter((f) => {
    if (activeTab === 'critical') return f.severity === 'critical'
    if (activeTab === 'high')     return f.severity === 'high'
    if (activeTab === 'medium')   return f.severity === 'medium'
    if (activeTab === 'low')      return f.severity === 'low'
    return true
  })

  // ── Count per severity ──
  const counts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high:     findings.filter(f => f.severity === 'high').length,
    medium:   findings.filter(f => f.severity === 'medium').length,
    low:      findings.filter(f => f.severity === 'low').length,
  }

  const tabs = [
    { key: 'all',      label: 'All',      count: findings.length },
    { key: 'critical', label: 'Critical', count: counts.critical },
    { key: 'high',     label: 'High',     count: counts.high },
    { key: 'medium',   label: 'Medium',   count: counts.medium },
    { key: 'low',      label: 'Low',      count: counts.low },
  ]

  const toggleSelect = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  // Shorten long file paths for display
  const shortPath = (path: string) => {
    const parts = path.replace(/\\/g, '/').split('/')
    return parts.length > 3 ? '.../' + parts.slice(-3).join('/') : path
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* ── TOP BAR ── */}
      <div style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)', gap: 12 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>SAST Results</span>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden', flexShrink: 0 }}>
          {(['github', 'local'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setScanMode(mode); setError(null) }}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: scanMode === mode ? '#1B7FFF' : 'rgba(255,255,255,0.05)',
                color: scanMode === mode ? '#fff' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font)',
              }}
            >
              {mode === 'github' ? 'GitHub URL' : 'Upload Local'}
            </button>
          ))}
        </div>

        {/* GitHub URL input */}
        {scanMode === 'github' && (
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="https://github.com/owner/repo"
            style={{
              flex: 1,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#F0F4FF',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'var(--mono)',
            }}
          />
        )}

        {/* Local file picker */}
        {scanMode === 'local' && (
          <label
            htmlFor="sast-zip-upload"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 8px',
              borderRadius: 8,
              border: `1px solid ${selectedFile ? 'rgba(27,127,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
              background: 'rgba(255,255,255,0.05)',
              cursor: 'pointer',
              transition: 'border-color .15s',
            }}
            onMouseEnter={e => { if (!selectedFile) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
            onMouseLeave={e => { if (!selectedFile) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            {/* Hidden native input — label triggers it */}
            <input
              id="sast-zip-upload"
              type="file"
              accept=".zip"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />

            {/* Fake "button" half */}
            <span style={{
              flexShrink: 0,
              padding: '5px 12px',
              borderRadius: 6,
              background: 'rgba(27,127,255,0.15)',
              color: '#4D9FFF',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Choose .zip
            </span>

            {/* Filename or placeholder */}
            <span style={{
              fontSize: 12,
              color: selectedFile ? '#F0F4FF' : 'rgba(255,255,255,0.3)',
              fontFamily: 'var(--mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {selectedFile ? selectedFile.name : 'No file selected'}
            </span>

            {/* Size badge + clear button, only when a file is chosen */}
            {selectedFile && (
              <>
                <span style={{
                  flexShrink: 0,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'var(--mono)',
                }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedFile(null) }}
                  style={{
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#FF6B6B' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
                >
                  ✕
                </button>
              </>
            )}
          </label>
        )}

        {/* Scan button */}
        <button
          onClick={scanMode === 'github' ? handleScan : handleScanLocal}
          disabled={scanning}
          style={{
            padding: '9px 20px',
            borderRadius: 8,
            border: 'none',
            background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: scanning ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            boxShadow: scanning ? 'none' : '0 0 16px rgba(27,127,255,0.3)',
          }}
        >
          {scanning ? (
            <>
              <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Scanning...
            </>
          ) : (
            '⟳ Run SAST Scan'
          )}
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* ── Scanning banner ── */}
        {scanning && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(27,127,255,0.08)', border: '1px solid rgba(27,127,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(27,127,255,0.3)', borderTopColor: '#4D9FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <div>
              <span style={{ color: '#4D9FFF', fontWeight: 500 }}>Running Semgrep SAST scan...</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 10 }}>
                {scanMode === 'github' ? 'Cloning repo → Running Semgrep → Parsing results' : 'Extracting upload → Running Semgrep → Parsing results'}
              </span>
            </div>
          </div>
        )}

        {/* ── Error banner ── */}
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

        {/* ── Success banner ── */}
        {hasScanned && !scanning && !error && (
          <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(0,229,118,0.06)', border: '1px solid rgba(0,229,118,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ fontSize: 14 }}>✅</span>
            <span style={{ color: '#00E576', fontWeight: 500 }}>Scan complete!</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              Found {findings.length} findings in {scanTime}s — {scanMode === 'github' ? repoUrl.split('/').slice(-1)[0] : selectedFile?.name}
            </span>
          </div>
        )}

        {/* ── Empty state (before first scan) ── */}
        {!hasScanned && !scanning && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 8 }}>
              Ready to scan
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 400, lineHeight: 1.6, marginBottom: 24 }}>
              {scanMode === 'github' ? (
                <>Enter a GitHub repository URL above and click <strong style={{ color: '#4D9FFF' }}>Run SAST Scan</strong> to detect security vulnerabilities using Semgrep.</>
              ) : (
                <>Select a <strong style={{ color: '#4D9FFF' }}>.zip</strong> file of your project above and click <strong style={{ color: '#4D9FFF' }}>Run SAST Scan</strong> to detect security vulnerabilities using Semgrep.</>
              )}
            </div>
            {scanMode === 'github' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['https://github.com/pallets/flask', 'https://github.com/django/django', 'https://github.com/expressjs/express'].map(url => (
                  <button
                    key={url}
                    onClick={() => setRepoUrl(url)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)' }}
                  >
                    {url.replace('https://github.com/', '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STAT CARDS (show after scan) ── */}
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

            {/* ── Bulk actions ── */}
            {selected.length > 0 && (
              <div style={{ marginBottom: 12, padding: '10px 16px', background: 'rgba(27,127,255,0.08)', border: '1px solid rgba(27,127,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <span style={{ color: '#4D9FFF', fontWeight: 500 }}>{selected.length} selected</span>
                {['Assign', 'Create Jira', 'Mark Resolved', 'Suppress'].map(action => (
                  <button key={action} onClick={() => setSelected([])} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 11, cursor: 'pointer' }}>
                    {action}
                  </button>
                ))}
                <button onClick={() => setSelected([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            )}

            {/* ── FINDINGS TABLE ── */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>

              {/* Tabs */}
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

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 3fr 90px 2fr 80px 80px 50px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <div />
                {['Vulnerability', 'Severity', 'File · Line', 'CWE', 'OWASP', ''].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
                ))}
              </div>

              {/* No findings for this filter */}
              {filtered.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No {activeTab === 'all' ? '' : activeTab} findings found.
                </div>
              )}

              {/* Rows */}
              {filtered.map((f, i) => {
                const sev = sevConfig[f.severity]
                const isSelected = selected.includes(f.id)
                return (
                  <div key={f.id}
                    style={{ display: 'grid', gridTemplateColumns: '36px 3fr 90px 2fr 80px 80px 50px', padding: '11px 16px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isSelected ? 'rgba(27,127,255,0.06)' : 'transparent', transition: 'background .12s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Checkbox */}
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(f.id)}
                      style={{ accentColor: '#1B7FFF', cursor: 'pointer', width: 14, height: 14 }} />

                    {/* Title + rule */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF', marginBottom: 2 }}>{f.title}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.rule}</div>
                    </div>

                    {/* Severity */}
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color }}>
                      {sev.label}
                    </span>

                    {/* File:line */}
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#4D9FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={f.file}>
                      {shortPath(f.file)}:{f.line}
                    </div>

                    {/* CWE */}
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{f.cwe}</div>

                    {/* OWASP */}
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{f.owasp}</div>

                    {/* View */}
                    <Link href={`/dashboard/findings/${f.id}`}
                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(27,127,255,0.4)'; e.currentTarget.style.color = '#4D9FFF' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                    >
                      View →
                    </Link>
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