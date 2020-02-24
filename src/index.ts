/**
 * Exports the singleton app components. Use to build up your GraphQL schema and server.
 */

import app from './framework'

export default app

// Destructure app for export
// Do not use destructuring syntax
// Breaks jsdoc, only first destructed member annotated

export const log = app.log

export const schema = app.schema

export const server = app.server

export const settings = app.settings
