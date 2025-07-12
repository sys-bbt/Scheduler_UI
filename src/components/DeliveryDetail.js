import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner, Button } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent'; // Ensure your form component is imported
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';
import moment from 'moment'; // 🚨 ADD THIS LINE 🚨

const DeliveryDetail = () => {
    const location = useLocation();
    // Adjusted to correctly extract delCode from a path like /delivery/your-del-code
    const delCode = location.pathname.substring(location.pathname.lastIndexOf('/') + 1); 
    const { userEmail } = useContext(UserContext);
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null); // To track which task is active for scheduling/other actions
    const [actionType, setActionType] = useState(''); // To differentiate between actions like 'schedule', 'reschedule'
    const [tasks, setTasks] = useState([]); // State to manage tasks

    // Fetching delivery details from the server
    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            if (!userEmail) { // Ensure user is logged in
                setLoading(false);
                setError("User not authenticated.");
                return;
            }
            try {
                setLoading(true);
                setError(null); // Clear previous errors

                const token = localStorage.getItem('authToken'); // Get auth token
                if (!token) {
                    throw new Error("Authentication token not found. Please log in.");
                }

                const response = await fetch(`https://server-ui-2.onrender.com/api/data/${delCode}?email=${userEmail}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                // 🚨 DEBUGGING LINE: Log the raw fetched data 🚨
                console.log("DEBUG: Fetched Delivery Details Data:", JSON.stringify(data, null, 2));

                setDelivery(data.delivery);
                setTasks(data.tasks);
            } catch (err) {
                console.error("Error fetching delivery details:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (delCode && userEmail) { // Only fetch if delCode and userEmail are available
            fetchDeliveryDetails();
        }
    }, [delCode, userEmail]); // Re-fetch if delCode or userEmail changes

    const onMenuItemClick = ({ key }) => {
        const [taskKey, type] = key.split('_');
        setActiveTaskKey(taskKey);
        setActionType(type);
    };

    const handleFormSubmit = async (formData, task) => {
        console.log("Form submitted with data:", formData);
        console.log("Task data:", task);
    
        // Combine task and form data for the BigQuery update
        const bigQueryData = {
            deliveryCode: delCode,
            taskKey: task.Key, // Unique key for the task
            taskDetails: task.Task_Details, // Existing task detail
            personResponsible: formData.personResponsible,
            deliverySlot: formData.deliverySlot,
            startDate: formData.startDate ? formData.startDate.format('YYYY-MM-DD') : null, // Convert moment object to string
            endDate: formData.endDate ? formData.endDate.format('YYYY-MM-DD') : null, // Convert moment object to string
            // Convert hours object to an array of {date: ..., hours: ...}
            hoursPerDay: Object.entries(formData.hours).map(([date, hours]) => ({
                date: moment(date).format('YYYY-MM-DD'), // Ensure date is formatted
                hours: parseFloat(hours) || 0
            })),
            numberOfDays: formData.numberOfDays,
            existingSchedules: formData.existingSchedules,
            userEmail: userEmail, // Pass the current user's email
        };
    
        console.log("Sending to backend:", JSON.stringify(bigQueryData, null, 2));
    
        try {
            const token = localStorage.getItem('authToken'); // Get auth token
            if (!token) {
                throw new Error("Authentication token not found. Please log in.");
            }

            const response = await fetch('https://server-ui-2.onrender.com/api/update-task-status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(bigQueryData),
            });
    
            if (!response.ok) {
                const errorText = await response.text(); // Get raw text to debug
                console.error("Backend error response:", errorText);
                try {
                    const errorData = JSON.parse(errorText); // Try parsing as JSON
                    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
                } catch (jsonError) {
                    // If parsing fails, use the raw text
                    throw new Error(`HTTP error! Status: ${response.status}. Response: ${errorText.substring(0, 200)}...`);
                }
            }
    
            const result = await response.json();
            console.log("Update successful:", result);
            alert(result.message || 'Task updated successfully!');
            // After successful update, you might want to re-fetch the delivery details
            // to reflect the changes, or update the state locally.
            // For now, let's just close the form and clear activeTaskKey
            setActiveTaskKey(null);
            setActionType('');
            // Optional: Re-fetch details to ensure UI is up-to-date
            // fetchDeliveryDetails(); // You might need to make fetchDeliveryDetails available here
    
        } catch (error) {
            console.error('Error updating task:', error);
            alert(`Failed to update task: ${error.message}`);
        }
    };
    

    if (loading) {
        return (
            <Container className="mt-5 text-center">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p>Loading delivery details...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5 text-center">
                <h2>Error: {error}</h2>
                <p>Failed to load delivery details. Please try again later.</p>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    if (!delivery) {
        return (
            <Container className="mt-5 text-center">
                <h2>Delivery not found.</h2>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    return (
        <Container className="mt-5">
            <h1 className="mb-4">Delivery Details: {delivery.DelCode_w_o__}</h1>
            <Card className="mb-4">
                <Card.Body>
                    <Card.Title>{delivery.Client} - {delivery.Project}</Card.Title>
                    <Card.Text>
                        <strong>Status:</strong> {delivery.Delivery_Status}<br />
                        <strong>Initiated:</strong> {delivery.Initiated_Timestamp}<br />
                        <strong>Planned Delivery:</strong> {delivery.Planned_Delivery_Timestamp}
                    </Card.Text>
                </Card.Body>
            </Card>

            <h2 className="mb-3">Tasks</h2>
            <Row>
                {tasks.length > 0 ? (
                    tasks.map((task) => (
                        <Col md={6} lg={4} className="mb-4" key={task.Key}>
                            {/* 💡 DEBUGGING RENDER: START WITH A MINIMAL RENDER 💡 */}
                            {/* Uncomment lines one by one to find the problematic element */}
                            <div>
                                Task Details: {task.Task_Details}
                                {/* <br />Responsible: {task.Responsibility} */}
                                {/* <br />Status: {task.Status} */}
                                {/* <br />Planned Start: {task.Planned_Start_Timestamp} */}
                                {/* <br />Planned Delivery: {task.Planned_Delivery_Timestamp} */}
                                {/* <br />Actual Start: {task.Actual_Start_Timestamp} */}
                                {/* <br />Actual Delivery: {task.Actual_Delivery_Timestamp} */}
                                {/* <br />Duration: {task.Task_Duration_In_Minutes} minutes */}
                            </div>

                            {/* 🛑 TEMPORARILY COMMENT OUT THE ENTIRE DROPDOWN/CARD BLOCK 🛑 */}
                            {/*
                            <Dropdown
                                trigger={['click']}
                                overlay={
                                    <Menu onClick={onMenuItemClick}>
                                        <MenuItem key={`${task.Key}_schedule`}>Schedule Task</MenuItem>
                                        <MenuItem key={`${task.Key}_reschedule`}>Reschedule Task</MenuItem>
                                    </Menu>
                                }
                                animation="slide-up"
                            >
                                <div className="task-card">
                                    <Card>
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <h5>{task.Task_Details}</h5>
                                                <Dropdown
                                                    trigger={['click']}
                                                    overlay={
                                                        <Menu onClick={onMenuItemClick}>
                                                            <MenuItem key={`${task.Key}_schedule`}>Schedule Task</MenuItem>
                                                            <MenuItem key={`${task.Key}_reschedule`}>Reschedule Task</MenuItem>
                                                        </Menu>
                                                    }
                                                    animation="slide-up"
                                                >
                                                    <Button variant="outline-secondary" size="sm">...</Button>
                                                </Dropdown>
                                            </div>
                                            <div className="task-meta">
                                                <p>Responsible: {task.Responsibility}</p>
                                                <p>Status: {task.Status}</p>
                                                <p>Planned Start: {task.Planned_Start_Timestamp}</p>
                                                <p>Planned Delivery: {task.Planned_Delivery_Timestamp}</p>
                                                <p>Actual Start: {task.Actual_Start_Timestamp}</p>
                                                <p>Actual Delivery: {task.Actual_Delivery_Timestamp}</p>
                                                <p>Duration: {task.Task_Duration_In_Minutes} minutes</p>
                                            </div>
                                            <div className="timer-controls">
                                                {task.Status === "In Progress" && (
                                                    <>
                                                        <FaPause style={{ cursor: 'pointer', marginRight: '10px' }} title="Pause" />
                                                        <FaStop style={{ cursor: 'pointer' }} title="Stop" />
                                                    </>
                                                )}
                                                {task.Status === "Paused" && (
                                                    <FaPlay style={{ cursor: 'pointer', marginRight: '10px' }} title="Resume" />
                                                )}
                                                {task.Status === "Completed" ? (
                                                    <p className="text-success">On time for going live</p>
                                                ) : (
                                                    <p className="text-muted">Paused</p>
                                                )}
                                            </div>

                                            {activeTaskKey === task.Key && actionType && (
                                                <div className="mt-3">
                                                    <h6>{actionType} Task: {task.Task_Details}</h6>
                                                    <FormComponent
                                                        onSubmit={(formData) => handleFormSubmit(formData, task)}
                                                        task={task}
                                                    />
                                                </div>
                                            )}
                                        </Card.Body>
                                    </Card>
                                </div>
                            </Dropdown>
                            */}
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
