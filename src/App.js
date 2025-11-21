import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import DeliveryList from './components/DeliveryList';
import { UserProvider, UserContext, LoginComponent } from './components/UserContext';
import DeliveryDetail from './components/DeliveryDetail';

// --- Loading Component (Placeholder) ---
const LoadingPage = () => (
    <div style={{ padding: '50px', textAlign: 'center', fontSize: '1.2em' }}>
        <p>Loading application data and user privileges...</p>
        {/* You can replace this with a spinner/loader component */}
    </div>
);

// New component to wrap authenticated routes and handle loading/redirects
const AuthenticatedRoutes = () => {
    // Access userEmail, isAdmin, and isLoadingAdmin from the UserContext
    const { userEmail, isLoadingAdmin } = useContext(UserContext); 

    // Debugging log for userEmail within AuthenticatedRoutes
    console.log('AuthenticatedRoutes: userEmail from Context:', userEmail);

    // 1. Check Login Status
    if (!userEmail) {
        // If userEmail is null (not logged in), redirect to login page
        console.log('AuthenticatedRoutes: User not logged in, redirecting to /login');
        return <Navigate to="/login" replace />;
    }

    // 2. Check Loading Status
    // If logged in, but we are still fetching admin privileges, show a loading page.
    if (isLoadingAdmin) {
        console.log('AuthenticatedRoutes: User logged in, but privileges are loading.');
        return <LoadingPage />;
    }

    // 3. Render Protected Routes (Login complete and Admin status is final)
    console.log('AuthenticatedRoutes: User logged in and privileges loaded. Rendering routes.');
    return (
        <Routes>
            <Route path="/" element={<DeliveryList />} />
            <Route path="/delivery/*" element={<DeliveryDetail />} />
            {/* Add other protected routes here if needed */}
        </Routes>
    );
};

function App() {
    return (
        // The GoogleOAuthProvider needs to wrap everything that uses Google Login
        <GoogleOAuthProvider clientId='47439091557-2kdm5q9pi6lm0d2n3pvtvb6vr9p69h4h.apps.googleusercontent.com'>
            {/* UserProvider wraps the Router to make user context available everywhere */}
            <UserProvider>
                <Router>
                    <Routes>
                        {/* Public route for login */}
                        <Route path="/login" element={<LoginComponent />} />
                        {/* All other routes are wrapped by AuthenticatedRoutes, which handles protection and loading */}
                        <Route path="/*" element={<AuthenticatedRoutes />} />
                    </Routes>
                </Router>
            </UserProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
