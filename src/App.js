import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google'; // Import the provider
import DeliveryList from './components/DeliveryList';
import { UserProvider } from './components/UserContext'; // Import UserProvider
import DeliveryDetail from './components/DeliveryDetail';

function App() {
  return (
    <GoogleOAuthProvider clientId='47439091557-2kdm5q9pi6lm0d2n3pvtvb6vr9p69h4h.apps.googleusercontent.com'> 
      {/* Wrap your application with the provider */}
      <UserProvider> {/* Wrap your app with UserProvider */}
        <Router>
          <Routes>
            <Route path="/" element={<DeliveryList />} />
            <Route path="/delivery/*" element={<DeliveryDetail />} />
          </Routes>
        </Router>
      </UserProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
