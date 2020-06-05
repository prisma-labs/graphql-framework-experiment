import * as React from 'react'
import styled from 'styled-components'

export default (props: any) => (
  <Logo
    width="40"
    height="24"
    viewBox="0 0 40 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M30.7882 4.18605C30.7882 5.11383 31.5411 5.86047 32.4766 5.86047C33.4121 5.86047 34.165 5.11383 34.165 4.18605C34.165 3.25826 33.4121 2.51163 32.4766 2.51163C31.5411 2.51163 30.7882 3.25826 30.7882 4.18605ZM28.2557 4.18605C28.2557 5.27823 28.6756 6.27163 29.3645 7.01634L27.5736 9.77518L29.9144 11.2946L31.8419 8.32526C32.0489 8.35611 32.2608 8.37209 32.4766 8.37209C34.8108 8.37209 36.6975 6.50097 36.6975 4.18605C36.6975 1.87113 34.8108 0 32.4766 0C30.1424 0 28.2557 1.87113 28.2557 4.18605ZM7.33402 17.0522L13.1291 8.20603C13.5012 8.31415 13.8949 8.37209 14.3023 8.37209C14.5157 8.37209 14.7254 8.35619 14.9301 8.32549L19.2607 16.9701C18.5645 17.7163 18.1395 18.7151 18.1395 19.8139C18.1395 22.1288 20.0262 23.9999 22.3604 23.9999C24.6946 23.9999 26.5813 22.1288 26.5813 19.8139C26.5813 18.9391 26.3119 18.1278 25.8508 17.4568L27.7462 14.5821L25.4163 13.0459L23.5945 15.809C23.2043 15.6912 22.7899 15.6278 22.3604 15.6278C22.147 15.6278 21.9374 15.6435 21.7326 15.6737L17.3932 7.01145C18.0736 6.26729 18.4883 5.27584 18.4883 4.18605C18.4883 1.87113 16.6172 0 14.3023 0C11.9873 0 10.1162 1.87113 10.1162 4.18605C10.1162 5.07428 10.3917 5.89717 10.862 6.57409L4.89219 15.6869C4.66268 15.6481 4.42676 15.6278 4.18605 15.6278C1.87113 15.6278 0 17.499 0 19.8139C0 22.1288 1.87113 23.9999 4.18605 23.9999C6.50097 23.9999 8.37209 22.1288 8.37209 19.8139C8.37209 18.7549 7.98052 17.7888 7.33402 17.0522Z"
      fill="white"
    />
  </Logo>
)

const Logo = styled.svg`
  height: 26px;
  fill: #ffffff;
`
