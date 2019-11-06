declare module 'ts-node-dev' {
  export default function(
    script: string,
    scriptArgs: any[],
    nodeArgs: any[],
    opts: Record<string, any>
  ): void
}
