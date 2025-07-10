// src/components/Tasklist.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // useParams to read URL params
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { FaSpinner } from 'react-icons/fa';
import { notification } from 'antd'; // For displaying notifications
import { UserContext } from './UserContext'; // Import your UserContext

// Use process.env for backend URL, with a fallback
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const Tasklist = () => {
    const { delCode } = useParams(); // Hook to get URL parameters
    const navigate = useNavigate(); // Hook to navigate programmatically
    const { userEmail, authToken } = useContext(UserContext); // Get user details from context

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTasksForDelivery = useCallback(async () => {
        if (!userEmail || !authToken || !delCode) {
            setLoading(false);
            if (!authToken) {
                // If no auth token, redirect to login
                notification.error({
                    message: 'Authentication Required',
                    description: 'Please log in to view tasks.',
                });
                navigate('/login');
            } else if (!delCode) {
                // If delCode is missing from URL, go back to delivery list
                notification.warning({
                    message: 'Missing Delivery Code',
                    description: 'No delivery code provided to fetch tasks.',
                });
                navigate('/deliveries');
            }
            return;
        }

        setLoading(true);
        setError(null);
        console.log(`Tasklist: Attempting to fetch tasks for DelCode: ${delCode}`);

        try {
            const queryParams = new URLSearchParams({
                email: userEmail,
                delCode: delCode, // Pass the delCode as a query parameter
                // You might need to add isAdmin here if your backend filtering depends on it
                // isAdmin: true // or based on context
            });

            // IMPORTANT: Your backend's /api/data endpoint needs to be able to filter by delCode
            // or you might need a new endpoint like /api/tasksByDelCode
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/data?${queryParams.toString()}`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log("Tasklist: Raw data received from backend:", data);

            // Assuming data is an object where values are arrays, and you need to flatten
            // Then filter by DelCode_w_o__ to get only relevant tasks if the backend sends more
            const tasksArray = Object.values(data).flat();
            const filteredTasks = tasksArray.filter(task => task.DelCode_w_o__ === delCode);
            console.log(`Tasklist: Found ${filteredTasks.length} tasks for delivery code: ${delCode}.`);

            // Map and format tasks for display
            const formattedTasks = filteredTasks.map(task => ({
                task_id: task.Key, // Assuming 'Key' is unique for tasks within a delivery
                del_code: task.DelCode_w_o__,
                step_id: task.Step_ID,
                description: task.Task_Details, // Assuming this holds task description
                // Add any other task-specific fields you want to display
                debug_emails: task.debug_emails,
                debug_responsibility: task.debug_responsibility,
            }));

            setTasks(formattedTasks);

        } catch (err) {
            console.error('Tasklist: Error fetching tasks:', err);
            setError(err.message);
            notification.error({
                message: 'Task Fetch Error',
                description: `Failed to load tasks: ${err.message}. Please try again.`,
            });
        } finally {
            setLoading(false);
        }
    }, [delCode, userEmail, authToken, navigate]); // Dependencies for useCallback

    useEffect(() => {
        fetchTasksForDelivery();
    }, [fetchTasksForDelivery]); // Call fetchTasksForDelivery when it changes (which is rare due to useCallback) or on mount

    if (loading) {
        return (
            <Container className="text-center my-5">
                <FaSpinner className="spinner-icon" style={{ fontSize: '3rem', color: '#007bff', animation: 'spin 1s linear infinite' }} />
                <p className="mt-3">Loading tasks for {delCode}...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="text-center my-5">
                <p className="text-danger">Error loading tasks: {error}</p>
                <Button variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>
            </Container>
        );
    }

    if (tasks.length === 0) {
        return (
            <Container className="text-center my-5">
                <p>No tasks found for delivery code: {delCode}.</p>
                <Button variant="secondary" onClick={() => navigate(-1)}>Go Back to Deliveries</Button>
            </Container>
        );
    }

    return (
        <Container className="my-4">
            <Row className="mb-3 align-items-center">
                <Col>
                    <Button variant="secondary" onClick={() => navigate(-1)}>
                        &larr; Back to Deliveries
                    </Button>
                </Col>
                <Col className="text-center">
                    <h2>Tasks for Delivery: <span style={{ wordBreak: 'break-all' }}>{delCode}</span></h2>
                </Col>
                <Col></Col> {/* For alignment */}
            </Row>
            <Row>
                {tasks.map((task) => (
                    <Col xs={12} md={6} lg={4} key={task.task_id} className="mb-3">
                        <Card className="p-3 shadow-sm task-item-card">
                            <Card.Body>
                                <Card.Title>Task ID: {task.task_id}</Card.Title>
                                <Card.Subtitle className="mb-2 text-muted">Step ID: {task.step_id}</Card.Subtitle>
                                <Card.Text>
                                    <strong>Description:</strong> {task.description || 'N/A'}
                                </Card.Text>
                                <Card.Text>
                                    <strong>Responsible Email:</strong> {task.debug_emails || 'N/A'}
                                </Card.Text>
                                <Card.Text>
                                    <strong>Responsibility:</strong> {task.debug_responsibility || 'N/A'}
                                </Card.Text>
                                {/* Add more task details as needed */}
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Container>
    );
};

export default Tasklist;
