// index.js (or main.jsx)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UserProvider } from './components/UserContext'; // Ensure this path is correct
// import 'bootstrap/dist/css/bootstrap.min.css'; // If you're using Bootstrap

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        <UserProvider> {/* This is crucial */}
            <App />
        </UserProvider>
    </React.StrictMode>
);
