/**
 * This module is for reporting issues about Nexus. It extracts diagnostics
 * about the proejct and environment and can format them for a GitHub issue.
 */

import os from 'os'
import { PackageJson } from 'type-fest'
import { Layout } from './layout'
import * as Plugin from '../lib/plugin'

interface Report {
  nexus: string
  plugins: string[]
  node: string
  os: {
    platform: string
    release: string
  }
  otherDependencies: PackageJson['dependencies']
  devDependencies: PackageJson['devDependencies']
  hasAppModule: boolean
  packageManager: Layout['packageManagerType']
}

/**
 * Extract diagnostics about the Nexus project.
 */
export async function getNexusReport(layout: Layout): Promise<Report> {
  const pj = layout.packageJson?.content
  const deps = pj?.dependencies ?? {}
  const otherDeps = Object.fromEntries(
    Object.entries(deps).filter((ent) => {
      return ent[0] !== 'nexus' && !ent[0].startsWith('nexus-plugin')
    })
  )
  // TODO: Plugin name is not great in report here
  const pluginManifests = await Plugin.readAllPluginManifestsFromConfig(layout)

  return {
    node: process.version,
    nexus: deps.nexus ?? 'undefined',
    plugins: pluginManifests.map((m) => m.name),
    os: {
      platform: os.platform(),
      release: os.release(),
    },
    otherDependencies: otherDeps,
    devDependencies: pj?.devDependencies ?? {},
    hasAppModule: layout.data.app.exists,
    packageManager: layout.packageManagerType,
  }
}
