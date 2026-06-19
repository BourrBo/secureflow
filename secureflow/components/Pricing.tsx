'use client'
const plans = [
  {
    name: 'Starter', price: '$0', period: '/mo', featured: false,
    desc: 'For individuals and small teams exploring AppSec.',
    cta: 'Get started free', ctaStyle: 'ghost',
    features: [
      { ok: true,  text: 'Up to 3 repositories' },
      { ok: true,  text: 'SAST scanning (Semgrep)' },
      { ok: true,  text: 'Secrets Detection' },
      { ok: true,  text: 'GitHub integration' },
      { ok: false, text: 'SCA & SBOM' },
      { ok: false, text: 'IaC Security' },
      { ok: false, text: 'AI Fix Engine' },
    ],
  },
  {
    name: 'Pro', price: '$49', period: '/mo per 10 repos', featured: true,
    desc: 'For growing engineering teams with active security needs.',
    cta: 'Start 14-day trial →', ctaStyle: 'primary',
    features: [
      { ok: true,  text: 'Unlimited repositories' },
      { ok: true,  text: 'All scan modules (SAST, SCA, Secrets, IaC)' },
      { ok: true,  text: 'SBOM generation (CycloneDX / SPDX)' },
      { ok: true,  text: 'Jira + Slack + Teams' },
      { ok: true,  text: 'OWASP Top 10 reporting' },
      { ok: true,  text: 'AI Fix Engine (50 fixes/mo)' },
      { ok: false, text: 'DAST / Container (Phase 3)' },
    ],
  },
  {
    name: 'Enterprise', price: 'Custom', period: '', featured: false,
    desc: 'For large orgs needing SSO, compliance, and dedicated support.',
    cta: 'Talk to sales →', ctaStyle: 'ghost',
    features: [
      { ok: true, text: 'Everything in Pro' },
      { ok: true, text: 'SAML 2.0 SSO + SCIM' },
      { ok: true, text: 'SOC2, ISO 27001, PCI DSS reports' },
      { ok: true, text: 'Unlimited AI fixes' },
      { ok: true, text: 'DAST + Container Scanning' },
      { ok: true, text: 'Dedicated CSM + SLA' },
      { ok: true, text: 'On-prem / self-hosted option' },
    ],
  },
]

export default function Pricing() {
  return (
    <section id="pricing" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          // Pricing
        </div>
        <h2 className="reveal" style={{ fontFamily: 'var(--font)', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16 }}>
          Simple, honest pricing.
        </h2>
        <p className="reveal" style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 520, lineHeight: 1.65, fontWeight: 300 }}>
          Start free. Scale as your team grows. No per-finding charges — ever.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 56, alignItems: 'start' }}>
          {plans.map((p, i) => (
            <div
              key={p.name}
              className={`reveal${i === 1 ? ' reveal-delay-1' : i === 2 ? ' reveal-delay-2' : ''}`}
              style={{
                background: p.featured ? 'var(--card2)' : 'var(--card)',
                border: `1px solid ${p.featured ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: 16, padding: 32, position: 'relative',
                boxShadow: p.featured ? '0 0 60px rgba(27,127,255,0.12)' : 'none',
              }}
            >
              {p.featured && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--blue)', color: '#fff', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  Most Popular
                </div>
              )}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontFamily: 'var(--font)', fontSize: p.price === 'Custom' ? 32 : 46, fontWeight: 800, letterSpacing: '-2px', color: 'var(--text)', lineHeight: 1 }}>
                {p.price}<span style={{ fontSize: 18, fontWeight: 400, color: 'var(--text2)', letterSpacing: 0 }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', margin: '10px 0 24px', lineHeight: 1.5 }}>{p.desc}</div>
              <a
                href="#"
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600,
                  padding: 12, borderRadius: 8, cursor: 'pointer', textDecoration: 'none',
                  marginBottom: 24,
                  background: p.ctaStyle === 'primary' ? 'var(--blue)' : 'transparent',
                  color: p.ctaStyle === 'primary' ? '#fff' : 'var(--text)',
                  border: p.ctaStyle === 'primary' ? 'none' : '1px solid var(--border)',
                  boxShadow: p.ctaStyle === 'primary' ? '0 0 20px rgba(27,127,255,0.25)' : 'none',
                }}
              >
                {p.cta}
              </a>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.features.map((f) => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: f.ok ? 'var(--text2)' : 'var(--text3)' }}>
                    <span style={{ color: f.ok ? 'var(--green)' : 'var(--text3)', flexShrink: 0, marginTop: 2, fontSize: 12 }}>{f.ok ? '✓' : '✗'}</span>
                    {f.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}