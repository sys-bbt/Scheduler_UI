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
    // FIXED: Add authToken to state and initialize from localStorage
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null);
    // Assume isAdmin is also retrieved or derived, as it's used in DeliveryList
    const [isAdmin, setIsAdmin] = useState(localStorage.getItem('isAdmin') === 'true' || false);


    // FIXED: Modify loginUser to accept and set the authToken and isAdmin status
    const loginUser = (email, name, token, adminStatus) => {
        console.log("UserProvider: loginUser called with email:", email, "token:", token ? token.substring(0, 30) + "..." : "null", "isAdmin:", adminStatus);
        setUserEmail(email);
        setUserName(name);
        setAuthToken(token); // Set authToken in context state
        setIsAdmin(adminStatus); // Set isAdmin status
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', name);
        localStorage.setItem('authToken', token); // Store authToken in localStorage
        localStorage.setItem('isAdmin', adminStatus); // Store isAdmin in localStorage
    };

    // FIXED: Clear authToken and isAdmin from context state during logout
    const logoutUser = () => {
        console.log("UserProvider: logoutUser called.");
        setUserEmail(null);
        setUserName(null);
        setAuthToken(null); // Clear authToken from context state
        setIsAdmin(false); // Clear isAdmin state
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('authToken'); // Also remove from localStorage
        localStorage.removeItem('isAdmin'); // Remove isAdmin from localStorage
    };

    // FIXED: Include authToken and isAdmin in the context value
    const contextValue = {
        userEmail,
        userName,
        authToken, // ADDED: Provide authToken to consumers
        isAdmin,   // ADDED: Provide isAdmin to consumers
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

    const handleGoogleSuccess = async (credentialResponse) => { // Made async to potentially fetch admin status
        console.log("LoginComponent: Raw credentialResponse:", credentialResponse);
        console.log("LoginComponent: credentialResponse.credential:", credentialResponse.credential);

        try {
            const decoded = jwtDecode(credentialResponse.credential);
            console.log("Google Login Success! Decoded JWT:", decoded);

            const email = decoded.email;
            const name = decoded.name || decoded.given_name;
            const authToken = credentialResponse.credential; // The ID token from Google

            if (email) {
                // Determine isAdmin status.
                // IMPORTANT: This is a placeholder. You should ideally fetch the isAdmin status
                // from your backend after successful authentication, as backend holds the true source.
                // For now, it checks against the frontend list.
                const isAdminStatus = ["neelam.p@brightbraintech.com", "meghna.j@brightbraintech.com", "zoya.a@brightbraintech.com", "shweta.g@brightbraintech.com", "hitesh.r@brightbraintech.com"].includes(email);

                // FIXED: Pass the authToken and isAdminStatus to loginUser
                loginUser(email, name, authToken, isAdminStatus); // This function now handles setting state and localStorage

                // Force a page reload to re-initialize DeliveryList with the new context values
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
