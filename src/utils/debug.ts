import Debug from 'debug'

type DebugType = 'app' | 'schema' | 'prisma'

const DebugType: Record<DebugType, string> = {
  app: 'pumpkins:app',
  schema: 'pumpkins:schema',
  prisma: "pumpkins:prisma"
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
