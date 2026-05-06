'use client'
const features = [
  {
    icon: '⬡', iconBg: 'rgba(27,127,255,0.12)',
    name: 'SAST — Static Analysis',
    desc: 'Deep code scanning powered by Semgrep & Horusec. Detects injection, XSS, auth flaws, and 500+ vulnerability patterns across 20+ languages.',
    tag: '● Live — Phase 1', tagColor: '#00E576', tagBg: 'rgba(0,229,118,0.1)', tagBorder: 'rgba(0,229,118,0.2)',
  },
  {
    icon: '◉', iconBg: 'rgba(0,229,118,0.1)',
    name: 'SCA — Dependency Scanning',
    desc: 'Auto-detect vulnerable open-source packages via OSV-Scanner. CVSS + EPSS scoring, auto-SBOM generation in CycloneDX and SPDX formats.',
    tag: '● Live — Phase 2', tagColor: '#00E576', tagBg: 'rgba(0,229,118,0.1)', tagBorder: 'rgba(0,229,118,0.2)',
  },
  {
    icon: '◈', iconBg: 'rgba(255,176,32,0.1)',
    name: 'Secrets Detection',
    desc: '800+ regex patterns via Gitleaks. Detects AWS keys, GitHub tokens, DB passwords — even in commit history. Real-time alerts before merge.',
    tag: '● Live — Phase 2', tagColor: '#00E576', tagBg: 'rgba(0,229,118,0.1)', tagBorder: 'rgba(0,229,118,0.2)',
  },
  {
    icon: '◫', iconBg: 'rgba(0,212,255,0.08)',
    name: 'IaC Security',
    desc: 'Scan Terraform, Helm, Kubernetes manifests, and CloudFormation with KICS. Catch misconfigurations before infrastructure is provisioned.',
    tag: '● Live — Phase 2', tagColor: '#00E576', tagBg: 'rgba(0,229,118,0.1)', tagBorder: 'rgba(0,229,118,0.2)',
  },
  {
    icon: '⬟', iconBg: 'rgba(255,59,92,0.1)',
    name: 'Container Scanning',
    desc: 'Trivy-powered image scanning for Docker and Kubernetes. Detects OS package CVEs, misconfigurations, and secrets baked into images.',
    tag: '⬡ Phase 3', tagColor: '#4D9FFF', tagBg: 'rgba(27,127,255,0.1)', tagBorder: 'rgba(27,127,255,0.2)',
  },
  {
    icon: '✦', iconBg: 'rgba(27,127,255,0.08)',
    name: 'AI Fix Engine',
    desc: 'One-click remediation powered by Claude AI. Understands your codebase context and generates accurate, PR-ready fixes — not just suggestions.',
    tag: '✦ Phase 5 · AI', tagColor: '#00D4FF', tagBg: 'rgba(0,212,255,0.1)', tagBorder: 'rgba(0,212,255,0.2)',
  },
]

export default function Features() {
  return (
    <section id="features" style={{ padding: '100px 24px', position: 'relative' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div className="reveal" style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500, color: 'var(--cyan)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          // Security Modules
        </div>
        <h2 className="reveal" style={{ fontFamily: 'var(--font)', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16 }}>
          Every Attack Surface.<br />One Platform.
        </h2>
        <p className="reveal" style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 520, lineHeight: 1.65, fontWeight: 300 }}>
          From your first line of code to production deployment — SecureFlow has every layer covered.
        </p>

        {/* Grid */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
            gap: 1, background: 'var(--border)',
            border: '1px solid var(--border)', borderRadius: 16,
            overflow: 'hidden', marginTop: 56,
          }}
        >
          {features.map((f, i) => (
            <div
              key={f.name}
              className={`reveal${i % 3 === 1 ? ' reveal-delay-1' : i % 3 === 2 ? ' reveal-delay-2' : ''}`}
              style={{ background: 'var(--bg2)', padding: 32, transition: 'background .2s', cursor: 'default' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: f.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 20 }}>
                {f.icon}
              </div>
              <div style={{ fontFamily: 'var(--font)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{f.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>{f.desc}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, marginTop: 14, background: f.tagBg, color: f.tagColor, border: `1px solid ${f.tagBorder}` }}>
                {f.tag}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}