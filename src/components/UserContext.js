// src/components/UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for logout redirection

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [userEmail, setUserEmail] = useState(null);
    const navigate = useNavigate(); // Hook for navigation

    useEffect(() => {
        // Attempt to load user email from localStorage on initial load
        const storedEmail = localStorage.getItem('userEmail');
        if (storedEmail) {
            setUserEmail(storedEmail);
        }
    }, []); // Empty dependency array means this runs once on mount

    const logoutUser = () => {
        console.log("Logging out user...");
        setUserEmail(null);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('authToken'); // Clear auth token on logout
        // Redirect to login page after logout
        navigate('/login');
    };

    return (
        <UserContext.Provider value={{ userEmail, setUserEmail, logoutUser }}>
            {children}
        </UserContext.Provider>
    );
};
