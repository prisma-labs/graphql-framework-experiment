import * as cp from 'child_process'
import * as fs from 'fs-jetpack'

// prettier-ignore
const json = cp.spawnSync('tydoc',['project','index', '--json'], { encoding: 'utf8' }).output[1]
fs.write('api.json', json)

// prettier-ignore
const md = cp.spawnSync('tydoc',['project','index'], { encoding: 'utf8' }).output[1]
fs.write('api.md', md)
