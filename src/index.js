// index.js or main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client'; // For React 18+
import App from './App';
import { UserProvider } from './components/UserContext'; // Import UserProvider

// Ensure your root element exists, e.g., <div id="root"></div> in index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        <UserProvider> {/* Wrap your entire App with UserProvider */}
            <App />
        </UserProvider>
    </React.StrictMode>
);
