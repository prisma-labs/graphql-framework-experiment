import * as S from '..'

it('if mapType is assigned non-function', () => {
  expect(() => {
    // @ts-expect-error
    S.create<{ a: number }, { a: boolean }>({ fields: { a: { mapType: 1 } } })
  }).toThrowError('Type mapper for setting "a" was invalid. Type mappers must be functions. Got: 1')
})
it('if mapType is assigned non-function (record)', () => {
  expect(() => {
    // prettier-ignore
    S.create<{ a: Record<string, {b:1}> }, { a: Record<string, {b:2}> }>({ fields: { a: { entry: { fields: { b: { mapType: 1 as any } } } } } })
  }).toThrowError('Type mapper for setting "a.b" was invalid. Type mappers must be functions. Got: 1')
})
