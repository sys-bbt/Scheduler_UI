// src/components/UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode'; // Make sure you have installed 'jwt-decode' (npm install jwt-decode)

// Create the UserContext
export const UserContext = createContext(null);

// Define the UserProvider component
export const UserProvider = ({ children }) => {
    const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
    const [userName, setUserName] = useState(localStorage.getItem('userName') || null);

    const loginUser = (email, name) => {
        setUserEmail(email);
        setUserName(name);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', name);
    };

    const logoutUser = () => {
        setUserEmail(null);
        setUserName(null);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('authToken');
    };

    const contextValue = {
        userEmail,
        userName,
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
    const { loginUser } = React.useContext(UserContext);

    const handleGoogleSuccess = (credentialResponse) => {
        // --- NEW DEBUGGING LOGS START ---
        console.log("LoginComponent: Raw credentialResponse:", credentialResponse);
        console.log("LoginComponent: credentialResponse.credential:", credentialResponse.credential);
        // --- NEW DEBUGGING LOGS END ---

        try {
            const decoded = jwtDecode(credentialResponse.credential);
            console.log("Google Login Success! Decoded JWT:", decoded);
            const email = decoded.email;
            const name = decoded.name || decoded.given_name;
            const authToken = credentialResponse.credential; // Get the raw credential as authToken

            if (email) {
                loginUser(email, name);

                // Ensure authToken is a string before storing
                if (typeof authToken === 'string' && authToken.length > 0) {
                    console.log("LoginComponent: Storing authToken in localStorage:", authToken.substring(0, 50) + "..."); // Log first 50 chars
                    localStorage.setItem('authToken', authToken);
                } else {
                    console.warn("LoginComponent: authToken is not a valid string. Not storing.");
                }

                window.location.href = '/'; // Force a page reload
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
