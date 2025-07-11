// src/components/UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    // These states are defined directly within the provider, not consumed via useContext
    const [userEmail, setUserEmail] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedEmail = localStorage.getItem('userEmail');
        if (storedEmail) {
            setUserEmail(storedEmail);
        }
    }, []);

    const logoutUser = () => {
        console.log("Logging out user...");
        setUserEmail(null);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('authToken');
        navigate('/login');
    };

    return (
        // Provide the userEmail state and its setter function to the context consumers
        <UserContext.Provider value={{ userEmail, setUserEmail, logoutUser }}>
            {children}
        </UserContext.Provider>
    );
};
