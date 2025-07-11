// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Login from './components/Login'; // Correct: From src/ to src/components/Login.js
import DeliveryList from './components/DeliveryList'; // Correct
import Tasklist from './components/Tasklist'; // Correct
import AuthenticatedRoute from './components/AuthenticatedRoute'; // Correct


function App() {
    return (
        <Router>
            <Routes>
                {/* Public Route for Login */}
                <Route path="/login" element={<Login />} />

                {/* Authenticated Routes */}
                {/* AuthenticatedRoute uses an <Outlet /> to render nested routes */}
                <Route element={<AuthenticatedRoute />}>
                    {/* Route for the main Delivery List page */}
                    <Route path="/" element={<DeliveryList />} />
                    {/* Route for the Tasklist page with a dynamic parameter */}
                    {/* The :delCode part captures the dynamic value from the URL */}
                    <Route path="/delivery/data/:delCode" element={<Tasklist />} />
                    {/* Add other authenticated routes here if any */}
                </Route>

                {/* Catch-all for undefined routes (optional) */}
                <Route path="*" element={<div>404 Not Found</div>} />
            </Routes>
        </Router>
    );
}

export default App;
