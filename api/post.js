// api/post.js

/**
 * Makes a POST request to a specified API endpoint.
 *
 * @param {string} endpoint The URL path for the API endpoint (e.g., '/users', '/products').
 * @param {object} data The data payload to send in the request body.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON response from the server.
 * @throws {Error} If the network response is not OK (status 4xx or 5xx), or if a network error occurs.
 */
async function postData(endpoint, data) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'; // Or your actual base URL

    const url = `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            method: 'POST', // Specify the HTTP method
            headers: {
                'Content-Type': 'application/json', // Indicate that the request body is JSON
                // 'Authorization': `Bearer ${yourAuthToken}`, // Uncomment and add if authentication is needed
            },
            body: JSON.stringify(data), // Convert the JavaScript object to a JSON string
        });

        // Check if the response was successful (status code 200-299)
        if (!response.ok) {
            // If the response is not OK, try to parse the error message from the server
            let errorData = {};
            try {
                errorData = await response.json(); // Attempt to parse error as JSON
            } catch (jsonError) {
                // If parsing JSON fails, the error might be plain text or empty
                errorData = { message: `Server responded with status ${response.status} ${response.statusText}` };
            }
            const errorMessage = errorData.message || `HTTP error! Status: ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }

        // If the response is OK, parse the JSON body
        const responseData = await response.json();
        return responseData;

    } catch (error) {
        // Catch network errors (e.g., no internet connection, DNS issues)
        console.error('Network or API request failed:', error);
        throw new Error(`Failed to POST to ${endpoint}: ${error.message}`);
    }
}

export default postData;

// --- How to use this script in your application ---

/*
// Example of how you might use this in a component or another script:

import postData from './api/post.js'; // Adjust path as needed

async function createUser() {
    const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'securepassword123'
    };

    try {
        const result = await postData('/users', userData);
        console.log('User created successfully:', result);
        // Update UI or state with the result
    } catch (error) {
        console.error('Error creating user:', error.message);
        // Display an error message to the user
        alert(`Error: ${error.message}`);
    }
}

// Call the function when needed, e.g., on form submission
// createUser();
*/
