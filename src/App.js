// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';

// Correct imports based on files confirmed to be in 'src/components/'
// AuthenticatedRoute.js and Login.js are NOT present, so we remove their imports.
import GoogleAuth from './components/GoogleAuth'; // Using GoogleAuth for authentication
import DeliveryList from './components/DeliveryList';
import Tasklist from './components/Tasklist';

// A simple AuthWrapper that will render nested routes if a user is "authenticated".
// In a real app, this would check a token or user state from UserContext.
// For now, it just renders the Outlet, assuming GoogleAuth handles actual access control.
function AuthWrapper() {
    // You might eventually check a user token or state from UserContext here
    // Example: const { userEmail } = useContext(UserContext);
    // if (!userEmail) {
    //     return <Navigate to="/login" replace />;
    // }
    return <Outlet />; // Renders the nested routes
}

function App() {
    return (
        <Router>
            <Routes>
                {/* Route for GoogleAuth - this should be your initial login/auth page */}
                {/* GoogleAuth.js should handle redirecting to '/' on successful login */}
                <Route path="/login" element={<GoogleAuth />} />

                {/* Routes that require authentication */}
                {/* We wrap them in AuthWrapper to simulate protection. */}
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
