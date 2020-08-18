module.exports = {
  ...require('@prisma-labs/prettier-config'),
  overrides: [
    {
      files: ['prisma.md', 'prisma.mdx'],
      options: {
        printWidth: 35,
      },
    },
  ],
}
