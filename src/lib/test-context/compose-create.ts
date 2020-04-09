type Contrib = Record<string, any>
type ContribCreator = (...args: any[]) => Contrib

export function create(contextContribution: ContribCreator): ContribCreator {
  return contextContribution
}

export function compose<
  A,
  R1 extends Contrib,
  R2 extends Contrib,
  R3 extends Contrib,
  R4 extends Contrib,
  R5 extends Contrib,
  R6 extends Contrib
>(
  f: R1 | ((arg: A) => R1),
  g: R2 | ((arg: R1) => R2),
  h: R3 | ((arg: R1 & R2) => R3),
  i: R4 | ((arg: R1 & R2 & R3) => R4),
  j: R5 | ((arg: R1 & R2 & R3 & R4) => R5),
  k: R6 | ((arg: R1 & R2 & R3 & R4 & R5) => R6)
): R1 & R2 & R3 & R4 & R5 & R6
export function compose<
  A,
  R1 extends Contrib,
  R2 extends Contrib,
  R3 extends Contrib,
  R4 extends Contrib,
  R5 extends Contrib
>(
  f: R1 | ((arg: A) => R1),
  g: R2 | ((arg: R1) => R2),
  h: R3 | ((arg: R1 & R2) => R3),
  i: R4 | ((arg: R1 & R2 & R3) => R4),
  j: R5 | ((arg: R1 & R2 & R3 & R4) => R5)
): R1 & R2 & R3 & R4 & R5
export function compose<A, R1 extends Contrib, R2 extends Contrib, R3 extends Contrib, R4 extends Contrib>(
  f: R1 | ((arg: A) => R1),
  g: R2 | ((arg: R1) => R2),
  h: R3 | ((arg: R1 & R2) => R3),
  i: R4 | ((arg: R1 & R2 & R3) => R4)
): R1 & R2 & R3 & R4
export function compose<A, R1 extends Contrib, R2 extends Contrib, R3 extends Contrib>(
  f: R1 | ((arg: A) => R1),
  g: R2 | ((arg: R1) => R2),
  h: R3 | ((arg: R1 & R2) => R3)
): R1 & R2 & R3
export function compose<A, R1 extends Contrib, R2 extends Contrib>(
  f: R1 | ((arg: A) => R1),
  g: R2 | ((arg: R1) => R2)
): R1 & R2
export function compose(...ctxs: Array<Contrib | ContribCreator>): Contrib {
  return ctxs.reduce<Contrib>((acc, ctx) => {
    Object.assign(acc, typeof ctx === 'function' ? ctx(acc) : ctx)
    return acc
  }, {})
}
