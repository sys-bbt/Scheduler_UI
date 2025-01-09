// UserContext.js
import React, { createContext, useState } from 'react';

// Create the UserContext
export const UserContext = createContext();

// Define the UserProvider component
export const UserProvider = ({ children }) => {
    const [userEmail, setUserEmail] = useState(null);

    return (
        <UserContext.Provider value={{ userEmail, setUserEmail }}>
            {children}
        </UserContext.Provider>
    );
};
