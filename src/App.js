// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';

// Correct imports based on files in 'src/components/'
// Removed: import Login from './components/Login';
// Removed: import AuthenticatedRoute from './components/AuthenticatedRoute';
import GoogleAuth from './components/GoogleAuth'; // Use GoogleAuth for authentication
import DeliveryList from './components/DeliveryList';
import Tasklist from './components/Tasklist';

// A simple wrapper that conditionally renders content based on authentication status.
// This replaces AuthenticatedRoute if you don't have that file.
// If your GoogleAuth component itself handles routing/redirection upon login,
// you might structure this differently. For now, this assumes GoogleAuth
// provides the user context and renders its children when authenticated.
function AuthWrapper() {
    // You would typically get user authentication status from context here (e.g., UserContext)
    // For now, let's assume if GoogleAuth renders, it handles the context.
    return <Outlet />; // Outlet renders the nested routes
}


function App() {
    return (
        <Router>
            <Routes>
                {/* Route for GoogleAuth (your login/authentication page) */}
                {/* Assuming GoogleAuth handles its own state (e.g., redirects to '/' on success) */}
                <Route path="/login" element={<GoogleAuth />} />

                {/* Authenticated Routes - using AuthWrapper if AuthenticatedRoute.js is gone */}
                {/* If GoogleAuth always needs to be present to provide context, you might wrap the whole app in it */}
                <Route element={<AuthWrapper />}>
                    {/* Route for the main Delivery List page */}
                    <Route path="/" element={<DeliveryList />} />
                    {/* Route for the Tasklist page with a dynamic parameter */}
                    <Route path="/delivery/data/:delCode" element={<Tasklist />} />
                </Route>

                {/* Catch-all for undefined routes (optional) */}
                <Route path="*" element={<div>404 Not Found</div>} />
            </Routes>
        </Router>
    );
}

export default App;
