import { inspect } from 'util'

type Modules = {
  typescript: typeof import('typescript/lib/tsserverlibrary')
}

module.exports = function init(modules: Modules) {
  function create(info: ts.server.PluginCreateInfo) {
    function log(...x: any[]) {
      return info.project.log('nexus: ' + x.join(' | '))
    }

    function dump(...x: any[]) {
      return x.map(i).map((x) => info.project.log('nexus: ' + x))
    }

    log('creating')

    // Set up decorator
    const proxy = Object.create(null) as ts.LanguageService
    for (let k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
      const x: any = info.languageService[k]
      proxy[k] = ((...args: {}[]) => x.apply(info.languageService, args)) as any
    }

    proxy.getCompletionsAtPosition = (fileName, position, options) => {
      const prior = info.languageService.getCompletionsAtPosition(fileName, position, options)

      if (!prior) return prior

      log(prior.entries.length, fileName, position)

      /**
       * Filter out entries from nexus lib.
       *
       * For example "log" has "importAndLoadRuntimePlugins" among completions.
       */
      prior.entries = prior.entries.filter((c) => {
        if (!c.source) return true
        const match = c.source.match(/.*\/nexus\/(.+)$/)
        if (!match) return true
        log('found completion')
        const publicAPI =
          match[1].includes('dist/index') ||
          match[1].includes('dist/runtime/index') ||
          match[1].includes('dist/testtime/index')
        if (!publicAPI) {
          log('dropping completion because not public api')
          dump(c)
        }
        return publicAPI
      })

      /**
       * Boost value of nexus runtime exports
       * todo so far this appears to do nothing actually
       */
      prior.entries.forEach((c) => {
        if (c.source?.match(/.*\/nexus\/dist\/runtime\/index/)) {
          c.isRecommended = true
        }
      })

      return prior
    }

    return proxy
  }

  return {
    create,
  }
}

/**
 * Helpers
 */

/**
 * Inspect value
 */
function i(x: any) {
  return inspect(x, { depth: 10, maxArrayLength: 1000 })
}
