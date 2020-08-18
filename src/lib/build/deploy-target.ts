import chalk from 'chalk'
import { stripIndent } from 'common-tags'
import * as fs from 'fs-jetpack'
import * as Path from 'path'
import { DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT, Layout } from '../../lib/layout'
import { findFileRecurisvelyUpwardSync } from '../fs'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'
import { prettyImportPath } from '../utils'

const log = rootLogger.child('build')

/**
 * If you add a new deploy target, please start by adding a new item to the `SUPPORTED_DEPLOY_TARGETS`
 */
const SUPPORTED_DEPLOY_TARGETS = ['vercel', 'heroku'] as const

export const formattedSupportedDeployTargets = SUPPORTED_DEPLOY_TARGETS.map((t) => `"${t}"`).join(', ')

type SupportedTargets = typeof SUPPORTED_DEPLOY_TARGETS[number]

/**
 * Take user input of a deploy target, validate it, and parse it into a
 * normalized form.
 */
export function normalizeTarget(inputDeployTarget: string | undefined): SupportedTargets | null {
  if (!inputDeployTarget) {
    return null
  }

  const deployTarget = inputDeployTarget.toLowerCase()

  if (!SUPPORTED_DEPLOY_TARGETS.includes(deployTarget as any)) {
    fatal(
      `--deployment \`${deployTarget}\` is not supported by nexus. Supported deployment targets: ${formattedSupportedDeployTargets}}`
    )
  }

  return deployTarget as SupportedTargets
}

const TARGET_TO_BUILD_OUTPUT: Record<SupportedTargets, string> = {
  vercel: 'dist',
  heroku: DEFAULT_BUILD_DIR_PATH_RELATIVE_TO_PROJECT_ROOT,
}

export function computeBuildOutputFromTarget(target: SupportedTargets | null) {
  if (!target) {
    return null
  }

  return TARGET_TO_BUILD_OUTPUT[target]
}

type ValidatorResult = { valid: boolean }
const TARGET_VALIDATORS: Record<SupportedTargets, (layout: Layout) => ValidatorResult> = {
  vercel: validateVercel,
  heroku: validateHeroku,
}

export function validateTarget(target: SupportedTargets, layout: Layout): ValidatorResult {
  const validator = TARGET_VALIDATORS[target]
  return validator(layout)
}

interface VercelJson {
  version: 1 | 2
  name: string
  builds?: Array<{ src: string; use: string }>
  routes?: Array<{ src: string; dest: string }>
}

/**
 * Validate the user's vercel configuration file.
 */
function validateVercel(layout: Layout): ValidatorResult {
  const maybeVercelJson = findFileRecurisvelyUpwardSync('vercel.json', { cwd: layout.projectRoot })
  let isValid = true

  // Make sure there's a vercel.json file
  if (!maybeVercelJson) {
    log.trace('creating vercel.json because none exists yet')
    // todo unused, what was it for?
    const projectName = layout.packageJson?.content.name ?? 'now_rename_me'

    const vercelJsonContent = stripIndent`
      {
        "version": 2,
        "builds": [
          {
            "src": "${layout.build.startModule}",
            "use": "@now/node"
          }
        ],
        "routes": [{ "src": "/.*", "dest": "${layout.build.startModule}" }]
      }
    `
    const vercelJsonPath = Path.join(layout.projectRoot, 'vercel.json')
    fs.write(vercelJsonPath, vercelJsonContent)
    log.warn(`No \`vercel.json\` file were found. We scaffolded one for you in ${vercelJsonPath}`)
  } else {
    const vercelJson: VercelJson = fs.read(maybeVercelJson.path, 'json')

    // Make sure the vercel.json file has the right `builds` values
    if (
      !vercelJson.builds ||
      !vercelJson.builds.find(
        (build) =>
          Path.join(maybeVercelJson.dir, build.src) === layout.build.startModule && build.use === '@now/node'
      )
    ) {
      log.error(`We could not find a proper builder in your \`vercel.json\` file`)
      log.error(`Found: "builds": ${JSON.stringify(vercelJson.builds)}`)
      log.error(`Expected: "builds": [{ src: "${layout.build.startModule}", use: '@now/node' }, ...]`)
      console.log('\n')
      isValid = false
    }

    // Make sure the vercel.json file has a `routes` property
    if (!vercelJson.routes) {
      log.error(`We could not find a \`routes\` property in your \`vercel.json\` file.`)
      log.error(`Expected: "routes": [{ "src": "/.*", "dest": "${layout.build.startModule}" }]`)
      console.log('\n')
      isValid = false
    }

    // Make sure the vercel.json file has the right `routes` values
    if (
      !vercelJson.routes?.find(
        (route) => Path.join(maybeVercelJson.dir, route.dest) === layout.build.startModule
      )
    ) {
      log.error(`We could not find a route property that redirects to your api in your \`vercel.json\` file.`)
      log.error(`Found: "routes": ${JSON.stringify(vercelJson.routes)}`)
      log.error(`Expected: "routes": [{ src: '/.*', dest: "${layout.build.startModule}" }, ...]`)
      console.log('\n')
      isValid = false
    }
  }

  return { valid: isValid }
}

function validateHeroku(layout: Layout): ValidatorResult {
  const nodeMajorVersion = Number(process.versions.node.split('.')[0])
  let isValid = true

  // Make sure there's a package.json file
  if (!layout.packageJson) {
    log.error('We could not find a `package.json` file.')
    console.log()
    isValid = false
  } else {
    // Make sure there's an engine: { node: <version> } property set
    // TODO: scaffold the `engines` property automatically
    if (!layout.packageJson.content.engines?.node) {
      log.error('An `engines` property is needed in your `package.json` file.')
      log.error(
        `Please add the following to your \`package.json\` file: "engines": { "node": "${nodeMajorVersion}.x" }`
      )
      console.log()
      isValid = false
    }

    const pcfg = layout.packageJson.content

    // Warn if version used by heroku is different than local one
    if (pcfg.engines?.node) {
      const packageJsonNodeVersion = Number(pcfg.engines.node.split('.')[0])
      if (packageJsonNodeVersion !== nodeMajorVersion) {
        log.warn(
          `Your local node version is different than the one that will be used by heroku (defined in your \`package.json\` file in the "engines" property).`
        )
        log.warn(`Local version: ${nodeMajorVersion}. Heroku version: ${packageJsonNodeVersion}`)
        console.log()
      }
    }

    // Make sure there's a build script
    if (!pcfg.scripts?.build) {
      log.error('A `build` script is needed in your `package.json` file.')
      log.error(
        `Please add the following to your \`package.json\` file: "scripts": { "build": "nexus build -d heroku" }`
      )
      console.log()
      isValid = false
    }

    // Make sure the build script is using nexus build
    if (pcfg.scripts?.build && !pcfg.scripts.build.includes('nexus build')) {
      log.error(
        'Please make sure your `build` script in your `package.json` file runs the command `nexus build -d heroku`'
      )
      console.log()
      isValid = false
    }

    const startModuleRelative = prettyImportPath(layout.projectRelative(layout.build.startModule))

    // Make sure there's a start script
    if (!pcfg.scripts?.start) {
      log.error(
        `Please add the following to your \`package.json\` file: "scripts": { "start": "node ${startModuleRelative}" }`
      )
      console.log()
      isValid = false
    }

    // Make sure the start script starts the built server
    const startPattern = new RegExp(`^.*node +${startModuleRelative.replace('.', '\\.')}(?: +.*)?$`)
    if (!pcfg.scripts?.start?.match(startPattern)) {
      log.error(`Please make sure your ${chalk.bold(`\`start\``)} script points to your built server`)
      log.error(`Found: ${chalk.red(pcfg.scripts?.start ?? '<empty>')}`)
      log.error(`Expected a pattern conforming to ${chalk.yellow(startPattern)}`)
      log.error(`For example: ${chalk.green(`node ${startModuleRelative}`)}`)
      console.log()
      isValid = false
    }
  }

  return { valid: isValid }
}

const TARGET_TO_POST_BUILD_MESSAGE: Record<SupportedTargets, string> = {
  vercel: `Please run \`vercel\` or \`vc\` to deploy your nexus server. Your endpoint will be available at http://<id>.now.sh/graphql`,
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
  log.info(TARGET_TO_POST_BUILD_MESSAGE[target])
}
