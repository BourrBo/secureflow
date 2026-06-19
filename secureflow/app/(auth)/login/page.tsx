'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); router.push('/dashboard') }, 1500)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      fontFamily: 'var(--body)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 80px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 48 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34, height: 34, background: 'var(--blue)',
              borderRadius: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontFamily: 'var(--font)',
              fontSize: 13, fontWeight: 800, color: '#fff',
            }}>SF</div>
            <span style={{ fontFamily: 'var(--font)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              Secure<span style={{ color: 'var(--blue)' }}>Flow</span>
            </span>
          </Link>
        </div>

        {/* Form card */}
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: 36,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          <h1 style={{
            fontFamily: 'var(--font)', fontSize: 24, fontWeight: 800,
            color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6,
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>
            Sign in to your SecureFlow account
          </p>

          {/* SSO Buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {[
              { icon: '🐙', label: 'GitHub' },
              { icon: '🔷', label: 'Google' },
              { icon: '🏢', label: 'SSO' },
            ].map((btn) => (
              <button key={btn.label} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '9px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text2)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', transition: 'all .15s',
                fontFamily: 'var(--body)',
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(27,127,255,0.3)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text2)'
                }}
              >
                <span>{btn.icon}</span>{btn.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg3)',
                  color: 'var(--text)', fontSize: 13, outline: 'none',
                  fontFamily: 'var(--body)', transition: 'border-color .15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--blue)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  style={{
                    width: '100%', padding: '10px 40px 10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--bg3)',
                    color: 'var(--text)', fontSize: 13, outline: 'none',
                    fontFamily: 'var(--body)', transition: 'border-color .15s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--blue)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: 14, padding: 2,
                  }}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <input type="checkbox" id="remember" style={{ accentColor: 'var(--blue)', width: 14, height: 14 }} />
              <label htmlFor="remember" style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                Keep me signed in for 30 days
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8,
                background: loading ? 'rgba(27,127,255,0.6)' : 'var(--blue)',
                color: '#fff', border: 'none', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
                transition: 'all .2s',
                boxShadow: loading ? 'none' : '0 0 24px rgba(27,127,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Signing in...
                </>
              ) : 'Sign in →'}
            </button>
          </form>

          {/* Sign up link */}
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)', marginTop: 24 }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}>
              Sign up free
            </Link>
          </p>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', gap: 16, marginTop: 28, alignItems: 'center' }}>
          {['SOC2 Certified', 'End-to-end encrypted', 'GDPR compliant'].map((b) => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
              <span style={{ color: 'var(--green)', fontSize: 10 }}>✓</span>{b}
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: 1,
        background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow */}
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 400, height: 400, background: 'radial-gradient(ellipse, rgba(27,127,255,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
            // Trusted by security teams
          </div>
          <h2 style={{ fontFamily: 'var(--font)', fontSize: 'clamp(28px,3vw,42px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16, color: 'var(--text)' }}>
            Secure your code.<br />
            <span style={{ background: 'linear-gradient(135deg,#1B7FFF,#00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Ship with confidence.
            </span>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 380, marginBottom: 40, fontWeight: 300 }}>
            Join thousands of security engineers using SecureFlow to catch vulnerabilities before they reach production.
          </p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>
            {[
              { num: '142K+', label: 'Vulnerabilities fixed' },
              { num: '3 min', label: 'Avg time to first scan' },
              { num: '800+', label: 'Secret patterns' },
              { num: '99.6%', label: 'Uptime SLA' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '16px 18px',
              }}>
                <div style={{ fontFamily: 'var(--font)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 3 }}>{s.num}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontStyle: 'italic', fontWeight: 300, marginBottom: 14 }}>
              &ldquo;SecureFlow reduced our critical vulnerability backlog by 70% in just 6 weeks. It&apos;s now part of every sprint.&rdquo;
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'var(--font)' }}>AK</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Arjun Kapoor</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Head of AppSec · FinTech Startup</div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#FFB020', fontSize: 11 }}>★★★★★</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input::placeholder { color: var(--text3); }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}