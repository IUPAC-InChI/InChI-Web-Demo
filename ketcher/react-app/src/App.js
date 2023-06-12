import 'ketcher-react/dist/index.css'
import { StandaloneStructServiceProvider } from 'ketcher-standalone'
import { Editor } from 'ketcher-react'


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
