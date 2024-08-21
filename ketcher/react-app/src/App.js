import 'ketcher-react/dist/index.css'
import { StandaloneStructServiceProvider } from 'ketcher-standalone'
import { Editor } from 'ketcher-react'
import { Generics } from 'ketcher-core'

// Add the "star" pseudoatom to the extended table.
Generics['special-nodes'].itemSets[0].items.push({
  label: '*',
  description: 'Star Atom'
});

const structServiceProvider = new StandaloneStructServiceProvider();

function App() {
  return (
    <Editor
      staticResourcesUrl={process.env.PUBLIC_URL}
      structServiceProvider={structServiceProvider}
      onInit={(ketcher) => {
        window.ketcher = ketcher;
        window.parent.postMessage({ eventType: 'init' }, '*');
      }}
    />
  );
}

export default App;
