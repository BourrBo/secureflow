import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SecureFlow — Enterprise AppSec Platform | Find & Fix Vulnerabilities Fast',
  description:
    'SecureFlow unifies SAST, SCA, Secrets Detection, IaC and Container scanning in one developer-first platform. Catch critical vulnerabilities before they reach production.',
  keywords: [
    'appsec', 'application security', 'SAST', 'SCA',
    'vulnerability scanning', 'DevSecOps', 'OWASP', 'secrets detection',
  ],
  metadataBase: new URL('https://secureflow.io'),
  openGraph: {
    title: 'SecureFlow — Enterprise AppSec Platform',
    description: 'Unify SAST, SCA, Secrets, IaC & Container scanning. Fix vulnerabilities before production.',
    type: 'website',
    url: 'https://secureflow.io',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
