const { hot } = require("react-hot-loader/root")

// prefer default export if available
const preferDefault = m => m && m.default || m


exports.components = {
  "component---cache-dev-404-page-js": hot(preferDefault(require("/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/.cache/dev-404-page.js"))),
  "component---src-layouts-article-layout-tsx": hot(preferDefault(require("/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/src/layouts/articleLayout.tsx"))),
  "component---src-pages-404-tsx": hot(preferDefault(require("/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/src/pages/404.tsx")))
}

