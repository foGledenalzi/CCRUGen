import type { Metadata } from 'next'

import NumogramClient from '../NumogramClient'

export const metadata: Metadata = {
  title: 'Numogram | CCRUG',
  description: 'Interactive visualization of the Decimal Labyrinth.',
}

export default function NumogramPage() {
  return <NumogramClient />
}
