export function emptyExceptionMessage() {
  // todo when the file is present but empty this error message is shown just
  // the same. That is poor user feedback because the instructions are wrong in
  // that case. The instructions in that case should be something like "you have
  // schema files setup correctly but they are empty"
  return `Your GraphQL schema is empty. This is normal if you have not defined any GraphQL types yet. If you did however, check that your files are contained in the same directory specified in the \`rootDir\` property of your tsconfig.json file.`
}
