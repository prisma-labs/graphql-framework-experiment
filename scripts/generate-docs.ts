import * as cp from 'child_process'
import * as fs from 'fs-jetpack'

let result: cp.SpawnSyncReturns<string>

console.log('generating json...')

// prettier-ignore
result = cp.spawnSync('tydoc',['project','index', 'testing', 'plugin', '--json'], { encoding: 'utf8' })
console.log(result.error)
fs.write('api.json', result.output[1])

console.log('generating markdown...')

// prettier-ignore
result =  cp.spawnSync('tydoc',['project','index', 'testing', 'plugin'], { encoding: 'utf8' })
console.log(result.error)
fs.write('api.md', result.output[1])

console.log('generating markdown table of contents...')

// prettier-ignore
result = cp.spawnSync('yarn', ['-s', 'doctoc', 'api.md','--title', '# Nexus API Reference'], { encoding: 'utf8' })
console.log(result.error)
console.log(result.output[1])
