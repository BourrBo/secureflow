'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const plans = [
  { id: 'starter', label: 'Starter', desc: 'Free · 3 repos', icon: '🚀' },
  { id: 'pro',     label: 'Pro',     desc: '$49/mo · Unlimited', icon: '⚡' },
  { id: 'enterprise', label: 'Enterprise', desc: 'Custom · SSO', icon: '🏢' },
]

export default function SignupPage() {
  const [step, setStep] = useState(1)
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', role: '' })

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setLoading(true)
    setTimeout(() => { setLoading(false); router.push('/dashboard') }, 1500)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', fontFamily: 'var(--body)',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '60px 80px', position: 'relative', zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ width: '100%', maxWidth: 420, marginBottom: 40 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, background: 'var(--blue)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 800, color: '#fff' }}>SF</div>
            <span style={{ fontFamily: 'var(--font)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              Secure<span style={{ color: 'var(--blue)' }}>Flow</span>
            </span>
          </Link>
        </div>

        {/* Step indicator */}
        <div style={{ width: '100%', maxWidth: 420, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 0 }}>
          {['Your details', 'Choose plan'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)',
                  background: step > i + 1 ? 'var(--green)' : step === i + 1 ? 'var(--blue)' : 'var(--card2)',
                  color: step >= i + 1 ? '#fff' : 'var(--text3)',
                  border: `1px solid ${step === i + 1 ? 'var(--blue)' : step > i + 1 ? 'var(--green)' : 'var(--border)'}`,
                  transition: 'all .3s',
                }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, color: step === i + 1 ? 'var(--text)' : 'var(--text3)', fontWeight: step === i + 1 ? 500 : 400 }}>{label}</span>
              </div>
              {i < 1 && <div style={{ flex: 1, height: 1, background: step > 1 ? 'var(--blue)' : 'var(--border)', margin: '0 12px', transition: 'background .3s' }} />}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div style={{
          width: '100%', maxWidth: 420,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 36,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>

          {step === 1 ? (
            <>
              <h1 style={{ fontFamily: 'var(--font)', fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>
                Create your account
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>
                Start scanning for free — no credit card required
              </p>

              {/* SSO */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                {[{ icon: '🐙', label: 'GitHub' }, { icon: '🔷', label: 'Google' }].map((btn) => (
                  <button key={btn.label} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--bg3)',
                    color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--body)', transition: 'all .15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(27,127,255,0.3)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                  >
                    <span>{btn.icon}</span> Continue with {btn.label}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>or with email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  {[
                    { key: 'name', label: 'Full name', placeholder: 'Rahul Kumar', type: 'text' },
                    { key: 'company', label: 'Company', placeholder: 'Acme Corp', type: 'text' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 5 }}>{f.label}</label>
                      <input
                        type={f.type} placeholder={f.placeholder} required
                        value={form[f.key as keyof typeof form]}
                        onChange={(e) => update(f.key, e.target.value)}
                        style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--body)' }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--blue)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      />
                    </div>
                  ))}
                </div>

                {[
                  { key: 'email', label: 'Work email', placeholder: 'you@company.com', type: 'email' },
                  { key: 'password', label: 'Password', placeholder: '8+ characters', type: 'password' },
                ].map((f) => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type} placeholder={f.placeholder} required
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => update(f.key, e.target.value)}
                      style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--body)' }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--blue)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                    />
                    {f.key === 'password' && form.password.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        {[1, 2, 3, 4].map((n) => (
                          <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: form.password.length >= n * 2 ? (form.password.length >= 8 ? 'var(--green)' : 'var(--amber)') : 'var(--border)', transition: 'background .2s' }} />
                        ))}
                        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4, whiteSpace: 'nowrap' }}>
                          {form.password.length < 4 ? 'Weak' : form.password.length < 8 ? 'Fair' : 'Strong'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 5 }}>Your role</label>
                  <select
                    value={form.role} onChange={(e) => update('role', e.target.value)}
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: form.role ? 'var(--text)' : 'var(--text3)', fontSize: 13, outline: 'none', fontFamily: 'var(--body)' }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--blue)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                  >
                    <option value="" disabled>Select your role</option>
                    <option value="appsec">AppSec Engineer</option>
                    <option value="dev">Developer</option>
                    <option value="lead">Engineering Lead</option>
                    <option value="cto">CTO / VP Engineering</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <button type="submit" style={{
                  width: '100%', padding: 12, borderRadius: 8,
                  background: 'var(--blue)', color: '#fff', border: 'none',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font)', boxShadow: '0 0 24px rgba(27,127,255,0.3)',
                }}>
                  Continue →
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 20 }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
              </p>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.6 }}>
                By signing up you agree to our{' '}
                <a href="#" style={{ color: 'var(--text2)', textDecoration: 'none' }}>Terms</a>{' '}and{' '}
                <a href="#" style={{ color: 'var(--text2)', textDecoration: 'none' }}>Privacy Policy</a>
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'var(--font)', fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>
                Choose your plan
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
                You can upgrade or downgrade anytime
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {plans.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    style={{
                      padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${selectedPlan === p.id ? 'var(--blue)' : 'var(--border)'}`,
                      background: selectedPlan === p.id ? 'rgba(27,127,255,0.08)' : 'var(--bg3)',
                      display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: selectedPlan === p.id ? 'rgba(27,127,255,0.15)' : 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {p.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{p.desc}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selectedPlan === p.id ? 'var(--blue)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedPlan === p.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)' }} />}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  width: '100%', padding: 12, borderRadius: 8,
                  background: loading ? 'rgba(27,127,255,0.6)' : 'var(--blue)',
                  color: '#fff', border: 'none', fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
                  boxShadow: '0 0 24px rgba(27,127,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? 'Creating account...' : `Start with ${plans.find(p => p.id === selectedPlan)?.label} →`}
              </button>

              <button onClick={() => setStep(1)} style={{ width: '100%', padding: 10, borderRadius: 8, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--body)', marginTop: 10 }}>
                ← Back
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: 1, background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 80px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: 500, height: 500, background: 'radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>// What you get</div>
          <h2 style={{ fontFamily: 'var(--font)', fontSize: 'clamp(26px,3vw,38px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 32, color: 'var(--text)' }}>
            Everything you need<br />
            <span style={{ background: 'linear-gradient(135deg,#1B7FFF,#00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>from day one.</span>
          </h2>

          {[
            { icon: '⬡', title: 'SAST on every PR', desc: 'Semgrep-powered static analysis runs automatically on every pull request.' },
            { icon: '◉', title: 'Dependency CVE alerts', desc: 'Get notified instantly when a CVE is found in your open-source packages.' },
            { icon: '◈', title: 'Secrets scanner', desc: '800+ patterns detect leaked API keys, tokens, and credentials in real time.' },
            { icon: '✦', title: 'AI fix suggestions', desc: 'One-click AI remediation powered by Claude — not just generic advice.' },
          ].map((item) => (
            <div key={item.title} style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(27,127,255,0.1)', border: '1px solid rgba(27,127,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 10, padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Free forever for small teams</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Up to 3 repos, no credit card needed</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input::placeholder { color: var(--text3); }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}