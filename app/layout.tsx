import type { Metadata } from 'next'
import './globals.css'
import { CrtNavigationTransitionProvider } from './components/navigation/CrtNavigationTransition'

export const metadata: Metadata = {
  title: 'CCRUG - Numogram Generator',
  description: 'Interactive CCRU numogram viewer and generator.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CrtNavigationTransitionProvider>{children}</CrtNavigationTransitionProvider>
      </body>
    </html>
  )
}
