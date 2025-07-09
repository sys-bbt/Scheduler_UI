import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import DeliveryList from './components/DeliveryList';
import { UserProvider, UserContext, LoginComponent } from './components/UserContext';
import DeliveryDetail from './components/DeliveryDetail';

// New component to wrap authenticated routes
// This component consumes the UserContext
const AuthenticatedRoutes = () => {
    const { userEmail } = useContext(UserContext); // Access userEmail within UserProvider's scope

    // Debugging log for userEmail within AuthenticatedRoutes
    console.log('AuthenticatedRoutes: userEmail from Context:', userEmail);

    if (!userEmail) {
        // If userEmail is null (not logged in), redirect to login page
        console.log('AuthenticatedRoutes: User not logged in, redirecting to /login');
        return <Navigate to="/login" replace />;
    }

    // If userEmail is available, render the protected routes
    return (
        <Routes>
            <Route path="/" element={<DeliveryList />} />
            {/* UPDATED ROUTE: This now correctly captures the delCode */}
            <Route path="/delivery/data/:delCode" element={<DeliveryDetail />} />
            {/* Add other protected routes here if needed */}
        </Routes>
    );
};

function App() {
    return (
        <GoogleOAuthProvider clientId='47439091557-2kdm5q9pi6lm0d2n3pvtvb6vr9p69h4h.apps.googleusercontent.com'>
            {/* UserProvider wraps the Router to make user context available everywhere */}
            <UserProvider>
                <Router>
                    <Routes>
                        {/* Public route for login */}
                        <Route path="/login" element={<LoginComponent />} />
                        {/* All other routes are wrapped by AuthenticatedRoutes, which handles protection */}
                        <Route path="/*" element={<AuthenticatedRoutes />} />
                    </Routes>
                </Router>
            </UserProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
