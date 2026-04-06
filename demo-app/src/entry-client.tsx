import React from 'react';
import ReactDOM from 'react-dom/client';

function ClientRoot() {
  return React.createElement('div', { id: 'root' }, 'Loading...');
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(React.createElement(ClientRoot));

if (import.meta.hot) {
  import.meta.hot.accept();
}
