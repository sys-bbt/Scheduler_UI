// src/components/GoogleAuth.js
import React, { useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from './UserContext'; // Assuming UserContext is in the same folder

const GoogleAuth = () => {
    const { userEmail, setUserEmail } = useContext(UserContext);
    const navigate = useNavigate();
    const googleButtonRef = useRef(null); // Ref for the Google button div

    // IMPORTANT: Replace with your actual Google Client ID
    // You should load this from an environment variable (e.g., process.env.REACT_APP_GOOGLE_CLIENT_ID)
    // For local testing, you can hardcode it temporarily, but secure it for production.
    const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // Use environment variable

    useEffect(() => {
        // If user is already logged in (e.g., from a refresh with UserContext loading from localStorage)
        if (userEmail) {
            console.log("GoogleAuth: Already logged in as", userEmail, ", redirecting to /.");
            navigate('/');
            return; // Exit useEffect if already authenticated
        }

        // Load the Google API client library
        const loadGoogleAPI = () => {
            // Check if gapi is available
            if (window.gapi) {
                window.gapi.load('auth2', () => {
                    // Initialize GoogleAuth2 if not already initialized
                    if (!window.gapi.auth2.getAuthInstance()) {
                        window.gapi.auth2.init({
                            client_id: GOOGLE_CLIENT_ID,
                            scope: 'email profile', // Request access to user's email and basic profile
                        }).then(() => {
                            console.log("GoogleAuth: GoogleAuth2 initialized successfully.");
                            // Render the Google Sign-In button after initialization
                            renderGoogleSignInButton();
                        }).catch(error => {
                            console.error("GoogleAuth: Error initializing GoogleAuth2:", error);
                        });
                    } else {
                        console.log("GoogleAuth: GoogleAuth2 already initialized.");
                        renderGoogleSignInButton(); // Render button if already initialized
                    }
                });
            } else {
                console.warn("GoogleAuth: gapi not yet available, retrying...");
                // If gapi isn't loaded yet, set a timeout to retry.
                // In a real app, you might use a more robust script loading strategy.
                setTimeout(loadGoogleAPI, 200);
            }
        };

        const renderGoogleSignInButton = () => {
            if (googleButtonRef.current && window.gapi && window.gapi.signin2) {
                window.gapi.signin2.render(googleButtonRef.current, {
                    scope: 'profile email',
                    width: 240,
                    height: 50,
                    longtitle: true,
                    theme: 'dark',
                    onsuccess: onSuccess, // Callback function on successful sign-in
                    onfailure: onFailure, // Callback function on sign-in failure
                });
                console.log("GoogleAuth: Google Sign-In button rendered.");
            } else {
                console.warn("GoogleAuth: Could not render button, gapi or ref not ready. Retrying...");
                setTimeout(renderGoogleSignInButton, 100);
            }
        };

        const onSuccess = (googleUser) => {
            console.log("GoogleAuth: Google Sign-In Success!");
            const profile = googleUser.getBasicProfile();
            const id_token = googleUser.getAuthResponse().id_token; // Get the ID token

            const email = profile.getEmail();
            console.log("User Email:", email);
            // console.log("ID Token:", id_token); // For debugging, avoid logging sensitive tokens in production

            setUserEmail(email); // Update UserContext
            localStorage.setItem('userEmail', email); // Persist email in localStorage
            localStorage.setItem('authToken', id_token); // Persist auth token (ID token) in localStorage

            navigate('/'); // Redirect to the main app page (DeliveryList)
        };

        const onFailure = (error) => {
            console.error("GoogleAuth: Google Sign-In Failed:", error);
            // Handle error, e.g., show a message to the user
            alert("Google Sign-In Failed. Please try again. Check console for details.");
        };

        loadGoogleAPI(); // Initiate loading of the Google API

    }, [userEmail, setUserEmail, navigate, GOOGLE_CLIENT_ID]); // Dependencies for useEffect

    return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
            <h1>Welcome to the Scheduler</h1>
            <p>Please sign in to continue.</p>
            {/* This div is where the Google Sign-In button will be rendered by the Google API */}
            <div ref={googleButtonRef} className="g-signin2" data-onsuccess="onSignIn"></div>
            {/* The data-onsuccess needs to point to a global function or handled via gapi.signin2.render as above */}
            <p style={{ marginTop: '20px', color: '#888' }}>
                Note: Ensure `REACT_APP_GOOGLE_CLIENT_ID` is set in your environment variables,
                or replace the placeholder with your actual Google Client ID.
            </p>
        </div>
    );
};

export default GoogleAuth;
