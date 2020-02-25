import * as NodePty from 'node-pty'

export function ptySpawn(
  command: string,
  args: string[],
  opts: NodePty.IPtyForkOptions,
  expectHandler: (data: string, proc: NodePty.IPty) => void
) {
  return new Promise<{ exitCode: number; signal?: number; data: string }>(
    resolve => {
      const proc = NodePty.spawn(command, args, {
        cols: 80,
        rows: 80,
        ...opts,
      })
      let buffer = ''

      proc.on('data', data => {
        buffer += data
        expectHandler(data, proc)
      })

      proc.on('exit', (exitCode, signal) => {
        resolve({ exitCode, signal, data: buffer })
      })
    }
  )
}
