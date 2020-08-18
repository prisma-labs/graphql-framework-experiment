/**
 * This module is for reporting issues about Nexus. It extracts diagnostics
 * about the proejct and environment and can format them for a GitHub issue.
 */

import { Either, isLeft } from 'fp-ts/lib/Either'
import os from 'os'
import { PackageJson } from 'type-fest'
import { Layout } from './layout'
import * as PluginRuntime from './plugin'
import * as PluginWorktime from './plugin/worktime'

interface Report {
  node: string
  os: {
    platform: string
    release: string
  }
  nexus?: string
  plugins?: string[]
  otherDependencies?: PackageJson['dependencies']
  devDependencies?: PackageJson['devDependencies']
  hasAppModule?: boolean
  packageManager?: Layout['packageManagerType']
  errorsWhileGatheringReport: {
    gettingLayout: null | Error
    gettingPluginManifests: null | string[]
  }
}

/**
 * Extract diagnostics about the Nexus project.
 */
export async function getNexusReport(errLayout: Either<Error, Layout>): Promise<Report> {
  if (isLeft(errLayout)) {
    return {
      ...getBaseReport(),
      errorsWhileGatheringReport: {
        gettingLayout: errLayout.left,
        gettingPluginManifests: null,
      },
    }
  }

  const layout = errLayout.right
  const pj = layout.packageJson?.content
  const deps = pj?.dependencies ?? {}
  const otherDeps = Object.fromEntries(
    Object.entries(deps).filter((ent) => {
      return ent[0] !== 'nexus' && !ent[0].startsWith('nexus-plugin')
    })
  )
  const pluginEntrypoints = await PluginWorktime.getUsedPlugins(layout)
  const gotManifests = PluginRuntime.getPluginManifests(pluginEntrypoints)

  return {
    ...getBaseReport(),
    nexus: deps.nexus ?? 'undefined',
    plugins: gotManifests.data.map((m) => m.name),
    otherDependencies: otherDeps,
    devDependencies: pj?.devDependencies ?? {},
    hasAppModule: layout.data.app.exists,
    packageManager: layout.packageManagerType,
    errorsWhileGatheringReport: {
      gettingLayout: null,
      gettingPluginManifests: gotManifests.errors
        ? gotManifests.errors.map((e) => e.stack ?? e.message)
        : null,
    },
  }
}

/**
 * Generic report data about user system, not particular to Nexus.
 */
export function getBaseReport() {
  return {
    node: process.version,
    os: {
      platform: os.platform(),
      release: os.release(),
    },
  }
}
