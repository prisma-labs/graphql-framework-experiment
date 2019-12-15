import * as fs from 'fs-jetpack'
import { LiteralUnion } from 'type-fest'
import { logger } from './logger'
import { pog } from './pog'

const log = pog.sub(__filename)

type StageNames = LiteralUnion<'development', string>

interface Config {
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

function tryLoadConfig(configPath: string): object | null {
  try {
    return require(configPath)
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
    logger.error(
      'Your config needs to be default exported. `export default createConfig({ ... })`'
    )
    return null
  }

  return config.default as Config
}

export function loadConfig(): Config | null {
  let config = tryLoadConfig(fs.path('pumpkins.config.js'))

  if (!config) {
    config = tryLoadConfig(fs.path('pumpkins.config.ts'))
  }

  return validateConfig(config)
}

export function processConfig(
  config: Config,
  inputStage: string | undefined
): void {
  loadEnvFromConfig(config, inputStage)
  processEnvMappingFromConfig(config)
}

function readStage(inputStage: string | undefined): StageNames {
  if (Boolean(process.env.PUMPKINS_DEV_MODE) === true) {
    return 'development'
  }

  return inputStage ?? process.env.NODE_ENV ?? 'development'
}

function loadEnvFromConfig(
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

export function loadAndProcessConfig(inputStage: StageNames | undefined): void {
  const config = loadConfig()

  if (config) {
    processConfig(config, inputStage)
  }
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
export function createConfig(config: Config) {
  return config
}
