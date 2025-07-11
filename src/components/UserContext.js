// components/UserContext.js
import React, { createContext, useState, useEffect } from 'react';

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [userEmail, setUserEmail] = useState(null); // Or get from localStorage initially

    useEffect(() => {
        // Attempt to load user email from localStorage on initial load
        const storedEmail = localStorage.getItem('userEmail');
        if (storedEmail) {
            setUserEmail(storedEmail);
        }
    }, []);

    const logoutUser = () => {
        setUserEmail(null);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('authToken'); // Clear auth token on logout
        // Optionally redirect to login page after logout
    };

    // Provide userEmail and setUserEmail to consumers
    return (
        <UserContext.Provider value={{ userEmail, setUserEmail, logoutUser }}>
            {children}
        </UserContext.Provider>
    );
};
