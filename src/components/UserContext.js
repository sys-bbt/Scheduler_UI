// src/components/UserContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

// --- CONFIGURATION ---
// 🛑 FIX APPLIED HERE: Using the correct environment variable name 
// defined in your .env.local file (REACT_APP_BACKEND_URL)
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'; 
// Client-side cache for 5 minutes (in milliseconds)
const ADMIN_CACHE_DURATION = 5 * 60 * 1000; 

// Storage keys for cache
const ADMIN_EMAILS_CACHE_KEY = 'adminEmailsCache';
const ADMIN_CACHE_TIMESTAMP_KEY = 'adminCacheTimestamp';

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
    
    // NEW STATE FOR ADMIN CHECK
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
        // NOTE: Keeping admin cache might be helpful for quick re-login
        // If you want to clear it, add: localStorage.removeItem(ADMIN_EMAILS_CACHE_KEY);
        // localStorage.removeItem(ADMIN_CACHE_TIMESTAMP_KEY);
    };

    // 1. --- FETCH ADMIN EMAILS FROM BACKEND (WITH CACHE) ---
    useEffect(() => {
        const fetchAdmins = async () => {
            if (!userEmail) {
                // If no user is logged in, skip fetching admins
                setAdminEmails([]);
                setIsLoadingAdmin(false);
                return;
            }
            
            // --- CACHE CHECK ---
            const cachedEmails = localStorage.getItem(ADMIN_EMAILS_CACHE_KEY);
            const cachedTimestamp = localStorage.getItem(ADMIN_CACHE_TIMESTAMP_KEY);
            const now = new Date().getTime();

            if (cachedEmails && cachedTimestamp && (now - Number(cachedTimestamp) < ADMIN_CACHE_DURATION)) {
                // Cache is valid and fresh
                const parsedEmails = JSON.parse(cachedEmails);
                setAdminEmails(parsedEmails);
                setIsLoadingAdmin(false);
                console.log(`Context: Using cached admin list (${parsedEmails.length} emails).`);
                return;
            }

            // --- API FETCH (Cache Miss or Expired) ---
            setIsLoadingAdmin(true);
            try {
                console.log(`Context: Fetching fresh admin list from: ${API_URL}/api/admins`);
                const response = await axios.get(`${API_URL}/api/admins`);
                const fetchedEmails = response.data;
                
                // Ensure data is an array
                const validEmails = Array.isArray(fetchedEmails) ? fetchedEmails : [];

                setAdminEmails(validEmails);
                
                // Log the success message
                console.log(`Context: Successfully fetched ${validEmails.length} admin emails from API.`);
                
                // Update Cache
                localStorage.setItem(ADMIN_EMAILS_CACHE_KEY, JSON.stringify(validEmails));
                localStorage.setItem(ADMIN_CACHE_TIMESTAMP_KEY, now.toString());

            } catch (error) {
                // IMPROVED ERROR MESSAGE: Clarify the fallback action
                console.error("Context: Error fetching admin emails. Defaulting to empty list (Non-Admin status). Error:", error.message);
                setAdminEmails([]); // Fail safe to an empty list
            } finally {
                // Mark loading as complete regardless of success/failure
                setIsLoadingAdmin(false);
            }
        };

        // Only fetch if a user is logged in
        if (userEmail) {
            fetchAdmins();
        }

    }, [userEmail]); // Re-run only when userEmail changes (i.e., on login/logout)

    // 2. --- DETERMINE ADMIN STATUS ---
    // This effect runs whenever userEmail, adminEmails, or isLoadingAdmin changes.
    useEffect(() => {
        // We only proceed if loading is complete and a user is logged in
        if (!isLoadingAdmin && userEmail) {
            // Check if the current user's email is in the fetched list
            const isUserAdmin = adminEmails.includes(userEmail);
            setIsAdmin(isUserAdmin);
            
            // This is the CRITICAL log that confirms the final status
            console.log(`Context: User ${userEmail} Admin Status: ${isUserAdmin}`);
        } else if (!userEmail) {
            // If the user logs out or is not logged in
            setIsAdmin(false);
        }
    }, [userEmail, adminEmails, isLoadingAdmin]);


    const contextValue = {
        userEmail,
        userName,
        loginUser,
        logoutUser,
        
        // NEW CONTEXT VALUES
        isAdmin,
        isLoadingAdmin,
        adminEmails,
    };

    return (
        <UserContext.Provider value={contextValue}>
            {/* Display a loading indicator while fetching admin status after login */}
            {isLoadingAdmin && userEmail ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p>Loading user privileges... Please wait.</p>
                </div>
            ) : children}
        </UserContext.Provider>
    );
};

// A simple Login Component (no changes needed)
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
