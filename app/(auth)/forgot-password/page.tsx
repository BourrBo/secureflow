'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 1500)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--body)', padding: 24, position: 'relative',
    }}>
      {/* Glow */}
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(27,127,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, background: 'var(--blue)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 800, color: '#fff' }}>SF</div>
            <span style={{ fontFamily: 'var(--font)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              Secure<span style={{ color: 'var(--blue)' }}>Flow</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 36,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          {!sent ? (
            <>
              {/* Icon */}
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(27,127,255,0.1)', border: '1px solid rgba(27,127,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 20 }}>
                🔑
              </div>

              <h1 style={{ fontFamily: 'var(--font)', fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>
                Reset your password
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28, lineHeight: 1.6 }}>
                Enter your work email and we&apos;ll send you a secure link to reset your password.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                    Work email
                  </label>
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com" required
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

                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: 12, borderRadius: 8,
                  background: loading ? 'rgba(27,127,255,0.6)' : 'var(--blue)',
                  color: '#fff', border: 'none', fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
                  boxShadow: '0 0 24px rgba(27,127,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {loading ? (
                    <>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Sending...
                    </>
                  ) : 'Send reset link →'}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(0,229,118,0.1)', border: '1px solid rgba(0,229,118,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 20px' }}>
                ✅
              </div>
              <h2 style={{ fontFamily: 'var(--font)', fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                Check your email
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 24 }}>
                We sent a reset link to<br />
                <strong style={{ color: 'var(--text)' }}>{email}</strong><br />
                It expires in 15 minutes.
              </p>
              <div style={{ padding: '12px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>
                💡 Didn&apos;t get it? Check spam or{' '}
                <button onClick={() => setSent(false)} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'var(--body)' }}>
                  try again
                </button>
              </div>
            </div>
          )}

          {/* Back to login */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Link href="/login" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              ← Back to sign in
            </Link>
          </div>
        </div>

        {/* Help text */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 20 }}>
          Need help?{' '}
          <a href="mailto:support@secureflow.io" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
            support@secureflow.io
          </a>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input::placeholder { color: var(--text3); }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}
