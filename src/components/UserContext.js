// src/components/UserContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

// --- CONFIGURATION ---
// Ensure your .env file has REACT_APP_API_URL set to your Render URL (e.g., https://server-ui-2.onrender.com)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
// const ADMIN_CACHE_DURATION = 5 * 60 * 1000; // Client-side cache logic omitted, relying on backend cache

// Create the UserContext
export const UserContext = createContext(null);

// Custom hook for easier consumption
export const useUser = () => {
    return useContext(UserContext);
};

// Define the UserProvider component
export const UserProvider = ({ children }) => {
    const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
    const [userName, setUserName] = useState(localStorage.getItem('userName') || null);
    
    // 🚀 NEW STATE FOR ADMIN CHECK 🚀
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
    const [adminEmails, setAdminEmails] = useState([]); // Stores the list of admin emails fetched from backend

    const loginUser = (email, name) => {
        setUserEmail(email);
        setUserName(name);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', name);
    };

    const logoutUser = () => {
        setUserEmail(null);
        setUserName(null);
        setIsAdmin(false); // Reset admin status
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('authToken');
    };

    // 1. --- FETCH ADMIN EMAILS FROM BACKEND ---
    useEffect(() => {
        const fetchAdmins = async () => {
            if (!userEmail) {
                // If no user is logged in, skip fetching admins
                setIsLoadingAdmin(false);
                return;
            }
            
            try {
                console.log("Context: Fetching admin list from backend...");
                const response = await axios.get(`${API_URL}/api/admins`);
                const fetchedEmails = response.data;
                
                setAdminEmails(fetchedEmails);
                console.log(`Context: Fetched ${fetchedEmails.length} admin emails.`);
                
                // Log the fetched list if it contains data
                if (fetchedEmails.length > 0) {
                    console.log("Context: Admin list:", fetchedEmails);
                }
                
            } catch (error) {
                // IMPROVED ERROR MESSAGE: Clarify the fallback action
                console.error("Context: Error fetching admin emails. Defaulting to empty list (Non-Admin status). Error:", error.message);
                setAdminEmails([]); // Fail safe to an empty list
            } finally {
                setIsLoadingAdmin(false);
            }
        };

        // Only fetch if a user is logged in
        if (userEmail) {
            fetchAdmins();
        }

    }, [userEmail]); // Re-run only when userEmail changes (i.e., on login/logout)

    // 2. --- DETERMINE ADMIN STATUS ---
    useEffect(() => {
        if (!isLoadingAdmin && userEmail) {
            // Check if the current user's email is in the fetched list
            const isUserAdmin = adminEmails.includes(userEmail);
            setIsAdmin(isUserAdmin);
            console.log(`Context: User ${userEmail} Admin Status: ${isUserAdmin}`);
        } else if (!userEmail) {
            setIsAdmin(false); // Not logged in, definitely not admin
        }
        // This effect runs whenever adminEmails or userEmail changes *after* loading finishes
    }, [userEmail, adminEmails, isLoadingAdmin]);


    const contextValue = {
        userEmail,
        userName,
        loginUser,
        logoutUser,
        
        // 🚀 NEW CONTEXT VALUES 🚀
        isAdmin,
        isLoadingAdmin,
        adminEmails,
    };

    return (
        <UserContext.Provider value={contextValue}>
            {/* Display a loading indicator while fetching admin status after login */}
            {isLoadingAdmin && userEmail ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    Loading user privileges...
                </div>
            ) : children}
        </UserContext.Provider>
    );
};

// A simple Login Component 
export const LoginComponent = () => {
    const { loginUser } = useUser(); // Use the custom hook

    const handleGoogleSuccess = (credentialResponse) => {
        try {
            const decodedToken = jwtDecode(credentialResponse.credential);
            const email = decodedToken.email;
            const name = decodedToken.name;
            const authToken = credentialResponse.credential;

            if (email) {
                loginUser(email, name);
                
                if (typeof authToken === 'string' && authToken.length > 0) {
                    localStorage.setItem('authToken', authToken);
                } else {
                    console.warn("LoginComponent: authToken is not a valid string. Not storing.");
                }
                
                // Use a proper navigation method if possible, or keep the reload:
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
            <p>Please use your authorized account.</p>
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
            />
        </div>
    );
};
