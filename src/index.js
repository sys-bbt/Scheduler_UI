// src/index.js (or src/main.jsx)
import React from 'react';
import ReactDOM from 'react-dom/client'; // For React 18+
import App from './App';
import { UserProvider } from './components/UserContext'; // Ensure this path is correct
// import 'bootstrap/dist/css/bootstrap.min.css'; // If you're using Bootstrap

// Get the root DOM element where your React app will be mounted
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        {/* UserProvider must wrap the entire App to make UserContext available everywhere */}
        <UserProvider>
            <App />
        </UserProvider>
    </React.StrictMode>
);
