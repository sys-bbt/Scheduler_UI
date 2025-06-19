import React, { createContext, useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode'; // Make sure you have installed 'jwt-decode' (npm install jwt-decode)

// Create the UserContext
// It now provides 'userEmail', 'userName', and functions 'loginUser' and 'logoutUser'
export const UserContext = createContext(null);

// Define the UserProvider component
export const UserProvider = ({ children }) => {
    // Initialize userEmail and userName states from localStorage
    // This helps persist login state across browser sessions
    const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
    const [userName, setUserName] = useState(localStorage.getItem('userName') || null);

    // Function to handle successful Google login and update context/localStorage
    const loginUser = (email, name) => {
        setUserEmail(email);
        setUserName(name);
        localStorage.setItem('userEmail', email); // Persist email
        localStorage.setItem('userName', name);   // Persist name
    };

    // Function to handle logout and clear context/localStorage
    const logoutUser = () => {
        setUserEmail(null);
        setUserName(null);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('authToken'); // NEW: Also remove authToken on logout
    };

    // The value provided to consumers of this context
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
        try {
            const decoded = jwtDecode(credentialResponse.credential);
            console.log("Google Login Success! Decoded JWT:", decoded); // This log is showing up!
            const email = decoded.email;
            const name = decoded.name || decoded.given_name; // Use full name or given name
            const authToken = credentialResponse.credential; // Get the raw credential as authToken

            if (email) {
                loginUser(email, name); // This calls the context function to update state and localStorage
                localStorage.setItem('authToken', authToken); // NEW: Persist authToken in localStorage
                
                // --- NEW: Force a page reload after successful login ---
                // This ensures the App component re-evaluates the UserContext value
                window.location.href = '/';
            } else {
                console.error("Email not found in Google credential response.");
            }
        } catch (error) {
            console.error("Error decoding JWT or processing credential:", error);
        }
    };

    const handleGoogleError = () => {
        console.error('Google Login Failed');
    };

    return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
            <h2>Sign In to Scheduler</h2>
            <p>Please use your BrightBrainTech.com account.</p>
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                // You can add 'useOneTap' prop if you want to try one-tap sign-in
                // useOneTap
            />
            {/* Display logged-in user for debugging (optional) */}
            {/* {userEmail && <p>Logged in as: {userEmail}</p>} */}
        </div>
    );
};
