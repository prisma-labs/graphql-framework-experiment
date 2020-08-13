// npm uses __dirname as CWD in a postinstall hook. We use INIT_CWD instead if available (set by npm)
// https://github.com/npm/npm/issues/16990#issuecomment-349731142
if (process.env.INIT_CWD) {
  process.chdir(process.env.INIT_CWD)
}

require('./postinstall-deps-check')
require('./postinstall-typegen')
