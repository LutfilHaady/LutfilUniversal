import React from 'react';
import { createRoot } from 'react-dom/client';
import './popup.css';

const Popup: React.FC = () => {
  return (
    <div className="popup-container">
      <h1>VOX Co-pilot</h1>
      <p>Navigate to Instagram to use the Co-pilot sidebar.</p>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
