export type Plugin<C extends {}> = {
  // TODO We need to enforce the invariant that plugin names are unique or
  // adding randomization into where they are used for naming (e.g. context
  // import alias) or derive unique identifier from plugins off something else
  // like their package name.
  name: string
  context: {
    typeExportName?: string
    // TODO we could make this optional by using some node v8 api trickery to get the __filename of the caller, by default
    typeSourcePath: string
    create: (req: Express.Request) => C
  }
}
