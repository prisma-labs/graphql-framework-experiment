import { nodeFileTrace } from '@zeit/node-file-trace'
import * as fs from 'fs'
import * as fsJetpack from 'fs-jetpack'
import * as Path from 'path'
import { rootLogger } from '../nexus-logger'
import { Plugin } from '../plugin'
import { fatal } from '../process'

const log = rootLogger.child('cli').child('build').child('bundle')

type Entry = { source: string | Buffer; mode?: number } | null
type SourceCache = Map<string, Entry>

interface BundleOptions {
  /**
   * Base path against which relative paths should be computed.
   * Should usually be `layout.projectRoot`.
   */
  base: string
  /**
   * Absolute path of the output bundle directory.
   */
  bundleOutputDir: string
  /**
   * Absolute path to the transpiled Javascript entrypoint.
   */
  entrypoint: string
  /**
   * Absolute path of the output typescript directory.
   */
  tsOutputDir: string
  /**
   * Absolute path of the tsconfig.json rootDir property.
   */
  tsRootDir: string
  /**
   * List of Nexus plugins.
   */
  plugins: Plugin[]
}

/**
 * Bundle the transpiled output of Typescript into a treeshaked output.
 * The treeshake is done at the module level, not function level.
 * A new node_modules folder will be outputted in `bundleOutputDir` containing only the required packages
 * for the runtime to work.
 */
export async function bundle(opts: BundleOptions): Promise<void> {
  log.trace('starting bundle')

  // delete previous bundle before tracing files
  fsJetpack.remove(opts.bundleOutputDir)

  const { files } = await traceFiles(opts)

  await writeToFS({
    files,
    ...opts,
  })

  log.trace('done bundling')
}

export async function traceFiles(opts: Pick<BundleOptions, 'base' | 'plugins' | 'entrypoint'>) {
  const sourceCache = new Map<string, Entry>()
  const worktimeTesttimePluginPaths = getWorktimeAndTesttimePluginPaths(opts.base, opts.plugins)

  const { fileList, reasons } = await nodeFileTrace([opts.entrypoint], {
    ts: true,
    mixedModules: true,
    base: opts.base,
    /**
     * - We ignore `prettier` because `@nexus/schema` requires it as a optional peer dependency
     * - We ignore `@prisma/client/scripts` because `nexus-plugin-prisma` causes node-file-trace to include these scripts which causes `ncc` to be traces as well
     */
    ignore: ['node_modules/prettier/index.js', 'node_modules/@prisma/client/scripts/**/*'],
    readFile(fsPath: string): Buffer | string | null {
      const relPath = Path.relative(opts.base, fsPath)
      const cached = sourceCache.get(relPath)

      if (cached) return cached.source
      // null represents a not found
      if (cached === null) return null
      try {
        /**
         * Stub the worktime and testtime plugins so that they can keep being resolved
         * in the plugin entrypoints but don't bring any of their dependencies to the bundle
         */
        if (worktimeTesttimePluginPaths.includes(relPath)) {
          sourceCache.set(relPath, { source: '' })
          return ''
        }
        const source: string | Buffer = fs.readFileSync(fsPath)
        const { mode } = fs.lstatSync(fsPath)
        sourceCache.set(relPath, { source, mode })
        return source
      } catch (e) {
        if (e.code === 'ENOENT' || e.code === 'EISDIR') {
          sourceCache.set(relPath, null)
          return null
        }
        throw e
      }
    },
  })

  /**
   * Remove files that were read but not added to the fileList by node-file-trace
   */
  for (const relPath of sourceCache.keys()) {
    if (reasons[relPath] === undefined || reasons[relPath].ignored === true) {
      sourceCache.delete(relPath)
    }
  }
  /**
   * Add files that were added to the file list but not read
   */
  for (const relPath of fileList) {
    if (!sourceCache.has(relPath)) {
      const absPath = Path.resolve(opts.base, relPath)
      try {
        const source = fs.readFileSync(absPath)
        const { mode } = fs.lstatSync(absPath)
        sourceCache.set(relPath, { source, mode })
      } catch (e) {
        if (e.code === 'ENOENT' || e.code === 'EISDIR') {
          sourceCache.set(relPath, null)
        } else {
          fatal('error', { error: e })
        }
      }
    }
  }
  if (process.env.NEXUS_FILE_TRACE_DEBUG) {
    fs.writeFileSync('file-trace.json', JSON.stringify(fileList, null, 2))
    fs.writeFileSync('file-trace-reasons.json', JSON.stringify(reasons, null, 2))
    fs.writeFileSync('file-trace-cache.json', JSON.stringify(Array.from(sourceCache.keys()).sort(), null, 2))
  }

  log.trace('gathered files for bundle')

  return {
    files: sourceCache,
    reasons,
  }
}

/**
 * Write gathered files by node-file-trace to the file system
 */
async function writeToFS(params: {
  base: string
  tsOutputDir: string
  tsRootDir: string
  bundleOutputDir: string
  files: SourceCache
}): Promise<void> {
  const writePromises = []

  for (const [relPath, entry] of params.files.entries()) {
    if (entry === null) {
      continue
    }

    let to: string

    // Calc absolute path of the file
    const absPath = Path.resolve(params.base, relPath)

    // If the file is inside the tsOutputDir
    if (pathIsInside({ base: params.tsOutputDir, target: absPath })) {
      // Calc relative path of the file to tsOutputDir
      const relativeToTsOutputDir = Path.relative(params.tsOutputDir, relPath)
      // Calc relative path of the rootDir to base
      const relativeRootDir = Path.relative(params.base, params.tsRootDir)
      /**
       * Transform path
       *
       *     from: <absPath>
       * from val: /project/.nexus/tmp/folder/filename.js
       *
       *       to:      <bundleOutputDir>/<relativeRootDir>/<relativeToTsOutputDir>
       *   to val: /project/.nexus/build/api              /folder/filename.js
       */
      to = Path.resolve(params.bundleOutputDir, relativeRootDir, relativeToTsOutputDir)
    } else {
      to = Path.resolve(params.bundleOutputDir, relPath)
    }

    const promise = fsJetpack.write(to, entry.source, entry.mode ? { mode: entry.mode } : {})
    writePromises.push(promise)
  }

  await Promise.all(writePromises)
}

/**
 * Gathers all the worktime & testtime plugin module relative paths
 */
function getWorktimeAndTesttimePluginPaths(base: string, plugins: Plugin[]) {
  const paths: string[] = []

  for (const p of plugins) {
    if (p.worktime) {
      paths.push(Path.relative(base, p.worktime.module))
    }

    if (p.testtime) {
      paths.push(Path.relative(base, p.testtime.module))
    }
  }

  return paths
}

function pathIsInside(params: { base: string; target: string }) {
  return !Path.relative(params.base, params.target).startsWith('..')
}
