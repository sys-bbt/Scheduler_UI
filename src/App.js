// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login'; // Assuming you have a Login component
import DeliveryList from './components/DeliveryList';
import Tasklist from './components/Tasklist'; // Make sure this import path is correct
import AuthenticatedRoute from './components/AuthenticatedRoute'; // Your authentication wrapper

function App() {
    return (
        <Router>
            <Routes>
                {/* Public Route for Login */}
                <Route path="/login" element={<Login />} />

                {/* Authenticated Routes */}
                <Route element={<AuthenticatedRoute />}>
                    {/* Route for the main Delivery List page */}
                    <Route path="/" element={<DeliveryList />} />
                    {/* Route for the Tasklist page with a dynamic parameter */}
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
