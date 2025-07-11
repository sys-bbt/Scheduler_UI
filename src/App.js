// App.js
import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';

// Correct imports based on files confirmed to be in 'src/components/'
import GoogleAuth from './components/GoogleAuth';
import DeliveryList from './components/DeliveryList';
import Tasklist from './components/Tasklist';
import { UserContext } from './components/UserContext'; // Import UserContext

// --- UPDATED AUTH WRAPPER ---
// This component checks if the user is authenticated and redirects to /login if not.
function AuthWrapper() {
    const { userEmail } = useContext(UserContext); // Get userEmail from context

    console.log("AuthWrapper: Checking authentication. userEmail:", userEmail);

    if (!userEmail) {
        // If userEmail is not available (not logged in), redirect to the login page
        console.log("AuthWrapper: User not authenticated, redirecting to /login");
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render the nested routes (children of this Route element)
    console.log("AuthWrapper: User authenticated, rendering Outlet.");
    return <Outlet />;
}
// --- END UPDATED AUTH WRAPPER ---


function App() {
    return (
        <Router>
            <Routes>
                {/* Public Route for GoogleAuth - this is your initial login/auth page */}
                {/* GoogleAuth.js should handle redirecting to '/' on successful login */}
                <Route path="/login" element={<GoogleAuth />} />

                {/* Protected Routes: All routes nested within this <Route> element
                    will be rendered only if the AuthWrapper component allows it.
                    AuthWrapper checks for user authentication. */}
                <Route element={<AuthWrapper />}>
                    {/* Default route for the main application (Delivery List) */}
                    <Route path="/" element={<DeliveryList />} />
                    {/* Route for displaying tasks of a specific delivery */}
                    {/* The :delCode part is a URL parameter that Tasklist.js will read */}
                    <Route path="/delivery/data/:delCode" element={<Tasklist />} />
                    {/* Add any other authenticated routes here if needed */}
                </Route>

                {/* Catch-all route for any undefined paths, redirecting to login */}
                {/* This ensures that if a user tries to access any undefined path, they are sent to login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
