import { LegacyQueryRedirect } from './components/navigation/LegacyQueryRedirect'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#05070d] text-gray-200 font-mono">
      <LegacyQueryRedirect />
      <noscript>
        <p className="p-4">
          <a href="numogram/">Open the numogram</a>
        </p>
      </noscript>
    </main>
  )
}
