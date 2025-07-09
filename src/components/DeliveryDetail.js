import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom'; // Import useParams
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent'; // Ensure your form component is imported
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

const DeliveryDetail = () => {
    console.log('DeliveryDetail component is attempting to render'); // Add this line
    const { delCode } = useParams();
    console.log('delCode from useParams:', delCode);
    const { userEmail } = useContext(UserContext);
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null); // To track which task is active for scheduling/other actions
    const [actionType, setActionType] = ''; // To differentiate between actions like 'schedule', 'reschedule'
    const [tasks, setTasks] = useState([]); // State to manage tasks

    // Fetching delivery details from the server
    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            try {
                setLoading(true);
                // Ensure this URL matches your backend deployed URL or local development server
                const BACKEND_API_BASE_URL = 'https://server-ui-2.onrender.com'; // Replace with your actual backend URL if different

                // Construct the URL with delCode and email as query parameters
                // delCode from useParams will already be correctly decoded if it was encoded in the URL
                const apiUrl = `${BACKEND_API_BASE_URL}/api/data?delCode=${encodeURIComponent(delCode)}&email=${encodeURIComponent(userEmail)}`;
                console.log("Fetching data from:", apiUrl); // Add this for debugging

                const response = await fetch(apiUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        // Include Authorization header if your API requires authentication
                        // For example: 'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }

                const data = await response.json();
                // Assuming the server returns an array of tasks for that delivery code
                setTasks(data.filter(task => task.Step_ID !== 0)); // Filter out tasks with Step_ID 0 if needed
                // If you want to store aggregated delivery info, you might set 'delivery' state from the first item
                if (data.length > 0) {
                    setDelivery(data[0]); // Example: Store the first task's details as general delivery info
                } else {
                    setDelivery(null);
                }
            } catch (error) {
                setError(error);
                console.error('Error fetching delivery details:', error);
            } finally {
                setLoading(false);
            }
        };

        // Trigger the fetch when delCode or userEmail changes
        if (delCode && userEmail) {
            fetchDeliveryDetails();
        }
    }, [delCode, userEmail]); // Dependencies for the useEffect hook

    const handleMenuClick = (key, taskKey) => {
        if (key === 'schedule') {
            setActiveTaskKey(taskKey);
            setActionType('Schedule');
        } else if (key === 'reschedule') {
            setActiveTaskKey(taskKey);
            setActionType('Reschedule');
        } else if (key === 'pause') {
            // Implement pause logic
            alert(`Pause task: ${taskKey}`);
        } else if (key === 'play') {
            // Implement play logic
            alert(`Play task: ${taskKey}`);
        } else if (key === 'stop') {
            // Implement stop logic
            alert(`Stop task: ${taskKey}`);
        }
    };

    const handleFormSubmit = async (formData) => {
        console.log('Form submitted with data:', formData);
        // Here you would typically send this data to your backend API
        // After successful submission, you might want to refresh the task list
        // and clear the activeTaskKey and actionType
        try {
            const response = await fetch('https://server-ui-2.onrender.com/api/update-task-status', { // Replace with your actual backend URL
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update task.');
            }

            // If the update is successful, re-fetch delivery details to show updated status
            setLoading(true); // Set loading to true while re-fetching
            const BACKEND_API_BASE_URL = 'https://server-ui-2.onrender.com';
            // Construct the URL with delCode and email as query parameters for re-fetch
            const updatedResponse = await fetch(`${BACKEND_API_BASE_URL}/api/data?delCode=${encodeURIComponent(delCode)}&email=${encodeURIComponent(userEmail)}`);
            if (!updatedResponse.ok) {
                throw new Error('Failed to re-fetch updated delivery details.');
            }
            const updatedData = await updatedResponse.json();
            setTasks(updatedData.filter(task => task.Step_ID !== 0));
            if (updatedData.length > 0) {
                setDelivery(updatedData[0]);
            } else {
                setDelivery(null);
            }

            // Clear the form and active task
            setActiveTaskKey(null);
            setActionType('');
            alert('Task updated successfully!');
        } catch (error) {
            console.error('Error updating task:', error);
            alert(`Failed to update task: ${error.message}`);
        } finally {
            setLoading(false); // Set loading to false after re-fetching
        }
    };


    const menu = (taskKey) => (
        <Menu onSelect={({ key }) => handleMenuClick(key, taskKey)}>
            <MenuItem key="schedule">Schedule</MenuItem>
            <MenuItem key="reschedule">Reschedule</MenuItem>
            <MenuItem key="pause" className="text-warning"><FaPause /> Pause</MenuItem>
            <MenuItem key="play" className="text-success"><FaPlay /> Play</MenuItem>
            <MenuItem key="stop" className="text-danger"><FaStop /> Stop</MenuItem>
        </Menu>
    );

    if (loading) {
        return (
            <Container className="text-center my-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p>Loading delivery details...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="text-center my-5">
                <p className="text-danger">Error: {error.message}</p>
                <p>Please try again later.</p>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    if (!delivery && tasks.length === 0) {
        return (
            <Container className="text-center my-5">
                <p>No delivery found for code: {delCode}</p>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    return (
        <Container className="delivery-detail-container mt-4">
            <h2 className="mb-4 text-center">Delivery Details for: {delCode}</h2>
            {delivery && (
                <Card className="mb-4">
                    <Card.Body>
                        <Card.Title>{delivery.Short_Description}</Card.Title>
                        <Card.Text>
                            <strong>Client:</strong> {delivery.Client} <br />
                            <strong>Total Tasks:</strong> {delivery.Total_Tasks} <br />
                            <strong>Completed Tasks:</strong> {delivery.Completed_Tasks} <br />
                            <strong>Percent Complete:</strong> {delivery.Percent_Tasks_Completed}%
                        </Card.Text>
                    </Card.Body>
                </Card>
            )}

            <h3 className="mb-3">Tasks:</h3>
            <Row>
                {tasks.length > 0 ? (
                    tasks.map((task) => (
                        <Col md={6} lg={4} key={task.Key} className="mb-3">
                            <Dropdown
                                overlay={() => menu(task.Key)}
                                animation="slide-up"
                                trigger={['contextMenu']}
                            >
                                <div style={{ cursor: 'context-menu' }}>
                                    <Card className="task-card">
                                        <Card.Body>
                                            <Card.Title><h5>{task.Task_Details}</h5></Card.Title>
                                            <Card.Subtitle className="mb-2 text-muted task-meta">
                                                Step ID: {task.Step_ID} | Responsibility: {task.Responsibility}
                                            </Card.Subtitle>
                                            <Card.Text className="task-meta">
                                                <FaCalendarAlt /> Planned Start: {task.Planned_Start_Timestamp ? new Date(task.Planned_Start_Timestamp).toLocaleDateString() : 'N/A'}
                                            </Card.Text>
                                            <Card.Text className="task-meta">
                                                <FaCalendarAlt /> Planned Delivery: {task.Planned_Delivery_Timestamp ? new Date(task.Planned_Delivery_Timestamp).toLocaleDateString() : 'N/A'}
                                            </Card.Text>
                                            <div className="task-status">
                                                <strong>Status:</strong> {task.Current_Status || 'N/A'}
                                            </div>
                                            <div className="task-status">
                                                {task.Card_Corner_Status === 'Upcoming' ? (
                                                    <p className="text-muted">Upcoming</p>
                                                ) : task.Card_Corner_Status === 'Behind Schedule' ? (
                                                    <p className="text-danger">Behind Schedule</p>
                                                ) : task.Card_Corner_Status === 'On Time' ? (
                                                    <p className="text-success">On time for going live</p>
                                                ) : (
                                                    <p className="text-muted">Paused</p>
                                                )}
                                            </div>

                                            {activeTaskKey === task.Key && actionType && (
                                                <div className="mt-3">
                                                    <h6>{actionType} Task: {task.Task_Details}</h6>
                                                    <FormComponent
                                                        onSubmit={handleFormSubmit}
                                                        task={task}
                                                    />
                                                </div>
                                            )}
                                        </Card.Body>
                                    </Card>
                                </div>
                            </Dropdown>
                        </Col>
                    ))
                ) : (
                    <ListGroup.Item>No tasks available for this delivery.</ListGroup.Item>
                )}
            </Row>

            <Link to="/" className="btn btn-primary mt-4">
                Back to Deliveries
            </Link>
        </Container>
    );
};

export default DeliveryDetail;
