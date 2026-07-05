'use client'
import { useState } from 'react'

export type ISO27001Info = {
  control: string        // e.g. "8.28"
  controlName: string    // e.g. "Secure coding"
  description: string    // full Annex A control text
}

const BACKEND_URL = 'http://127.0.0.1:8000'

// ── Calls the backend to build an ISO/IEC 27001-styled PDF report and downloads it ──
export async function exportISOReport(
  findings: any[],
  scanType: 'sast' | 'sca' | 'iac' | 'secrets' | 'all',
  repoLabel: string
) {
  const response = await fetch(`${BACKEND_URL}/api/reports/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ findings, scan_type: scanType, repo_label: repoLabel }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Report generation failed: ${response.status} — ${text}`)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `secureflow_${scanType}_iso27001_report.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// ── Button that triggers the export above, with a loading state ──
export function ExportReportButton({
  findings, scanType, repoLabel,
}: {
  findings: any[]
  scanType: 'sast' | 'sca' | 'iac' | 'secrets' | 'all'
  repoLabel: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (!findings.length || busy) return
    setBusy(true)
    setError(null)
    try {
      await exportISOReport(findings, scanType, repoLabel)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={handleClick}
        disabled={!findings.length || busy}
        title={findings.length ? 'Export findings as an ISO/IEC 27001-formatted PDF report' : 'Run a scan first'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, padding: '7px 12px', borderRadius: 8,
          border: '1px solid rgba(77,159,255,0.3)',
          background: !findings.length ? 'rgba(255,255,255,0.04)' : 'rgba(27,127,255,0.12)',
          color: !findings.length ? 'rgba(255,255,255,0.3)' : '#4D9FFF',
          cursor: !findings.length || busy ? 'not-allowed' : 'pointer',
          fontWeight: 500, whiteSpace: 'nowrap',
        }}
      >
        {busy ? (
          <>
            <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(77,159,255,0.3)', borderTopColor: '#4D9FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Generating…
          </>
        ) : (
          <>⬇ Export ISO Report</>
        )}
      </button>
      {error && (
        <div style={{ position: 'absolute', top: '110%', left: 0, fontSize: 10, color: '#FF6B6B', whiteSpace: 'nowrap', background: '#0D1B2E', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(192,55,42,0.3)', zIndex: 10 }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── Small inline badge for table rows — click opens the full control card ──
export function ISO27001Badge({ info }: { info: ISO27001Info }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="View ISO/IEC 27001 Annex A control"
        style={{
          fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
          padding: '2px 7px', borderRadius: 5,
          background: 'rgba(0,229,118,0.10)', border: '1px solid rgba(0,229,118,0.25)',
          color: '#00E576', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        A.{info.control}
      </button>

      {open && <ISO27001Modal info={info} onClose={() => setOpen(false)} />}
    </>
  )
}

// ── Full-detail card, formatted like Table A.1 in the ISO/IEC 27001:2022 standard ──
export function ISO27001Modal({ info, onClose }: { info: ISO27001Info; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0D1B2E', border: '1px solid rgba(0,229,118,0.25)',
          borderRadius: 14, maxWidth: 560, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}
      >
        {/* Header — mirrors the "Table A.1" layout from Annex A */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(0,229,118,0.7)', marginBottom: 4 }}>
              ISO/IEC 27001:2022 — Annex A
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>
              {info.control} &nbsp;{info.controlName}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body — Control text, same wording as the printed standard */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
            Control
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(240,244,255,0.85)' }}>
            {info.description}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Table A.1 — Information security controls</span>
          <a
            href="/docs/ISO_IEC_27001_2022.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: '#4D9FFF', textDecoration: 'none' }}
          >
            Open full standard (PDF) →
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Page-level link to the full standard document — dropped into each scanner page's header ──
export function ViewStandardLink() {
  return (
    <a
      href="/docs/ISO_IEC_27001_2022.pdf"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, padding: '7px 12px', borderRadius: 8,
        border: '1px solid rgba(0,229,118,0.25)', background: 'rgba(0,229,118,0.08)',
        color: '#00E576', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap',
      }}
    >
      📄 ISO/IEC 27001:2022 (PDF)
    </a>
  )
}
