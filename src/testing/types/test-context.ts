import { GraphQLClient } from '../../lib/graphql-client'

export interface TestContextAppCore {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface TestContextCore {
  app: TestContextAppCore
  client: GraphQLClient
}

declare global {
  interface NexusTestContextApp extends TestContextAppCore {}

  interface NexusTestContextRoot {
    app: NexusTestContextApp
    client: GraphQLClient
  }
}

export type TestContext = NexusTestContextRoot

export interface CreateTestContextOptions {
  /**
   * A path to the entrypoint of your app. Only necessary if the entrypoint falls outside of Nexus conventions.
   * You should typically use this if you're using `nexus dev --entrypoint` or `nexus build --entrypoint`.
   */
  entrypointPath?: string
  /**
   * Nexus usually determines the project root by the first `package.json` found while traversing up the file system.
   * In some cases, e.g. usage in a monorepo, this might not always be correct.
   * For those cases, you can specify the `projectRoot` manually.
   *
   * Example: `await createTestContext({ projectRoot: path.join(__dirname, '../..') })`
   */
  projectRoot?: string
}
