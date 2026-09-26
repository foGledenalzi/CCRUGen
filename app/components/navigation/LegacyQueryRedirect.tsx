'use client'
import { useEffect } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

// Old share links (/?layout=...) land on the numogram with their query and hash preserved.
// The destination path is fixed; only location.search/hash are forwarded, so this cannot become an open redirect.
export function LegacyQueryRedirect() {
  useEffect(() => {
    window.location.replace(`${BASE_PATH}/numogram/${window.location.search}${window.location.hash}`)
  }, [])
  return null
}
