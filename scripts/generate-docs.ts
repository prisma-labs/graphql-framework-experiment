import * as cp from 'child_process'
import * as fs from 'fs-jetpack'

let result: cp.SpawnSyncReturns<string>

console.log('generating json...')

// prettier-ignore
result = cp.spawnSync('tydoc',['project','index', 'testing', 'plugin', '--json'], { encoding: 'utf8' })
if (result.error) console.error(result.error)
else if (result.stderr) console.error(result.stderr)
else fs.write('api.json', result.stdout)

console.log('generating markdown...')

// prettier-ignore
result =  cp.spawnSync('tydoc',['project','index', 'testing', 'plugin'], { encoding: 'utf8' })
if (result.error) console.error(result.error)
else if (result.stderr) console.error(result.stderr)
else fs.write('api.md', result.stdout)

console.log('generating markdown table of contents...')

// prettier-ignore
result = cp.spawnSync('yarn', ['-s', 'doctoc', 'api.md','--title', '# Nexus API Reference'], { encoding: 'utf8' })
if (result.error) console.error(result.error)
else if (result.stderr) console.error(result.stderr)
else console.log(result.stdout)
