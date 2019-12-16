import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import { LiteralUnion } from 'type-fest'
import { ScriptTarget } from 'typescript'
import { fatal, pog, transpileModule } from '../utils'

const log = pog.sub(__filename)

type StageNames = LiteralUnion<'development', string>

export interface Config {
  environments: {
    development?: Environment
    [x: string]: Environment | undefined
  }
  environment_mapping?: Record<string, string>
}

interface Environment {
  PUMPKINS_DATABASE_URL?: string
  [env_key: string]: string | undefined
}

export const DATABASE_URL_ENV_NAME = 'PUMPKINS_DATABASE_URL'

function tryLoadConfig(configPath: string): object | null {
  const { unregister } = registerTsExt()

  try {
    const config = require(configPath)
    unregister()
    return config
  } catch (e) {
    log(
      'we could not load pumpkins config file at %s. reason: %O',
      configPath,
      e
    )
    return null
  }
}

// TODO: make sure it's properly exported
function validateConfig(config: any): Config | null {
  if (!config) {
    return null
  }

  if (!config.default) {
    fatal(
      'Your config in `pumpkins.config.ts` needs to be default exported. `export default createConfig({ ... })`'
    )
  }

  return config.default as Config
}

export function loadConfig(): Config | null {
  const config = tryLoadConfig(fs.path('pumpkins.config.ts'))

  return validateConfig(config)
}

export function processConfig(config: Config, stage: string | undefined): void {
  processEnvFromConfig(config, stage)
  processEnvMappingFromConfig(config)
}

/**
 * Take stage from args passed to cli, or from node_env, or fallback to development if none were set
 */
function readStage(inputStage: string | undefined): StageNames {
  return inputStage ?? process.env.NODE_ENV ?? 'development'
}

function processEnvFromConfig(
  config: Config,
  inputStage: string | undefined
): void {
  const stage = readStage(inputStage)
  const configEnv = config.environments[stage]

  if (!configEnv) {
    log('No environment to load from config with NODE_ENV=%s', stage)
    return
  }

  for (const envName in configEnv) {
    if (!process.env[envName]) {
      log('setting env var %s=%s', envName, configEnv[envName])
      process.env[envName] = configEnv[envName]
    } else {
      log(
        'env var %s is not loaded from config as its already set to value %s',
        envName,
        process.env[envName]
      )
    }
  }
}

function processEnvMappingFromConfig(config: Config): void {
  for (const sourceEnvName in config.environment_mapping) {
    const targetEnvName = config.environment_mapping[sourceEnvName]

    if (!targetEnvName) {
      continue
    }

    if (targetEnvName) {
      log(
        'env var "%s" is not mapped to env var "%s" because "%s" is already set to "%s"',
        sourceEnvName,
        targetEnvName,
        targetEnvName,
        config.environment_mapping[targetEnvName]
      )
      return
    }

    if (!process.env[sourceEnvName]) {
      log(
        'could not map env var "%s" to "%s" because "%s" is not set',
        sourceEnvName,
        targetEnvName,
        sourceEnvName
      )
      return
    }

    log(
      'mapped env var "%s" to env var "%s" with value "%s"',
      sourceEnvName,
      targetEnvName,
      process.env[sourceEnvName]
    )
    process.env[targetEnvName] = process.env[sourceEnvName]
  }
}

/**
 * Register .ts extension only if it wasn't set already
 */
function registerTsExt(): { unregister: () => void } {
  if (require.extensions['.ts']) {
    return { unregister: () => {} }
  }

  const originalHandler = require.extensions['.js']

  require.extensions['.ts'] = (m: any, filename) => {
    const _compile = m._compile

    m._compile = function(code: string, fileName: string) {
      const transpiledModule = transpileModule(code, {
        target: ScriptTarget.ES5,
      })
      return _compile.call(this, transpiledModule, fileName)
    }

    return originalHandler(m, filename)
  }

  return {
    unregister: () => {
      delete require.extensions['.ts']
    },
  }
}

export function loadAndProcessConfig(
  stage: StageNames | undefined
): Config | null {
  const config = loadConfig()

  if (config) {
    processConfig(config, stage)
  }

  return config
}

function printStaticEnvSetter(
  envName: string,
  value: string | undefined
): string {
  if (!value) {
    return ''
  }

  return stripIndent`
  if (!process.env.${envName}) {
    process.env.${envName} = "${String(value)}"
  }
  `
}

function printStaticEnvMapping(
  source: string,
  target: string | undefined
): string {
  if (!target) {
    return ''
  }

  return stripIndent`
  if (!process.env.${target}) {
    process.env.${target} = process.env.${source}
  }
  `
}

export function printStaticEnvSetters(config: Config, stage: string): string {
  let output: string = ''
  const env = config.environments[stage]

  if (env) {
    for (const envName in env) {
      output += printStaticEnvSetter(envName, env[envName])
    }
  }

  const envMapping = config.environment_mapping

  if (envMapping) {
    for (const sourceEnvName in envMapping) {
      const targetEnvName = envMapping[sourceEnvName]

      output += printStaticEnvMapping(sourceEnvName, targetEnvName)
    }
  }

  return output
}

/**
 * Helper method to configure pumpkins. **Must be default exported in a `pumpkins.config.ts` file**
 *
 * @example
 *
 * export default createConfig({
 *   environments: {
 *     development: {
 *       PUMPKINS_DATABASE_URL: "<database_connection_url>"
 *     }
 *   }
 * })
 */
export function createConfig(config: Config): Config {
  return config
}
