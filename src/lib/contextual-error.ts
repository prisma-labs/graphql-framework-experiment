export class ContextualError<Context extends object> extends Error {
  constructor(message: string, public context: Context) {
    super(message)
    this.name = this.constructor.name
  }
}

export function rewordError<E extends ContextualError<{}>>(message: string, e: E): E {
  // todo copy instead of mutate
  e.message = message
  return e
}
