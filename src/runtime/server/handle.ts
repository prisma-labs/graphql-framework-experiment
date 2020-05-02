import { execute, GraphQLSchema, parse, Source, validate } from 'graphql'

interface NexusRequest {
  // todo currently assumes request body has been parsed as JSON
  body: Record<string, string>
}

function createGraphQLRequestHandler(schema: GraphQLSchema) {
  function handle(req: NexusRequest) {
    const data = req.body
    const source = new Source(data.query)

    let documentAST
    try {
      documentAST = parse(source)
    } catch (syntaxError) {
      // todo
      // https://github.com/graphql/express-graphql/blob/master/src/index.js
      return
    }

    const validationFailures = validate(schema, documentAST)

    if (validationFailures.length > 1) {
      // todo
      return
    }

    // todo validate that if operation is mutation or subscription then http method is not GET
    // https://github.com/graphql/express-graphql/blob/master/src/index.js#L296

    let result
    try {
      result = execute({
        schema: schema,
        document: documentAST,
        // todo other options
      })
    } catch (error) {
      // todo
      return
    }
  }

  return {
    handle,
  }
}
