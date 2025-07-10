import React, { createContext, useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode'; // Make sure you have installed 'jwt-decode'

// Create the UserContext
export const UserContext = createContext(null);

// Define the UserProvider component
export const UserProvider = ({ children }) => {
    // Initialize state from localStorage on component mount
    const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
    const [userName, setUserName] = useState(localStorage.getItem('userName') || null);
    // FIX 1: Add authToken to state and initialize from localStorage
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null);

    // FIX 2: Modify loginUser to accept and set the authToken
    const loginUser = (email, name, token) => { // Added 'token' parameter
        console.log("UserProvider: loginUser called with email:", email, "token:", token ? token.substring(0, 30) + "..." : "null");
        setUserEmail(email);
        setUserName(name);
        setAuthToken(token); // Set authToken in context state
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', name);
        localStorage.setItem('authToken', token); // Store authToken in localStorage
    };

    // FIX 3: Clear authToken from context state during logout
    const logoutUser = () => {
        console.log("UserProvider: logoutUser called.");
        setUserEmail(null);
        setUserName(null);
        setAuthToken(null); // Clear authToken from context state
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('authToken'); // Also remove from localStorage
    };

    // FIX 4: Include authToken in the context value
    const contextValue = {
        userEmail,
        userName,
        authToken, // ADDED: Provide authToken to consumers
        loginUser,
        logoutUser,
    };

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};

// A simple Login Component to demonstrate Google login within the app
export const LoginComponent = () => {
    // Get loginUser from context
    const { loginUser } = React.useContext(UserContext);

    const handleGoogleSuccess = (credentialResponse) => {
        console.log("LoginComponent: Raw credentialResponse:", credentialResponse);
        console.log("LoginComponent: credentialResponse.credential:", credentialResponse.credential);

        try {
            const decoded = jwtDecode(credentialResponse.credential);
            console.log("Google Login Success! Decoded JWT:", decoded);

            const email = decoded.email;
            const name = decoded.name || decoded.given_name;
            const authToken = credentialResponse.credential; // The ID token from Google

            if (email) {
                // FIX 5: Pass the authToken to loginUser
                loginUser(email, name, authToken); // This function now handles setting state and localStorage

                // Force a page reload to re-initialize DeliveryList with the new context values
                // This is a common pattern for authentication flows that set global state like this.
                window.location.href = '/';
            } else {
                console.error("Email not found in Google credential response.");
            }
        } catch (error) {
            console.error("Error decoding JWT or processing credential:", error);
        }
    };

    const handleGoogleError = (errorResponse) => {
        console.error('Google Login Failed:', errorResponse);
    };

    return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
            <h2>Sign In to Scheduler</h2>
            <p>Please use your BrightBrainTech.com account.</p>
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
            />
        </div>
    );
};
