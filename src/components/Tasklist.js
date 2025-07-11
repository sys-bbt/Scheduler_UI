// src/components/Tasklist.js
import React, { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { UserContext } from './UserContext'; // Correct: UserContext is in the same folder as Tasklist

function Tasklist() {
    const { delCode } = useParams(); // Get delCode from URL parameter
    const { userEmail } = useContext(UserContext); // Get userEmail from context
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- ADDED CONSOLE LOGS FOR DEBUGGING ---
    console.log('Tasklist Component Loaded.');
    console.log('Tasklist: delCode from useParams:', delCode);
    console.log('Tasklist: userEmail from UserContext:', userEmail);
    // --- END ADDITIONS ---

    useEffect(() => {
        const fetchTasks = async () => {
            if (!userEmail || !delCode) {
                console.log('Tasklist: Skipping fetch - Missing userEmail or delCode.', { userEmail, delCode });
                setLoading(false);
                if (!delCode && userEmail) {
                    setError('Delivery code not found in URL. Please navigate from the delivery list.');
                }
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const isAdmin = userEmail && ["neelam.p@brightbraintech.com", "meghna.j@brightbraintech.com", "zoya.a@brightbraintech.com", "shweta.g@brightbraintech.com", "hitesh.r@brightbraintech.com"].includes(userEmail);

                const baseUrl = process.env.NODE_ENV === 'production'
                    ? 'https://server-ui-2.onrender.com' // Your Render backend URL
                    : 'http://localhost:3001';

                const encodedDelCode = encodeURIComponent(delCode); // CRITICAL: Encode the delCode for the URL

                // The backend /api/data endpoint is used to fetch tasks for a specific delCode
                const apiUrl = `${baseUrl}/api/data?email=${encodeURIComponent(userEmail)}&delCode=${encodedDelCode}&isAdmin=${isAdmin}`;
                console.log('Tasklist: Fetching from URL:', apiUrl);

                const response = await fetch(apiUrl);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || response.statusText}`);
                }
                const data = await response.json(); // Backend should return an array of tasks for this delCode

                setTasks(data); // Set the fetched tasks
                console.log('Tasklist: Fetched tasks:', data);
            } catch (err) {
                console.error("Tasklist: Error fetching tasks:", err);
                setError('Failed to load tasks: ' + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, [delCode, userEmail]); // Re-run effect if delCode or userEmail changes

    if (loading) return <div>Loading tasks...</div>;
    if (error) return <div style={{color: 'red'}}>Error: {error}</div>;
    // This message is shown if no tasks are returned by the backend or user has no permission
    if (tasks.length === 0) return <div>No tasks found for this delivery or you do not have permission to view them.</div>;

    return (
        <div style={{ padding: '20px' }}>
            <h1>Tasks for Delivery: {delCode}</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {tasks.map(task => (
                    <div key={task.Key} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <h2>{task.Task_Details || task.Short_Description}</h2> {/* Use Task_Details or Short_Description */}
                        <p><strong>Step ID:</strong> {task.Step_ID}</p>
                        <p><strong>Responsibility:</strong> {task.Responsibility}</p>
                        <p><strong>Planned Start:</strong> {task.Planned_Start_Timestamp ? new Date(task.Planned_Start_Timestamp).toLocaleDateString() : 'N/A'}</p>
                        <p><strong>Planned Delivery:</strong> {task.Planned_Delivery_Timestamp ? new Date(task.Planned_Delivery_Timestamp).toLocaleDateString() : 'N/A'}</p>
                        {/* Add more task details as needed */}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Tasklist;
