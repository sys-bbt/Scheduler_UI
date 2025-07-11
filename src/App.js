// App.js
import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { UserContext } from './components/UserContext'; // Import UserContext
import GoogleAuth from './components/GoogleAuth';
import DeliveryList from './components/DeliveryList';
import Tasklist from './components/Tasklist';

// --- UPDATED AUTH WRAPPER ---
function AuthWrapper() {
    const { userEmail } = useContext(UserContext); // Get userEmail from context

    console.log("AuthWrapper: Checking authentication. userEmail:", userEmail);

    if (!userEmail) {
        // If userEmail is not available, redirect to the login page
        console.log("AuthWrapper: User not authenticated, redirecting to /login");
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render the nested routes
    console.log("AuthWrapper: User authenticated, rendering Outlet.");
    return <Outlet />;
}
// --- END UPDATED AUTH WRAPPER ---

function App() {
    return (
        <Router>
            <Routes>
                {/* Route for GoogleAuth - this should be your initial login/auth page */}
                <Route path="/login" element={<GoogleAuth />} />

                {/* Routes that require authentication - protected by AuthWrapper */}
                {/* Any route nested here will be rendered only if AuthWrapper allows it */}
                <Route element={<AuthWrapper />}>
                    {/* Default route to the DeliveryList */}
                    <Route path="/" element={<DeliveryList />} />
                    {/* Route for displaying tasks of a specific delivery */}
                    <Route path="/delivery/data/:delCode" element={<Tasklist />} />
                </Route>

                {/* Catch-all route for any undefined paths */}
                <Route path="*" element={<div>404 Not Found</div>} />
            </Routes>
        </Router>
    );
}

export default App;
