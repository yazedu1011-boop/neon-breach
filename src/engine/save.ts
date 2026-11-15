/** Persistencia local validada para el prototipo. Las recompensas reales deben validarse en servidor. */
export type Locale = 'en' | 'zh-CN'
export type Quality = 'low' | 'medium' | 'high'
export type DevicePreset = 'android' | 'pc' | 'joystick'
export type FpsLimit = 30 | 60 | 90 | 120

export type SaveData = {
  version: 1
  locale: Locale | ''
  musicVolume: number
  sfxVolume: number
  muted: boolean
  quality: Quality
  reducedMotion: boolean
  devicePreset: DevicePreset
  fpsLimit: FpsLimit
  autoOptimization: boolean
  profileName: string
  selectedHero: string
}

export const SAVE_KEY = 'neonbreach.save'

export function defaultSave(): SaveData {
  return {
    version: 1,
    locale: '',
    musicVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    quality: 'low',
    reducedMotion: false,
    devicePreset: 'pc',
    fpsLimit: 30,
    autoOptimization: true,
    profileName: 'NyxRunner-042',
    selectedHero: 'Nyx Vale',
  }
}

const clamp01 = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback
const cleanName = (v: unknown, fallback: string) => typeof v === 'string' && /^[A-Za-z0-9_-]{3,16}$/.test(v) ? v : fallback

export function parseSave(raw: string | null): SaveData {
  const base = defaultSave()
  if (!raw) return base
  let data: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
    data = parsed as Record<string, unknown>
  } catch { return base }
  if (data.version !== 1) return base
  const fps = data.fpsLimit === 60 || data.fpsLimit === 90 || data.fpsLimit === 120 ? data.fpsLimit : 30
  return {
    version: 1,
    locale: data.locale === 'en' || data.locale === 'zh-CN' ? data.locale : '',
    musicVolume: clamp01(data.musicVolume, base.musicVolume),
    sfxVolume: clamp01(data.sfxVolume, base.sfxVolume),
    muted: data.muted === true,
    quality: data.quality === 'low' || data.quality === 'medium' || data.quality === 'high' ? data.quality : 'high',
    reducedMotion: data.reducedMotion === true,
    devicePreset: data.devicePreset === 'android' || data.devicePreset === 'joystick' || data.devicePreset === 'pc' ? data.devicePreset : base.devicePreset,
    fpsLimit: fps,
    autoOptimization: data.autoOptimization !== false,
    profileName: cleanName(data.profileName, base.profileName),
    selectedHero: typeof data.selectedHero === 'string' ? data.selectedHero.slice(0, 32) : base.selectedHero,
  }
}

export class SaveStore {
  data: SaveData
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
    let raw: string | null = null
    try { raw = this.storage?.getItem(SAVE_KEY) ?? null } catch { raw = null }
    this.data = parseSave(raw)
  }
  update(patch: Partial<SaveData>): void {
    this.data = { ...this.data, ...patch }
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data)) } catch { /* memoria local continúa */ }
  }
}
