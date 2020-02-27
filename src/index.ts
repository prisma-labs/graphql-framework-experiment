/**
 * Exports the singleton app components. Use to build up your GraphQL schema and server.
 */

import app from './framework'

export default app

/**
 * [API Reference](https://nexus-future.now.sh/#/references/api?id=logger)  ⌁  [Guide](https://nexus-future.now.sh/#/guides/logging)
 *
 * ### todo
 *
 * @examples
 *
 * ```ts
 * import { logger } from 'nexus-future'
 *
 * log.info('boot')
 * ```
 */
export const log = app.log
/**
 * [API Reference](https://nexus-future.now.sh/#/references/api?id=appschema) // [Guide](todo)
 *
 * ### todo
 *
 * @example
 *
 * ```ts
 * import { schema } from 'nexus-future'
 *
 * schema.objectType({
 *   name: 'Foo',
 *   definition(t) {
 *     t.id('id')
 *   },
 * })
 * ```
 */
export const schema = app.schema
/**
 * [API Reference](https://nexus-future.now.sh/#/references/api?id=server)  ⌁  [Guide](todo)
 *
 * ### todo
 *
 * @example
 *
 * ```ts
 * import { server } from 'nexus-future'
 *
 * server.start()
 * ```
 *
 * @remarks
 *
 * Framework Notes:
 *
 *   - If your app does not call server.start then Nexus will. It is idiomatic to allow Nexus to take care of this. If you deviate, we would love to learn about your use-case!
 *
 */
export const server = app.server
/**
 * todo
 *
 * @example
 *
 * import { log, settings } from 'nexus-future'
 *
 * settings.change({
 *   server: {
 *     startMessage: info => {
 *       settings.original.server.startMessage(info)
 *       log.warn('stowaway message! :p')
 *     },
 *   },
 * })
 */
export const settings = app.settings
