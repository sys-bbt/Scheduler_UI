// src/components/UserContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    // Define state directly here. DO NOT use useContext(UserContext) here.
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
        <UserContext.Provider value={{ userEmail, setUserEmail, logoutUser }}>
            {children}
        </UserContext.Provider>
    );
};
