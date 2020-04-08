import { scan, takeWhile } from 'rxjs/operators'

export const takeUntilServerListening = takeWhile(
  (data: string) => !data.includes('server listening')
)

export const bufferOutput = scan(
  (buffer: string, data: string) => buffer + data,
  ''
)
