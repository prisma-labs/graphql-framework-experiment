import { stripIndent } from 'common-tags'
import dotenv from 'dotenv'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import { LiteralUnion } from 'type-fest'
import { ScriptTarget } from 'typescript'
import { fatal, pog, transpileModule } from '../utils'
import { logger } from '../utils/logger'

const log = pog.sub(__filename)

type StageNames = LiteralUnion<'development' | 'production', string>

export interface Config {
  environments: {
    development?: EnvironmentWithSecretLoader
    production?: EnvironmentWithSecretLoader
    [x: string]: EnvironmentWithSecretLoader | undefined
  }
  environment_mapping?: Record<string, string>
}

type EnvironmentWithSecretLoader =
  | ((load: SecretLoader) => Environment | undefined)
  | Environment
  | undefined

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
  const loadedEnv = loadEnvironment(config.environments, stage)

  if (!loadedEnv) {
    log('No environment to load from config with NODE_ENV=%s', stage)
    return
  }

  for (const envName in loadedEnv) {
    if (!process.env[envName]) {
      log('setting env var %s=%s', envName, loadedEnv[envName])
      process.env[envName] = loadedEnv[envName]
    } else {
      log(
        'env var %s is not loaded from config as its already set to value %s',
        envName,
        process.env[envName]
      )
    }
  }
}

function loadEnvironment(
  environments: Config['environments'],
  stage: string
): Environment | undefined {
  if (!environments || !environments[stage]) {
    return undefined
  }

  const envToLoad = environments[stage]!
  const secretLoader = createSecretLoader(stage)

  return typeof envToLoad === 'function' ? envToLoad(secretLoader) : envToLoad
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
  const env = loadEnvironment(config.environments, stage)

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

type SecretLoader = {
  secret: (secretName: string) => string | undefined
  secrets: (...secretNames: string[]) => Environment | undefined
}

function createSecretLoader(stage: string): SecretLoader {
  const secretsByStageCache: Record<
    string,
    { secrets: Record<string, string>; file: string }
  > = {}
  const loadSecrets = () => {
    const result = secretsByStageCache[stage]
      ? secretsByStageCache[stage]
      : tryLoadSecrets(stage)

    if (!result) {
      logger.warn(
        `We could not load your secret(s) for environment \`${stage}\``
      )
      logger.warn(`A file \`${stage}.env\` or .secrets/${stage}.env must exist`)
      return null
    }

    return result
  }

  return {
    secret: secretName => {
      const loadedSecrets = loadSecrets()

      if (!loadedSecrets?.secrets[secretName]) {
        logger.warn(
          `We could not load your secret \`${secretName}\` for environment \`${stage}\``
        )
        logger.warn(
          `${loadedSecrets?.file} does not export any secret called \`${secretName}\``
        )
        return undefined
      }

      return loadedSecrets.secrets[secretName]
    },
    secrets: (...secretsNames) => {
      const loadedSecrets = loadSecrets()

      if (!loadedSecrets) {
        return undefined
      }

      if (secretsNames.length === 0) {
        return loadedSecrets.secrets
      }

      const pickedSecrets = Object.entries(loadedSecrets.secrets).reduce<
        Record<string, string>
      >((acc, [secretName, secretValue]) => {
        if (secretsNames.includes(secretName)) {
          acc[secretName] = secretValue
        } else {
          logger.warn(
            `We could not load your secret \`${secretName}\` for environment \`${stage}\``
          )
          logger.warn(
            `${loadedSecrets?.file} does not export any secret called \`${secretName}\``
          )
        }
        return acc
      }, {})

      return pickedSecrets
    },
  }
}

function tryLoadSecrets(
  stage: string
): { secrets: Record<string, string>; file: string } | null {
  const secretFileName = `${stage}.env`
  let secretPath = path.join('.secrets', secretFileName)
  let secretContent = fs.read(secretPath)

  if (secretContent) {
    return { secrets: dotenv.parse(secretContent), file: secretPath }
  }

  secretContent = fs.read(secretFileName)

  if (secretContent) {
    return { secrets: dotenv.parse(secretContent), file: secretFileName }
  }

  return null
}

export function loadEnvironmentFromConfig(
  inputStage: string | undefined
): Environment | null {
  const config = loadConfig()
  const stage = readStage(inputStage)

  if (!config) {
    return null
  }

  return loadEnvironment(config.environments, stage) ?? null
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
