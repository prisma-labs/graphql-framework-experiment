import Module from 'module'

export function resolveFrom(moduleId: string, from: string) {
  return require.resolve(moduleId, {
    paths: (Module as any)._nodeModulePaths(from),
  })
}
