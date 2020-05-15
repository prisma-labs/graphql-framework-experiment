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

/**
 * The location of a module and export to the entrypoint for the respective
 * dimension of your plugin.
 *
 * Normally, you do **not** need to configure this. Use the following
 * conventions instead.
 *
 * Adjacent to where your plugin entrypoint is, put any of these modules and
 * Nexus will automatically detect them (the following assumes a plugin
 * entrypoint of plugin/index.ts):
 *
 * ```
 * <project root>/plugin/runtime.ts
 * <project root>/plugin/testtime.ts
 * <project root>/plugin/worktime.ts
 * <project root>/plugin/runtime/index.ts
 * <project root>/plugin/testtime/index.ts
 * <project root>/plugin/worktime/index.ts
 * ```
 */
export interface DimensionEntrypointLocation {
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
  runtime?: DimensionEntrypointLocation
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
  worktime?: DimensionEntrypointLocation
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
  testtime?: DimensionEntrypointLocation
  //settingsType?: DimensionEntrypoint
  //frameworkVersion?: string // valid npm version expression
}

export interface PluginWithRequiredSettings<Settings> extends PluginWithoutSettings {
  /**
   * The settings passed to your plugin. It is mandatory to pass these settings untouched.
   * Nexus is reponsible for passing these settings to your plugin.
   */
  settings: Settings
}

export interface PluginWithOptionalSettings<Settings> extends PluginWithoutSettings {
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
 * PackageJson type in its post-validated-for-plugin-system form.
 */
export type ValidatedPackageJson = {
  name: string
  main: string
} & PackageJson

/**
 * Internal representation of a plugin entrypoint, called a "Manifest"
 *
 * @remarks
 *
 * Whereas plugin entrypoints are designed to ease what API authors must supply,
 * manifests are a resolved representation of the entrypoint with all defaults
 * etc. filled.
 */
export type Manifest = {
  name: string
  packageJson: ValidatedPackageJson
  packageJsonPath: string
  settings: null | Record<string, any>
  worktime: null | DimensionEntrypointLocation
  runtime: null | DimensionEntrypointLocation
  testtime: null | DimensionEntrypointLocation
}

/**
 * Utility type to lookup the entrypoint of a dimension of a plugin.
 */
export type DimensionToPlugin<D extends Dimension> = {
  runtime: InnerRuntimePlugin
  worktime: InnerWorktimePlugin
  testtime: InnerTesttimePlugin
}[D]

/**
 * Utility type to lookup the lens of a dimension of a plugin.
 */
export type DimensionToLens<D extends Dimension> = {
  runtime: ReturnType<typeof createRuntimeLens>
  worktime: ReturnType<typeof createWorktimeLens>
  testtime: Lens
}[D]

export type InnerWorktimePlugin = (lens: WorktimeLens) => void
export type InnerRuntimePlugin = (lens: RuntimeLens) => RuntimeContributions
export type InnerTesttimePlugin = (lens: TesttimeLens) => TesttimeContributions
export type InnerPlugin = InnerRuntimePlugin | InnerWorktimePlugin | InnerTesttimePlugin

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
