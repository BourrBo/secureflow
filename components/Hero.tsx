const terminalLines = [
  { type: 'cmd', content: 'secureflow scan --project api-gateway --all-modules' },
  { type: 'comment', content: '# Initializing SecureFlow v2.1.0 ···' },
  { type: 'ok', content: ' Connected to GitHub · repo: acme/api-gateway · branch: main' },
  { type: 'mixed', parts: [{ t: 'ok', c: '✓' }, { t: 'normal', c: ' SAST (Semgrep) ········· ' }, { t: 'crit', c: '8 Critical' }, { t: 'normal', c: ', ' }, { t: 'high', c: '14 High' }, { t: 'normal', c: ', 22 Medium' }] },
  { type: 'mixed', parts: [{ t: 'ok', c: '✓' }, { t: 'normal', c: ' SCA (OSV-Scanner) ······ ' }, { t: 'high', c: '3 CVEs found' }, { t: 'normal', c: ' · CVSS 9.1 in lodash@4.17.20' }] },
  { type: 'mixed', parts: [{ t: 'ok', c: '✓' }, { t: 'normal', c: ' Secrets (Gitleaks) ····· ' }, { t: 'crit', c: '2 AWS keys exposed' }, { t: 'normal', c: ' in commit history' }] },
  { type: 'mixed', parts: [{ t: 'ok', c: '✓' }, { t: 'normal', c: ' IaC (KICS) ············· ' }, { t: 'high', c: '5 misconfigurations' }, { t: 'normal', c: ' in terraform/main.tf' }] },
  { type: 'mixed', parts: [{ t: 'ok', c: '✓' }, { t: 'normal', c: ' Container (Trivy) ······ ' }, { t: 'green', c: 'Clean' }, { t: 'normal', c: ' — no vulnerabilities found' }] },
  { type: 'comment', content: '# ─────────────────────────────────────────' },
  { type: 'mixed', parts: [{ t: 'info', c: '→' }, { t: 'normal', c: ' Security score: ' }, { t: 'high', c: '64/100' }, { t: 'normal', c: ' · PR blocked · Jira tickets created' }] },
  { type: 'mixed', parts: [{ t: 'info', c: '→' }, { t: 'normal', c: ' Full report: ' }, { t: 'info', c: 'https://app.secureflow.io/r/ag-2025' }] },
]

const colorMap: Record<string, string> = {
  ok: '#00E576', crit: '#FF3B5C', high: '#FFB020',
  green: '#00E576', info: '#00D4FF', normal: '#8A9BC0', comment: '#3D5070',
}

export default function Hero() {
  return (
    <section
      style={{
        position: 'relative', padding: '160px 24px 120px',
        textAlign: 'center', overflow: 'hidden',
      }}
    >
      {/* Glow blobs */}
      <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 800, height: 600, background: 'radial-gradient(ellipse at center, rgba(27,127,255,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 200, left: '30%', width: 400, height: 400, background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Badge */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500,
            padding: '6px 14px', borderRadius: 20,
            border: '1px solid rgba(27,127,255,0.2)',
            background: 'rgba(27,127,255,0.08)', color: 'var(--cyan)',
            marginBottom: 28, letterSpacing: '0.5px',
          }}
        >
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', display: 'inline-block' }} />
          SAST · SCA · SECRETS · IAC · CONTAINER · DAST
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font)', fontSize: 'clamp(42px,6vw,78px)',
            fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px',
            color: 'var(--text)', marginBottom: 24,
          }}
        >
          Find Every Vulnerability.<br />
          <span className="gradient-text">Before They Do.</span>
        </h1>

        {/* Subheading */}
        <p
          style={{
            fontSize: 'clamp(16px,2vw,19px)', color: 'var(--text2)',
            maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.65, fontWeight: 300,
          }}
        >
          SecureFlow unifies six security scanning modules in one developer-first platform — so your team ships fast without leaving the door open.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a
            href="#"
            style={{
              fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600,
              padding: '14px 28px', borderRadius: 9, textDecoration: 'none',
              background: 'var(--blue)', color: '#fff', border: 'none',
              boxShadow: '0 0 40px rgba(27,127,255,0.35)',
            }}
          >
            Start scanning free →
          </a>
          <a
            href="#howitworks"
            style={{
              fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600,
              padding: '14px 28px', borderRadius: 9, textDecoration: 'none',
              background: 'transparent', color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            Watch 2-min demo
          </a>
        </div>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          No credit card · Free for up to 3 repos · SOC2 compliant
        </p>
      </div>

      {/* Terminal Card */}
      <div
        className="reveal"
        style={{
          maxWidth: 780, margin: '70px auto 0',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(27,127,255,0.08)',
          position: 'relative', zIndex: 1,
        }}
      >
        {/* Terminal title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', margin: '0 auto' }}>
            secureflow scan --project api-gateway --branch main
          </span>
        </div>

        {/* Terminal body */}
        <div style={{ padding: '20px 24px', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.9, textAlign: 'left' }}>
          {terminalLines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              {line.type === 'cmd' && (
                <>
                  <span style={{ color: 'var(--blue-lt)', flexShrink: 0 }}>$</span>
                  <span style={{ color: 'var(--text)' }}>{line.content}</span>
                </>
              )}
              {line.type === 'comment' && <span style={{ color: colorMap.comment }}>{line.content}</span>}
              {line.type === 'ok' && (
                <>
                  <span style={{ color: colorMap.ok }}>✓</span>
                  <span style={{ color: 'var(--text2)' }}>{line.content}</span>
                </>
              )}
              {line.type === 'mixed' && line.parts?.map((p, j) => (
                <span key={j} style={{ color: colorMap[p.t] }}>{p.c}</span>
              ))}
            </div>
          ))}
          {/* Cursor */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <span style={{ color: 'var(--blue-lt)' }}>$</span>
            <span className="blink" style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--blue)', verticalAlign: 'middle' }} />
          </div>
        </div>
      </div>
    </section>
  )
}
