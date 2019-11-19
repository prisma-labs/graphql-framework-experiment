type ScanResult = {
  build: {
    dir: string
  }
  source: {
    isNested: string
  }
  app: {
    exists: boolean
    path: null | string
  }
  schema:
    | {
        exists: boolean
        multiple: true
        paths: string[]
      }
    | {
        exists: boolean
        multiple: false
        path: null | string
      }
  context: {
    exists: boolean
    path: null | string
  }
}

export const scan = async (): Promise<ScanResult> => {
  // TODO
  return {} as any
}
