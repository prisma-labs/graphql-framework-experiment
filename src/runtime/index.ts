import * as App from './app'

const app = App.create()

export default app

// Destructure app for export
// Do not use destructuring syntax
// Breaks jsdoc, only first destructed member annotated
// todo jsdoc

export const log = app.log

export const schema = app.schema

export const server = app.server

export const settings = app.settings

export const use = app.use
