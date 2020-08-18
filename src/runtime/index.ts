import * as App from './app'

/**
 * [API Reference](https://nxs.li/docs/api/app) ⌁ [Issues](https://nxs.li/issues) ⌁ [Discussions](https://nxs.li/discussions) ⌁ [Tweets](https://nxs.li/tweets)
 */
const app = App.create()

export default app

/**
 * Destructure the app for named-export access. This is sugar, and to help
 * auto-import workflows. Not everything on `app` is name-exported. Just those
 * things that are part of every-day work.
 *
 * WARNING Do not use destructuring syntax here, it will not be jsdocable.
 *
 * WARNING Make sure that jsdoc edits here are ported to runtime/app
 */

/**
 * [API Reference](https://nxs.li/docs/api/logger) ⌁ [Guide](https://nxs.li/docs/guides/logger) ⌁ [Issues](https://nxs.li/issues/components/logger)
 */
export const log = app.log

/**
 * [API Reference](https://nxs.li/docs/api/server) ⌁ [Guide](https://nxs.li/docs/guides/server) ⌁ [Issues](https://nxs.li/issues/components/server)
 */
export const server = app.server

/**
 * [API Reference](https://nxs.li/docs/api/schema) ⌁ [Guide](https://nxs.li/docs/guides/schema) ⌁ [Issues](https://nxs.li/issues/components/schema)
 */
export const schema = app.schema

/**
 * [API Reference](https://nxs.li/docs/api/settings) ⌁ [Issues](https://nxs.li/issues/components/settings)
 */
export const settings = app.settings

/**
 * [API Reference](https://nxs.li/docs/api/on) ⌁ [Issues](https://nxs.li/issues/components/lifecycle)
 *
 * Use the lifecycle component to tap into application events.
 */
export const on = app.on

/**
 * [API Reference](https://nxs.li/docs/api/use-plugins) ⌁ [Issues](https://nxs.li/issues/components/plugins)
 */
export const use = app.use
