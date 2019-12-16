import chalk from 'chalk'
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as path from 'path'
import { PackageJson } from 'type-fest'
import { pog } from '.'
import { START_MODULE_NAME } from '../constants'
import { Config, DATABASE_URL_ENV_NAME } from '../framework/config'
import { DEFAULT_BUILD_FOLDER_NAME, Layout } from '../framework/layout'
import { logger } from './logger'
import { fatal } from './process'
import { findConfigFile } from './tsc'

const log = pog.sub(__filename)

/**
 * If you add a new deploy target, please start by adding a new item to the `SUPPORTED_DEPLOY_TARGETS`
 */
const SUPPORTED_DEPLOY_TARGETS = ['now', 'heroku'] as const

export const formattedSupportedDeployTargets = SUPPORTED_DEPLOY_TARGETS.map(
  t => `"${t}"`
).join(', ')

type SupportedTargets = typeof SUPPORTED_DEPLOY_TARGETS[number]

/**
 * Take user input of a deploy target, validate it, and parse it into a
 * normalized form.
 */
export function normalizeTarget(
  inputDeployTarget: string | undefined
): SupportedTargets | null {
  if (!inputDeployTarget) {
    return null
  }

  const deployTarget = inputDeployTarget.toLowerCase()

  if (!SUPPORTED_DEPLOY_TARGETS.includes(deployTarget as any)) {
    fatal(
      `--deployment \`${deployTarget}\` is not supported by Pumpkins. Supported deployment targets: ${formattedSupportedDeployTargets}}`
    )
  }

  return deployTarget as SupportedTargets
}

const TARGET_TO_BUILD_OUTPUT: Record<SupportedTargets, string> = {
  now: 'dist',
  heroku: DEFAULT_BUILD_FOLDER_NAME,
}

export function computeBuildOutputFromTarget(target: SupportedTargets | null) {
  if (!target) {
    return null
  }

  return TARGET_TO_BUILD_OUTPUT[target]
}

const TARGET_VALIDATORS: Record<
  SupportedTargets,
  (config: Config | null, layout: Layout) => boolean
> = {
  now: validateNow,
  heroku: validateHeroku,
}

export function validateTarget(
  target: SupportedTargets,
  config: Config | null,
  layout: Layout
): boolean {
  const validator = TARGET_VALIDATORS[target]
  return validator(config, layout)
}

interface NowJson {
  version: 1 | 2
  name: string
  builds?: Array<{ src: string; use: string }>
  routes?: Array<{ src: string; dest: string }>
}

/**
 * Validate the user's now configuration file.
 */
function validateNow(_config: Config | null, layout: Layout): boolean {
  const maybeNowJsonPath = findConfigFile('now.json', { required: false })
  const startModulePath = `${layout.buildOutput}/${START_MODULE_NAME}.js`
  let isValid = true

  // Make sure there's a now.json file
  if (!maybeNowJsonPath) {
    log('creating now.json because none exists yet')
    const packageJson = fs.read('package.json', 'json')
    const projectName = packageJson?.name ?? 'now_rename_me'

    const nowJsonContent = stripIndent`
      {
        "version": 2,
        "name": "${projectName}",
        "builds": [
          {
            "src": "${startModulePath}",
            "use": "@now/node-server"
          }
        ],
        "routes": [{ "src": "/.*", "dest": "${startModulePath}" }]
      }
    `
    const nowJsonPath = path.join(layout.projectRoot, 'now.json')
    fs.write(nowJsonPath, nowJsonContent)
    logger.warn(
      `No \`now.json\` file were found. We scaffolded one for you in ${nowJsonPath}`
    )
  } else {
    const nowJson: NowJson = fs.read(maybeNowJsonPath, 'json')

    // Make sure the now.json file has the right `builds` values
    if (
      !nowJson.builds ||
      !nowJson.builds.find(
        build =>
          build.src === startModulePath && build.use === '@now/node-server'
      )
    ) {
      logger.error(
        `We could not find a proper builder in your \`now.json\` file`
      )
      logger.error(`Found: "builds": ${JSON.stringify(nowJson.builds)}`)
      logger.error(
        `Expected: "builds": [{ src: "${startModulePath}", use: '@now/node-server' }, ...]`
      )
      console.log('\n')
      isValid = false
    }

    // Make sure the now.json file has a `routes` property
    if (!nowJson.routes) {
      logger.error(
        `We could not find a \`routes\` property in your \`now.json\` file.`
      )
      logger.error(
        `Expected: "routes": [{ "src": "/.*", "dest": "${startModulePath}" }]`
      )
      console.log('\n')
      isValid = false
    }

    // Make sure the now.json file has the right `routes` values
    if (!nowJson.routes?.find(route => route.dest === startModulePath)) {
      logger.error(
        `We could not find a route property that redirects to your api in your \`now.json\` file.`
      )
      logger.error(`Found: "routes": ${JSON.stringify(nowJson.routes)}`)
      logger.error(
        `Expected: "routes": [{ src: '/.*', dest: "${startModulePath}" }, ...]`
      )
      console.log('\n')
      isValid = false
    }
  }

  return isValid
}

function validateHeroku(config: Config | null, layout: Layout): boolean {
  const nodeMajorVersion = Number(process.versions.node.split('.')[0])
  const packageJsonPath = findConfigFile('package.json', { required: false })
  let isValid = true

  // Make sure there's a package.json file
  if (!packageJsonPath) {
    logger.error('We could not find a `package.json` file.')
    console.log()
    isValid = false
  } else {
    const packageJsonContent = fs.read(packageJsonPath, 'json') as PackageJson

    // Make sure there's an engine: { node: <version> } property set
    // TODO: scaffold the `engines` property automatically
    if (!packageJsonContent.engines?.node) {
      logger.error(
        'An `engines` property is needed in your `package.json` file.'
      )
      logger.error(
        `Please add the following to your \`package.json\` file: "engines": { "node": "${nodeMajorVersion}.x" }`
      )
      console.log()
      isValid = false
    }

    // Warn if version used by heroku is different than local one
    if (packageJsonContent.engines?.node) {
      const packageJsonNodeVersion = Number(
        packageJsonContent.engines.node.split('.')[0]
      )
      if (packageJsonNodeVersion !== nodeMajorVersion) {
        logger.warn(
          `Your local node version is different than the one that will be used by heroku (defined in your \`package.json\` file in the "engines" property).`
        )
        logger.warn(
          `Local version: ${nodeMajorVersion}. Heroku version: ${packageJsonNodeVersion}`
        )
        console.log()
      }
    }

    // Make sure there's a build script
    if (!packageJsonContent.scripts?.build) {
      logger.error('A `build` script is needed in your `package.json` file.')
      logger.error(
        `Please add the following to your \`package.json\` file: "scripts": { "build": "pumpkins build -d heroku" }`
      )
      console.log()
      isValid = false
    }

    // Make sure the build script is using pumpkins build
    if (
      packageJsonContent.scripts?.build &&
      !packageJsonContent.scripts.build.includes('pumpkins build')
    ) {
      logger.error(
        'Please make sure your `build` script in your `package.json` file runs the command `pumpkins build -d heroku`'
      )
      console.log()
      isValid = false
    }

    // Make sure there's a start script
    if (!packageJsonContent.scripts?.start) {
      logger.error(
        `Please add the following to your \`package.json\` file: "scripts": { "start": "node ${layout.buildOutput}" }`
      )
      console.log()
      isValid = false
    }

    // Make sure the start script starts the built server
    if (
      !packageJsonContent.scripts?.start?.includes(`node ${layout.buildOutput}`)
    ) {
      logger.error(
        `Please make sure your \`start\` script points to your built server`
      )
      logger.error(`Found: "${packageJsonContent.scripts?.start}"`)
      logger.error(`Expected: "node ${layout.buildOutput}"`)
      console.log()
      isValid = false
    }
  }

  if (!config) {
    config = {
      environments: {},
      environment_mapping: {
        DATABASE_URL: DATABASE_URL_ENV_NAME,
      },
    }
    logger.warn(
      'Heroku pass the database url to your pass using the environment variable `DATABASE_URL`'
    )
    logger.warn(
      `We aliased the environment variable "${DATABASE_URL_ENV_NAME}" to DATABASE_URL`
    )
    console.log()
  }

  if (!config?.environment_mapping?.DATABASE_URL) {
    config = {
      ...config,
      environment_mapping: {
        ...config.environment_mapping,
        DATABASE_URL: DATABASE_URL_ENV_NAME,
      },
    }

    logger.warn(
      'Heroku pass the database url to your app using the environment variable `DATABASE_URL`'
    )
    logger.warn(
      `We aliased the environment variable \`${DATABASE_URL_ENV_NAME}\` to \`DATABASE_URL\``
    )
    logger.warn(
      'If you want to get rid of this warning, please add the following to your `pumpkins.config.ts` file:'
    )
    logger.warn(
      `createConfig(..., { environment_mapping: { DATABASE_URL: '${DATABASE_URL_ENV_NAME}' } })`
    )
    console.log()
  }

  return isValid
}

const TARGET_TO_POST_BUILD_MESSAGE: Record<SupportedTargets, string> = {
  now: `Please run \`now\` to deploy your pumpkins server. Your endpoint will be available at http://<id>.now.sh/graphql`,
  heroku: `\
Please run the following commands to deploy to heroku:

$ heroku login
${chalk.gray(`\
Enter your Heroku credentials.
...`)}

$ heroku create
${chalk.gray(`\
Creating arcane-lowlands-8408... done, stack is cedar
http://arcane-lowlands-8408.herokuapp.com/ | git@heroku.com:arcane-lowlands-8408.git'
Git remote heroku added`)}

$ git push heroku master
${chalk.gray(`\
...
-----> Node.js app detected
...
-----> Launching... done
       http://arcane-lowlands-8408.herokuapp.com deployed to Heroku`)}
`,
}

export function logTargetPostBuildMessage(target: SupportedTargets): void {
  console.log(`🎃  ${TARGET_TO_POST_BUILD_MESSAGE[target]}`)
}
