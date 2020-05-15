import * as fs from 'fs'
import * as fsJetpack from 'fs-jetpack'
import fileTrace from '@zeit/node-file-trace'
import * as path from 'path'
import { Plugin } from '../plugin'
import { rootLogger } from '../nexus-logger'
import { fatal } from '../process'

const log = rootLogger.child('cli').child('build').child('bundle')

type Entry = { source: string | Buffer; mode?: number } | null
type SourceCache = Map<string, Entry>

interface BundleOptions {
  base: string
  entrypoint: string
  outputDir: string
  plugins: Plugin[]
}

export async function bundle(opts: BundleOptions): Promise<void> {
  log.trace('starting bundle')

  // delete previous bundle before tracing files
  fsJetpack.remove(opts.outputDir)

  const { files } = await traceFiles({
    base: opts.base,
    entrypoint: opts.entrypoint,
    plugins: opts.plugins,
  })

  await writeToFS({
    files,
    outputDir: opts.outputDir,
    base: opts.base,
  })

  log.trace('done bundling')
}

export async function traceFiles(opts: Omit<BundleOptions, 'outputDir'>) {
  const sourceCache = new Map<string, Entry>()
  const worktimeTesttimePluginPaths = getWorktimeAndTesttimePluginPaths(opts.base, opts.plugins)

  const { fileList, reasons } = await fileTrace([opts.entrypoint], {
    ts: true,
    mixedModules: true,
    base: opts.base,
    /**
     * - We ignore `prettier` because `@nexus/schema` requires it as a optional peer dependency
     * - We ignore `@prisma/client/scripts` because `nexus-prisma` causes node-file-trace to include these scripts which causes ncc to be traces as well
     */
    ignore: ['node_modules/prettier/index.js', 'node_modules/@prisma/client/scripts/**/*'],
    readFile(fsPath: string): Buffer | string | null {
      const relPath = path.relative(opts.base, fsPath)
      const cached = sourceCache.get(relPath)
      if (cached) return cached.toString()
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
        return source.toString()
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
      const absPath = path.resolve(opts.base, relPath)
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
async function writeToFS(opts: { files: SourceCache; outputDir: string; base: string }): Promise<void> {
  const writePromises = []

  for (const [relPath, entry] of opts.files.entries()) {
    if (entry === null) {
      continue
    }

    const to = path.resolve(opts.outputDir, relPath)

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
      paths.push(path.relative(base, p.worktime.module))
    }

    if (p.testtime) {
      paths.push(path.relative(base, p.testtime.module))
    }
  }

  return paths
}
