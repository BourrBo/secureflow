'use client'
const steps = [
  { num: '01', name: 'Connect your repositories', desc: 'Link GitHub, GitLab, Bitbucket or Azure DevOps in one click. SecureFlow auto-discovers all repos in your org within seconds.' },
  { num: '02', name: 'Trigger scan on every PR', desc: 'CI/CD plugin runs all enabled scan modules automatically on push or pull request. No developer workflow changes needed.' },
  { num: '03', name: 'Review prioritized findings', desc: 'CVSS + EPSS scoring surfaces the riskiest issues first. Filter by severity, CWE category, file, or assignee in one unified dashboard.' },
  { num: '04', name: 'Fix with AI or triage', desc: 'Get AI-generated fixes, create Jira tickets in one click, or suppress false positives — all without leaving the SecureFlow interface.' },
]

const pipeline = [
  { icon: '⬡', label: 'SAST — Semgrep', sub: 'routes/user.js · 142 files', status: '8 Critical', statusColor: '#FF3B5C', statusBg: 'rgba(255,59,92,0.1)', active: true },
  { icon: '◉', label: 'SCA — OSV-Scanner', sub: 'package.json · 287 deps', status: '3 CVEs', statusColor: '#FF3B5C', statusBg: 'rgba(255,59,92,0.1)', active: true },
  { icon: '◈', label: 'Secrets — Gitleaks', sub: 'Full history scan', status: '2 Exposed', statusColor: '#FF3B5C', statusBg: 'rgba(255,59,92,0.1)', active: true },
  { icon: '◫', label: 'IaC — KICS', sub: 'terraform/ · 14 files', status: 'Clean', statusColor: '#00E576', statusBg: 'rgba(0,229,118,0.1)', active: false },
  { icon: '🔒', label: 'PR Gate — Policy Check', sub: 'Threshold: Critical = block', status: 'PR Blocked', statusColor: '#FF3B5C', statusBg: 'rgba(255,59,92,0.1)', active: false },
  { icon: '🎫', label: 'Jira Auto-ticket', sub: 'APPSEC-88, APPSEC-89', status: 'Created', statusColor: '#00E576', statusBg: 'rgba(0,229,118,0.1)', active: false },
]

export default function HowItWorks() {
  return (
    <section id="howitworks" style={{ padding: '100px 24px', background: 'var(--bg2)', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div className="reveal" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          // How It Works
        </div>
        <h2 className="reveal" style={{ fontFamily: 'var(--font)', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
          Connect. Scan. Fix.<br />Ship with Confidence.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center', marginTop: 60 }}>

          {/* Steps */}
          <div className="reveal" style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((s, i) => (
              <div key={s.num} style={{ display: 'flex', gap: 20, padding: '24px 0', borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--card2)', border: '1px solid rgba(27,127,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500, color: 'var(--blue-lt)', flexShrink: 0 }}>
                  {s.num}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline visual */}
          <div className="reveal reveal-delay-1" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
              CI/CD Pipeline — Live Run
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pipeline.map((p, i) => (
                <div key={p.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: p.active ? 'rgba(27,127,255,0.06)' : 'var(--bg3)', border: `1px solid ${p.active ? 'rgba(27,127,255,0.2)' : 'var(--border)'}` }}>
                    <span style={{ fontSize: 14, width: 24, textAlign: 'center', flexShrink: 0 }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.sub}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: p.statusBg, color: p.statusColor }}>
                      {p.status}
                    </div>
                  </div>
                  {i < pipeline.length - 1 && (
                    <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 11, padding: '2px 0' }}>↓</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,59,92,0.07)', border: '1px solid rgba(255,59,92,0.15)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--mono)', color: '#FF3B5C' }}>
              ✖ Merge blocked — 8 critical findings must be resolved
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}