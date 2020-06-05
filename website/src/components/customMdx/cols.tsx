import React from 'react'
import styled from 'styled-components'

export interface Props {
  children?: any
}

const Cols = styled.div`
  display: flex;
  color: red !important;
  & > * {
    flex-grow: 1;
  }
  & > *:first-child {
    margin-right: 1rem !important;
  }
  & > pre > div {
    height: 100%;
    & > pre {
      height: 100%;
    }
  }
`

export default (props: Props) => {
  return <Cols>{props.children}</Cols>
}
