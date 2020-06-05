module.exports = [{
      plugin: require('../node_modules/gatsby-plugin-google-analytics/gatsby-browser.js'),
      options: {"plugins":[],"trackingId":"UA-74131346-14","anonymize":true},
    },{
      plugin: require('../node_modules/gatsby-plugin-smoothscroll/gatsby-browser.js'),
      options: {"plugins":[]},
    },{
      plugin: require('../node_modules/gatsby-plugin-catch-links/gatsby-browser.js'),
      options: {"plugins":[]},
    },{
      plugin: require('../node_modules/gatsby-plugin-mdx/gatsby-browser.js'),
      options: {"plugins":[],"decks":[],"defaultLayouts":{"default":"/Users/jasonkuhrt/projects/graphql-nexus/nexus/website/src/layouts/articleLayout.tsx"},"extensions":[".mdx",".md"],"gatsbyRemarkPlugins":["gatsby-remark-sectionize",{"resolve":"gatsby-remark-autolink-headers","options":{"icon":"<svg width=\"17\" height=\"18\" viewBox=\"0 0 17 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path d=\"M1.5 6.33337H15.5\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      <path d=\"M1.5 11.6666H15.5\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      <path d=\"M6.75 1L5 17\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      <path d=\"M12 1L10.25 17\" stroke=\"#CBD5E0\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"/>\n      </svg>","className":"title-link"}},{"resolve":"gatsby-remark-images"}]},
    },{
      plugin: require('../gatsby-browser.js'),
      options: {"plugins":[]},
    }]
