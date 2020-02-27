// otherwise jest throws error about empty test
it.todo('fetch-mock not working. Figure out why')

// import { rawRequest, request } from '.'
// import fetchMock from 'fetch-mock'

// describe('graphql-client unit test', () => {
//   test('minimal query', async () => {
//     const data = {
//       viewer: {
//         id: 'some-id',
//       },
//     }

//     await mock({ body: { data } }, async () => {
//       expect(
//         await request('https://mock-api.com/graphql', `{ viewer { id } }`)
//       ).toEqual(data)
//     })
//   })

//   test('minimal raw query', async () => {
//     const data = {
//       viewer: {
//         id: 'some-id',
//       },
//     }

//     const extensions = {
//       version: '1',
//     }

//     await mock({ body: { data, extensions } }, async () => {
//       const { headers, ...result } = await rawRequest(
//         'https://mock-api.com/graphql',
//         `{ viewer { id } }`
//       )
//       expect(result).toEqual({ data, extensions, status: 200 })
//     })
//   })

//   test('minimal raw query with response headers', async t => {
//     const data = {
//       viewer: {
//         id: 'some-id',
//       },
//     }

//     const extensions = {
//       version: '1',
//     }

//     const reqHeaders = {
//       'Content-Type': 'application/json',
//       'X-Custom-Header': 'test-custom-header',
//     }

//     await mock(
//       { headers: reqHeaders, body: { data, extensions } },
//       async () => {
//         const { headers, ...result } = await rawRequest(
//           'https://mock-api.com/graphql',
//           `{ viewer { id } }`
//         )
//         expect(result).toEqual({ data, extensions, status: 200 })
//         expect(headers.get('X-Custom-Header')).toEqual(
//           reqHeaders['X-Custom-Header']
//         )
//       }
//     )
//   })

//   test('basic error', async t => {
//     const errors = {
//       message:
//         'Syntax Error GraphQL request (1:1) Unexpected Name "x"\n\n1: x\n   ^\n',
//       locations: [
//         {
//           line: 1,
//           column: 1,
//         },
//       ],
//     }

//     await mock({ body: { errors } }, async () => {
//       try {
//         await request('https://mock-api.com/graphql', `x`)
//       } catch (err) {
//         expect(err.response.errors).toEqual(errors)
//       }
//     })
//   })

//   test('raw request error', async t => {
//     const errors = {
//       message:
//         'Syntax Error GraphQL request (1:1) Unexpected Name "x"\n\n1: x\n   ^\n',
//       locations: [
//         {
//           line: 1,
//           column: 1,
//         },
//       ],
//     }

//     await mock({ body: { errors } }, async () => {
//       try {
//         await rawRequest('https://mock-api.com/graphql', `x`)
//       } catch (err) {
//         expect(err.response.errors).toEqual(errors)
//       }
//     })
//   })

//   test('content-type with charset', async () => {
//     const data = {
//       viewer: {
//         id: 'some-id',
//       },
//     }

//     await mock(
//       {
//         headers: { 'Content-Type': 'application/json; charset=utf-8' },
//         body: { data },
//       },
//       async () => {
//         expect(
//           await request('https://mock-api.com/graphql', `{ viewer { id } }`)
//         ).toEqual(data)
//       }
//     )
//   })

//   async function mock(response: any, testFn: () => Promise<void>) {
//     fetchMock.mock({
//       matcher: '*',
//       response: {
//         headers: {
//           'Content-Type': 'application/json',
//           ...response.headers,
//         },
//         body: JSON.stringify(response.body),
//       },
//     })

//     await testFn()

//     fetchMock.restore()
//   }
// })
