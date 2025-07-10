import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import DeliveryList from './components/DeliveryList';
import { UserProvider, UserContext, LoginComponent } from './components/UserContext'; // Ensure LoginComponent is exported from UserContext
import Tasklist from './components/Tasklist'; // <-- Import the new Tasklist component

// New component to wrap authenticated routes
// This component consumes the UserContext
const AuthenticatedRoutes = () => {
    const { userEmail, authToken } = useContext(UserContext); // Access userEmail and authToken within UserProvider's scope

    // Debugging log for userEmail within AuthenticatedRoutes
    console.log('AuthenticatedRoutes: userEmail from Context:', userEmail);

    // If userEmail or authToken is null (not logged in), redirect to login page
    if (!userEmail || !authToken) {
        console.log('AuthenticatedRoutes: User not logged in or missing auth token, redirecting to /login');
        return <Navigate to="/login" replace />;
    }

    // If userEmail and authToken are available, render the protected routes
    return (
        <Routes>
            {/* Route for the main DeliveryList page */}
            <Route path="/" element={<DeliveryList />} />
            <Route path="/deliveries" element={<DeliveryList />} /> {/* Optional: explicit route for list */}

            {/* UPDATED ROUTE: This now correctly captures the delCode for Tasklist */}
            {/* The :delCode part is a URL parameter that Tasklist.js will read */}
            <Route path="/delivery/data/:delCode" element={<Tasklist />} />

            {/* Add other protected routes here if needed */}
            {/* Example: <Route path="/profile" element={<UserProfile />} /> */}
        </Routes>
    );
};

function App() {
    // Ensure your Google OAuth Client ID is correct
    const GOOGLE_CLIENT_ID = '47439091557-2kdm5q9pi6lm0d2n3pvtvb6vr9p69h4h.apps.googleusercontent.com';

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            {/* UserProvider wraps the Router to make user context available everywhere */}
            <UserProvider>
                <Router>
                    <Routes>
                        {/* Public route for login */}
                        <Route path="/login" element={<LoginComponent />} />

                        {/* All other routes are wrapped by AuthenticatedRoutes, which handles protection */}
                        {/* The "/*" path acts as a catch-all for any path not explicitly defined above */}
                        <Route path="/*" element={<AuthenticatedRoutes />} />
                    </Routes>
                </Router>
            </UserProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
