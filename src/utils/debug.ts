import Debug from 'debug'

type DebugType = 'app' | 'schema'

const DebugType: Record<DebugType, string> = {
  app: 'pumpkins:app',
  schema: 'pumpkins:schema',
}

export const debug: Record<DebugType, Debug.Debugger> = Object.keys(
  DebugType
).reduce(
  (acc, key) => {
    acc[key] = Debug(DebugType[key as DebugType])

    return acc
  },
  {} as any
)
