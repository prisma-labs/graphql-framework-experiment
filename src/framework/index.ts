import * as App from './app'

const app = App.create()
const { logger, schema, server } = app

export default app
export { logger, schema, server }
