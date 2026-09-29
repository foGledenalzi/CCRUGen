import type { ViewLayoutId } from './layoutIds'

type ShareTitleInput = {
  layout: ViewLayoutId
  selectedIds: number[]
  layers?: string
  particles?: boolean | '0' | '1'
  date?: string
  orbits?: '0' | '1'
  /** Omit or pass undefined at base 10 (UI-02's own omit-at-default convention). */
  base?: number
}

function flagEnabled(value: ShareTitleInput['particles']): boolean {
  return value === true || value === '1'
}

export function buildNumogramTitle(input: ShareTitleInput): string {
  const zonesPart = input.selectedIds.length > 0 ? input.selectedIds.join(',') : 'all'
  const settings: string[] = []

  if (input.base !== undefined && input.base !== 10) settings.push(`base=${input.base}`)
  settings.push(`layout=${input.layout}`)
  if (input.layers) settings.push(`layers=${input.layers}`)
  if (flagEnabled(input.particles)) settings.push('particles=1')
  if (input.date) settings.push(`date=${input.date}`)
  if (input.orbits === '0') settings.push('orbits=0')

  return `NUMOGRAM :: [${zonesPart}] [${settings.join(' ')}]`
}
