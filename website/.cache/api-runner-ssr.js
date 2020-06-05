var plugins = [{
      plugin: require('/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/node_modules/gatsby-plugin-google-analytics/gatsby-ssr'),
      options: {"plugins":[],"trackingId":"UA-74131346-14","anonymize":true},
    },{
      plugin: require('/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/node_modules/gatsby-plugin-react-helmet/gatsby-ssr'),
      options: {"plugins":[]},
    },{
      plugin: require('/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/node_modules/gatsby-plugin-styled-components/gatsby-ssr'),
      options: {"plugins":[]},
    },{
      plugin: require('/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/node_modules/gatsby-plugin-sitemap/gatsby-ssr'),
      options: {"plugins":[],"sitemapSize":5000},
    },{
      plugin: require('/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/node_modules/gatsby-plugin-mdx/gatsby-ssr'),
      options: {"plugins":[],"decks":[],"defaultLayouts":{"default":"/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/src/layouts/articleLayout.tsx"},"extensions":[".mdx",".md"],"gatsbyRemarkPlugins":["gatsby-remark-sectionize",{"resolve":"gatsby-remark-autolink-headers","options":{"icon":"<svg width=\"17\" height=\"18\" viewBox=\"0 0 17 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path d=\"M1.5 6.33337H15.5\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      <path d=\"M1.5 11.6666H15.5\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      <path d=\"M6.75 1L5 17\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      <path d=\"M12 1L10.25 17\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      </svg>","className":"title-link"}},{"resolve":"gatsby-remark-images"}]},
    }]
// During bootstrap, we write requires at top of this file which looks like:
// var plugins = [
//   {
//     plugin: require("/path/to/plugin1/gatsby-ssr.js"),
//     options: { ... },
//   },
//   {
//     plugin: require("/path/to/plugin2/gatsby-ssr.js"),
//     options: { ... },
//   },
// ]

const apis = require(`./api-ssr-docs`)

// Run the specified API in any plugins that have implemented it
module.exports = (api, args, defaultReturn, argTransform) => {
  if (!apis[api]) {
    console.log(`This API doesn't exist`, api)
  }

  // Run each plugin in series.
  // eslint-disable-next-line no-undef
  let results = plugins.map(plugin => {
    if (!plugin.plugin[api]) {
      return undefined
    }
    const result = plugin.plugin[api](args, plugin.options)
    if (result && argTransform) {
      args = argTransform({ args, result })
    }
    return result
  })

  // Filter out undefined results.
  results = results.filter(result => typeof result !== `undefined`)

  if (results.length > 0) {
    return results
  } else {
    return [defaultReturn]
  }
}
