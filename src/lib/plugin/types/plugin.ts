import { PackageJson } from 'type-fest'
import { createRuntimeLens, createWorktimeLens } from '../lens'
import {
  Lens,
  RuntimeContributions,
  RuntimeLens,
  TesttimeContributions,
  TesttimeLens,
  WorktimeLens,
} from './lens'

export type Dimension = 'runtime' | 'worktime' | 'testtime'

export interface DimensionEntrypoint {
  /**
   * Path of a module. We recommend using `require.resolve()`
   */
  module: string
  /**
   * Name of the export in the `module`
   */
  export: string
}

/**
 * Interface of the entrypoint of a plugin. This is what users will import to load your plugin.
 *
 * We recommend you named export that entrypoint with the suffix of your package name camel-cased.
 * eg: `nexus-plugin-amazing-auth` -> `export const amazingAuth: PluginEntrypoint = `
 *
 * By default, no settings can be passed to your plugin.
 *
 * - To enable optional settings, use `export const pluginName: PluginEntrypoint<Settings> = `
 *
 * - (**Not recommended**) To enabled required settings, use `export const pluginName: PluginEntrypoint<Settings, 'required'> =`
 *
 */
export type PluginEntrypoint<
  Settings = void,
  RequiredOrOptionalSettings extends 'required' | 'optional' = 'optional'
> = Settings extends void
  ? () => PluginWithoutSettings
  : RequiredOrOptionalSettings extends 'required'
  ? (settings: Settings) => PluginWithRequiredSettings<Settings>
  : (settings?: Settings) => PluginWithOptionalSettings<Settings>

export interface PluginWithoutSettings {
  /**
   * A path to the package.json of your plugin. We recommend you use `require.resolve()`
   *
   * @example
   *
   * ```
   * packageJsonPath: require.resolve('../package.json')
   * ```
   */
  packageJsonPath: string
  /**
   * An object pointing to the file responsible for the "runtime" dimension of your plugin.
   *
   * @example
   *
   * ```
   * runtime: {
   *   module: require.resolve('./runtime'),
   *   export: 'plugin'
   * }
   * ```
   */
  runtime?: DimensionEntrypoint
  /**
   * An object pointing to the file responsible for the "worktime" dimension of your plugin.
   *
   * @example
   *
   * ```
   * worktime: {
   *   module: require.resolve('./worktime'),
   *   export: 'plugin'
   * }
   * ```
   */
  worktime?: DimensionEntrypoint
  /**
   * An object pointing to the file responsible for the "testtime" dimension of your plugin.
   *
   * @example
   *
   * ```
   * testtime: {
   *   module: require.resolve('./runtime'),
   *   export: 'plugin'
   * }
   * ```
   */
  testtime?: DimensionEntrypoint
  //settingsType?: DimensionEntrypoint
  //frameworkVersion?: string // valid npm version expression
}

export interface PluginWithRequiredSettings<Settings>
  extends PluginWithoutSettings {
  /**
   * The settings passed to your plugin. It is mandatory to pass these settings untouched.
   * Nexus is reponsible for passing these settings to your plugin.
   */
  settings: Settings
}

export interface PluginWithOptionalSettings<Settings>
  extends PluginWithoutSettings {
  /**
   * The settings passed to your plugin. It is mandatory to pass these settings untouched.
   * Nexus is reponsible for passing these settings to your plugin.
   */
  settings: Settings | undefined
}

export type Plugin<Settings = any> =
  | PluginWithoutSettings
  | PluginWithOptionalSettings<Settings>
  | PluginWithRequiredSettings<Settings>

/**
 * Internal representation of a plugin entrypoint, called a "Manifest"
 */
export type Manifest = Plugin & {
  name: string
  packageJson: PackageJson
  settings?: any
}

export type DimensionToPlugin<D extends Dimension> = {
  runtime: InnerRuntimePlugin
  worktime: InnerWorktimePlugin
  testtime: InnerTesttimePlugin
}[D]

export type DimensionToLens<D extends Dimension> = {
  runtime: ReturnType<typeof createRuntimeLens>
  worktime: ReturnType<typeof createWorktimeLens>
  testtime: Lens
}[D]

export type InnerWorktimePlugin = (lens: WorktimeLens) => void
export type InnerRuntimePlugin = (lens: RuntimeLens) => RuntimeContributions
export type InnerTesttimePlugin = (lens: TesttimeLens) => TesttimeContributions
export type InnerPlugin =
  | InnerRuntimePlugin
  | InnerWorktimePlugin
  | InnerTesttimePlugin

/**
 * Interface of a runtime plugin. This **should not** be the entrypoint of your plugin.
 *
 * Use the `PluginEntrypoint` instead, and set its `runtime` property to a path of the file where you defined your `RuntimePlugin`.
 *
 * By default, no settings can be passed to your plugin.
 *
 * - To enable optional settings, use `export const pluginName: RuntimePlugin<Settings> = `
 *
 * - (**Not recommended**) To enabled required settings, use `export const pluginName: RuntimePlugin<Settings, 'required'> =`
 */
export type RuntimePlugin<
  Settings = void,
  OptionalOrRequiredSettings extends 'required' | 'optional' = 'optional'
> = Settings extends void
  ? () => InnerRuntimePlugin
  : OptionalOrRequiredSettings extends 'required'
  ? (settings: Settings) => InnerRuntimePlugin
  : (settings?: Settings) => InnerRuntimePlugin

/**
 * Interface of a worktime plugin. This **should not** be the entrypoint of your plugin.
 *
 * Use the `PluginEntrypoint` instead, and set its `worktime` property to a path of the file where you defined your `WorktimePlugin`.
 *
 * By default, no settings can be passed to your plugin.
 *
 * - To enable optional settings, use `export const pluginName: WorktimePlugin<Settings> = `
 *
 * - (**Not recommended**) To enabled required settings, use `export const pluginName: WorktimePlugin<Settings, 'required'> =`
 */
export type WorktimePlugin<
  Settings = void,
  OptionalOrRequiredSettings extends 'required' | 'optional' = 'optional'
> = Settings extends void
  ? () => InnerWorktimePlugin
  : OptionalOrRequiredSettings extends 'required'
  ? (settings: Settings) => InnerWorktimePlugin
  : (settings?: Settings) => InnerWorktimePlugin

/**
 * Interface of a testtime plugin. This **should not** be the entrypoint of your plugin.
 *
 * The `PluginEntrypoint`.`testtime` property and pass a path to the file where you defined your `TesttimePlugin`.
 *
 * By default, no settings can be passed to your plugin.
 *
 * - To enable optional settings, use `export const plugin: TesttimePlugin<Settings> = `
 *
 * - (**Not recommended**) To enabled required settings, use `export const plugin: TesttimePlugin<Settings, 'required'> =`
 */
export type TesttimePlugin<
  Settings = void,
  OptionalOrRequiredSettings extends 'required' | 'optional' = 'optional'
> = Settings extends void
  ? () => InnerTesttimePlugin
  : OptionalOrRequiredSettings extends 'required'
  ? (settings: Settings) => InnerTesttimePlugin
  : (settings?: Settings) => InnerTesttimePlugin
