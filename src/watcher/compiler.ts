import * as fs from 'fs'
import * as fsJetPack from 'fs-jetpack'
import * as os from 'os'
import * as path from 'path'
import { register } from 'ts-node'
import { resolveSync } from 'tsconfig'
import { Compiler, Opts } from './types'
const getCompiledPath = require('./get-compiled-path').default

let sourceMapSupportPath = require
  .resolve('source-map-support')
  .replace(/\\/g, '/')

let tsHandler: any = null
let tmpDir = '.ts-node'
const extensions = ['.ts', '.tsx']
const empty = function() {}
const cwd = process.cwd()
const compilationInstanceStamp = Math.random()
  .toString()
  .slice(2)

export const compiler: Compiler = {
  allowJs: false,
  tsConfigPath: '',
  getCompilationId: function() {
    return compilationInstanceStamp
  },
  createCompiledDir: function() {
    fsJetPack.dir(compiler.getCompiledDir())
  },
  getCompiledDir: function() {
    return path.join(tmpDir, 'compiled').replace(/\\/g, '/')
  },
  getCompileReqFilePath: function() {
    return path.join(
      compiler.getCompiledDir(),
      compiler.getCompilationId() + '.req'
    )
  },
  getCompilerReadyFilePath: function() {
    return path
      .join(os.tmpdir(), 'ts-node-dev-ready-' + compilationInstanceStamp)
      .replace(/\\/g, '/')
  },
  getChildHookPath: function() {
    return path
      .join(os.tmpdir(), 'ts-node-dev-hook-' + compilationInstanceStamp + '.js')
      .replace(/\\/g, '/')
  },
  writeReadyFile: function() {
    fsJetPack.write(compiler.getCompilerReadyFilePath(), '')
  },
  writeChildHookFile: function(options: Opts) {
    let fileDataPath = require.resolve('./child-require-hook')
    let fileData = fsJetPack.read(fileDataPath)!

    const compileTimeout = parseInt(options['compile-timeout']!, 10)
    if (compileTimeout) {
      fileData = fileData.replace('10000', compileTimeout.toString())
    }
    if (compiler.allowJs) {
      fileData = fileData.replace('allowJs = false', 'allowJs = true')
    }
    if (options['prefer-ts']) {
      fileData = fileData.replace('preferTs = false', 'preferTs = true')
    }
    if (options['exit-child']) {
      fileData = fileData.replace('exitChild = false', 'exitChild = true')
    }
    if (options['ignore'] !== undefined) {
      const ignore = options['ignore']
      const ignoreVal =
        !ignore || ignore === 'false'
          ? 'false'
          : '[' +
            (Array.isArray(ignore) ? ignore : ignore.split(/, /))
              .map((ignore: string) => 'new RegExp("' + ignore + '")')
              .join(', ') +
            ']'
      fileData = fileData.replace(
        'let ignore = [/node_modules/]',
        'let ignore = ' + ignoreVal
      )
    }
    fileData = fileData.replace(
      'let compilationId',
      'let compilationId = "' + compiler.getCompilationId() + '"'
    )
    fileData = fileData.replace(
      'let compiledDir',
      'let compiledDir = "' + compiler.getCompiledDir() + '"'
    )
    fileData = fileData.replace(
      './get-compiled-path',
      path.join(__dirname, 'get-compiled-path').replace(/\\/g, '/')
    )
    fileData = fileData.replace(
      'let readyFile',
      'let readyFile = "' + compiler.getCompilerReadyFilePath() + '"'
    )
    fileData = fileData.replace(
      'let sourceMapSupportPath',
      'let sourceMapSupportPath = "' + sourceMapSupportPath + '"'
    )
    fileData = fileData.replace(
      /__dirname/,
      '"' + __dirname.replace(/\\/g, '/') + '"'
    )
    fsJetPack.write(compiler.getChildHookPath(), fileData)
  },
  init: function(options) {
    const project = options['project']
    compiler.log = options.log
    compiler.tsConfigPath =
      resolveSync(cwd, typeof project === 'string' ? project : undefined) || ''

    const originalJsHandler = require.extensions['.js']
    require.extensions['.ts'] = empty
    require.extensions['.tsx'] = empty
    tmpDir = options['cache-directory']
      ? path.resolve(options['cache-directory'])
      : fs.mkdtempSync(path.join(os.tmpdir(), '.ts-node'))
    const compilerOptionsArg =
      options['compilerOptions'] || options['compiler-options']
    let compilerOptions
    if (compilerOptionsArg) {
      try {
        compilerOptions = JSON.parse(compilerOptionsArg)
      } catch (e) {
        console.log(
          'Could not parse compilerOptions',
          options['compilerOptions']
        )
        console.log(e)
      }
    }

    let ignore = options['ignore'] || process.env['TS_NODE_IGNORE']
    if (ignore && typeof ignore === 'string') {
      ignore = [ignore]
    }

    const tsNodeOptions = {
      fast: options['fast'],
      cache: options['cache'] || !options['no-cache'],
      typeCheck: options['type-check'],
      transpileOnly: options['transpileOnly'] || options['transpile-only'],
      pretty: options['pretty'],
      cacheDirectory: options['cache-directory'] || path.join(tmpDir, 'cache'),
      compiler: options['compiler'],
      project: options['project'],
      skipProject: options['skip-project'],
      skipIgnore: options['skip-ignore'],
      ignore: ignore,
      ignoreWarnings:
        options['ignoreWarnings'] ||
        options['ignoreDiagnostics'] ||
        options['ignore-diagnostics'],
      ignoreDiagnostics:
        options['ignoreDiagnostics'] || options['ignore-diagnostics'],
      logError: options['log-error'],
      disableWarnings: options['disableWarnings'],
      preferTsExts: options['prefer-ts-exts'],
      compilerOptions: compilerOptions,
      files: options['files'] || true,
    }
    try {
      register(tsNodeOptions)
    } catch (e) {
      console.log(e)
      return
    }
    /* clean up compiled on each new init*/
    fsJetPack.remove(compiler.getCompiledDir())
    compiler.createCompiledDir()

    /* check if `allowJs` compiler option enable */
    const allowJsEnabled = require.extensions['.js'] !== originalJsHandler
    if (allowJsEnabled) {
      compiler.allowJs = true
      require.extensions['.js'] = originalJsHandler
      extensions.push('.js')
    }
    tsHandler = require.extensions['.ts']
    compiler.writeChildHookFile(options)
  },
  compileChanged: function(fileName, callbacks) {
    if (callbacks && callbacks.onRestart) {
      callbacks.onRestart(fileName)
    }
    const ext = path.extname(fileName)
    if (extensions.indexOf(ext) < 0) return
    try {
      const code = fsJetPack.read(fileName)!
      compiler.compile({
        compile: fileName,
        compiledPath: getCompiledPath(
          code,
          fileName,
          compiler.getCompiledDir()
        ),
        callbacks,
      })
    } catch (e) {
      console.error(e)
    }
  },
  compile: function(params: {
    compile: string
    compiledPath: string
    callbacks: any
  }) {
    const fileName = params.compile
    let code = fsJetPack.read(fileName)!
    const compiledPath = params.compiledPath

    function writeCompiled(code: string, _filename?: string) {
      fsJetPack.write(compiledPath, code)
      fsJetPack.write(compiledPath + '.done', '')
    }

    if (fsJetPack.exists(compiledPath)) {
      return
    }
    const starTime = new Date().getTime()
    const m = {
      _compile: writeCompiled,
    }
    tsHandler(m, fileName)
    try {
      m._compile(code, fileName)
      compiler.log.debug(
        fileName,
        'compiled in',
        new Date().getTime() - starTime,
        'ms'
      )
      if (params.callbacks && params.callbacks.onCompiled) {
        params.callbacks.onCompiled(fileName)
      }
    } catch (e) {
      code = 'throw ' + 'new Error(' + JSON.stringify(e.message) + ')' + ';'
      writeCompiled(code)
    }
  },
}
