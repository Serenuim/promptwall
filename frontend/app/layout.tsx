import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PROMPTWALL — AI Security API',
  description: 'Production-grade prompt injection detection. Protect your LLM pipeline in one API call.',
  keywords: ['AI security', 'prompt injection', 'LLM protection', 'API security'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
