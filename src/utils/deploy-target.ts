import * as fs from 'fs-jetpack'
import * as path from 'path'
import { pog } from '.'
import { START_MODULE_NAME } from '../constants'
import { Layout } from '../framework/layout'
import { logger } from './logger'
import { findConfigFile } from './tsc'

const log = pog.sub(__filename)

const SUPPORTED_TARGETS = ['now'] as const
const formattedSupportedTargets = SUPPORTED_TARGETS.map(t => `"${t}"`).join(',')

type SupportedTargets = typeof SUPPORTED_TARGETS[number]

export function normalizeTarget(
  inputTarget: string | undefined
): SupportedTargets | null {
  if (!inputTarget) {
    return null
  }

  const target = inputTarget.toLowerCase()

  if (!SUPPORTED_TARGETS.includes(target as any)) {
    logger.error(
      `--target \`${target}\` is not supported by Pumpkins. Supported targets: ${formattedSupportedTargets}}`
    )
    process.exit(1)
  }

  return target as SupportedTargets
}

const TARGET_TO_OUTPUT_BUILD: Record<SupportedTargets, string> = {
  now: 'dist',
}

export function computeOutputBuildFromTarget(target: SupportedTargets | null) {
  if (!target) {
    return null
  }

  return TARGET_TO_OUTPUT_BUILD[target]
}

const TARGET_VALIDATORS: Record<
  SupportedTargets,
  (layout: Layout, outDir: string) => boolean
> = {
  now: validateNow,
}

export function validateTarget(
  target: SupportedTargets,
  layout: Layout,
  outDir: string
): boolean {
  const validator = TARGET_VALIDATORS[target]

  return validator(layout, outDir)
}

interface NowJson {
  version: 1 | 2
  name: string
  builds?: Array<{ src: string; use: string }>
  routes?: Array<{ src: string; dest: string }>
}

function validateNow(layout: Layout, outDir: string): boolean {
  const maybeNowJsonPath = findConfigFile('now.json', { required: false })
  const startModulePath = `${outDir}/${START_MODULE_NAME}.js`
  let isValid = true

  if (!maybeNowJsonPath) {
    log('creating now.json because none exists yet')
    const packageJson = fs.read('package.json', 'json')
    const projectName = packageJson?.name ?? 'now_rename_me'

    const nowJsonContent = `\
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

const TARGET_TO_POST_BUILD_MESSAGE: Record<SupportedTargets, string> = {
  now: `Please run \`now\` to deploy your pumpkins server. Your endpoint will be available at http://<id>.now.sh/graphql`,
}

export function logTargetPostBuildMessage(target: SupportedTargets): void {
  console.log(`🎃  ${TARGET_TO_POST_BUILD_MESSAGE[target]}`)
}
