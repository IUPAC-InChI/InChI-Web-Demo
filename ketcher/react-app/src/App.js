import 'ketcher-react/dist/index.css'
import { StandaloneStructServiceProvider } from 'ketcher-standalone'
import { config, Editor } from 'ketcher-react'
import { Generics } from 'ketcher-core'

// Register the "*" hotkey to draw a "star" pseudoatom.
config['atom-*'] = {
  title: 'Atom *',
  shortcut: '*',
  action: {
    tool: 'atom',
    opts: {
      label: '*'
    }
  }
}

// Add the "star" pseudoatom to the extended table.
Generics['special-nodes'].itemSets.push({
  items: [
    { label: '*', description: 'Star Atom' },
  ]
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
