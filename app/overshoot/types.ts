export type DangerLevel = "SAFE" | "WARNING" | "DANGER"

export type OvershootParsed = {
  level: DangerLevel
  summary: string
  grid: boolean[][]
}

export type OvershootResult = {
  result?: string
}

export type OvershootVisionInstance = {
  start: (stream?: MediaStream | null) => Promise<void>
  stop: () => Promise<void>
}

export type OvershootVisionConstructor = new (options: {
  apiUrl: string
  apiKey: string
  prompt: string
  onResult: (result: OvershootResult) => void
}) => OvershootVisionInstance
