import cleanStackDep from 'clean-stack'
import { indent } from '../../utils'

export function cleanStack(stack: string, opts: { withoutMessage?: boolean } = { withoutMessage: false }) {
  if (opts.withoutMessage === false) {
    return cleanStackDep(stack, { pretty: true })
  }

  const cleanedStack = cleanStackDep(stack, { pretty: true }).split('\n').slice(1)

  return [indent('Stack:', 2), ...cleanedStack].join('\n')
}
