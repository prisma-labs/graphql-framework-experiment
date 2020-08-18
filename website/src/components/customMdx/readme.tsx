import React from 'react';
import * as ReactMarkdown from 'react-markdown';

const Readme = ({ user, repo, branch }: any) => {
  const [md, setMd] = React.useState<string>()
  async function fetchReadMe(){
    const data = await fetch(`https://raw.githubusercontent.com/${user}/${repo}/${branch}/README.md`)
    const readme = await data.text();
    setMd(readme)
  }
  React.useEffect(() => {
    fetchReadMe()
  }, [user, repo, branch])
  return md ? (
    <ReactMarkdown source={md} escapeHtml={false} />
  ) : null
}
export default Readme