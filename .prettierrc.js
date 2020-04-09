module.exports = {
  ...require('@prisma-labs/prettier-config'),
  overrides: [
    {
      files: ['prisma.md'],
      options: {
        printWidth: 35,
      },
    },
  ],
}
