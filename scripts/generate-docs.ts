import * as cp from 'child_process'
import * as fs from 'fs-jetpack'

// prettier-ignore
const json = cp.spawnSync('yarn',['-s','docs','project','index', '--json'], {encoding:'utf8'})
fs.write('api.json', json)

// prettier-ignore
const md = cp.spawnSync('yarn',['-s','docs','project','index'], {encoding:'utf8'})
fs.write('api.md', md)
