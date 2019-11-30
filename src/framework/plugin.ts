import { NexusConfig } from './nexus'

export type Plugin<C extends {} = any> = {
  // TODO We need to enforce the invariant that plugin names are unique or
  // adding randomization into where they are used for naming (e.g. context
  // import alias) or derive unique identifier from plugins off something else
  // like their package name.
  name: string
  context?: {
    typeGen: {
      fields: Record<string, string>
      imports?: Array<{
        as: string
        from: string
      }>
    }
    create: (req: Express.Request) => C
  }
  nexus?: {
    plugins: NexusConfig['plugins']
  }
  onBuild?: () => void
}
