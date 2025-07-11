// src/components/DeliveryDetail.js

import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent'; // Ensure your form component is imported
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

// ADD THIS LINE: Import notification from 'antd'
import { notification } from 'antd'; // Make sure 'antd' is installed in your frontend project

const DeliveryDetail = () => {
    const location = useLocation();
    const delCode = location.pathname.substring(location.pathname.lastIndexOf("/data/") + 11); // Adjust to your actual path
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
            if (!userEmail) {
                setLoading(false);
                setError("User not authenticated.");
                return;
            }
            try {
                setLoading(true); // Set loading state to true

                const response = await fetch(`https://server-ui-2.onrender.com/api/data/${delCode}?email=${userEmail}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setDelivery(data.delivery);
                setTasks(data.tasks); // Assuming API returns tasks related to the delivery
            } catch (err) {
                console.error("Error fetching delivery details:", err);
                setError(err.message);
            } finally {
                setLoading(false); // Always set loading to false
            }
        };

        if (delCode && userEmail) { // Only fetch if delCode and userEmail are available
            fetchDeliveryDetails();
        }
    }, [delCode, userEmail]);

    const handleFormSubmit = async (formData) => {
        console.log("Form Data Submitted:", formData);

        // Map internal form data keys to BigQuery column names
        const bigQueryData = {
            DelCode_w_o__: delCode,
            Task_Details: formData.name, // Task_Details from form
            Responsibility: formData.personResponsible, // Person Responsible
            Planned_Start_Timestamp: formData.startDate ? formData.startDate.format('YYYY-MM-DD') : null,
            Planned_Delivery_Timestamp: formData.endDate ? formData.endDate.format('YYYY-MM-DD') : null,
            Delivery_Slot: formData.deliverySlot, // Delivery Slot (1pm, 4pm, 7pm)
            // Add Task_Durations_By_Day if needed for the backend schema
            Task_Durations_By_Day: formData.hours, // This will be an object { 'YYYY-MM-DD': minutes }
            Number_of_Days: formData.numberOfDays, // Number of days slider value
            Step_ID: task.Step_ID, // Use the current task's Step_ID
            Client: task.Client,
            Project: task.Project,
            Key: task.Key, // Crucial for updating existing records
        };

        try {
            const response = await fetch(`https://server-ui-2.onrender.com/api/update-task-status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(bigQueryData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update task.');
            }

            const result = await response.json();
            notification.success({ // Use notification.success
                message: 'Success',
                description: result.message,
            });

            // Re-fetch delivery details to update the UI
            setLoading(true);
            const updatedResponse = await fetch(`https://server-ui-2.onrender.com/api/data/${delCode}?email=${userEmail}`);
            if (!updatedResponse.ok) {
                throw new Error(`HTTP error! status: ${updatedResponse.status}`);
            }
            const updatedData = await updatedResponse.json();
            setDelivery(updatedData.delivery);
            setTasks(updatedData.tasks);
            setLoading(false);

            setActiveTaskKey(null); // Close the form
            setActionType(''); // Reset action type

        } catch (error) {
            console.error('Error submitting form:', error);
            notification.error({ // Use notification.error
                message: 'Error',
                description: error.message || 'An error occurred while updating the task.',
            });
        }
    };

    const onDropdownOverlayClick = (key, type) => {
        setActiveTaskKey(key);
        setActionType(type); // 'schedule' or 'reschedule'
    };

    const onMenuItemClick = (info) => {
        const [key, type] = info.key.split('_');
        onDropdownOverlayClick(key, type);
    };

    // Filter tasks to show only top-level (Step_ID 0) and children
    // Assuming tasks are sorted or can be sorted to show parent-child relationships correctly
    const parentTasks = tasks.filter(task => task.Step_ID === 0);

    if (loading) {
        return (
            <Container className="text-center mt-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p>Loading delivery details...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="text-center mt-5">
                <p className="text-danger">Error: {error}</p>
                <Link to="/" className="btn btn-primary">Back to Deliveries</Link>
            </Container>
        );
    }

    if (!delivery) {
        return (
            <Container className="text-center mt-5">
                <p>No delivery found for code: {delCode}</p>
                <Link to="/" className="btn btn-primary">Back to Deliveries</Link>
            </Container>
        );
    }

    return (
        <Container className="delivery-detail-container">
            <h1 className="my-4 text-center">Delivery Details</h1>
            <Card className="mb-4">
                <Card.Body>
                    <Card.Title>Client: {delivery.Client}</Card.Title>
                    <Card.Subtitle className="mb-2 text-muted">Project: {delivery.Project}</Card.Subtitle>
                    <ListGroup variant="flush">
                        <ListGroup.Item>Delivery Code: {delivery.DelCode_w_o__}</ListGroup.Item>
                        <ListGroup.Item>Delivery Status: {delivery.Delivery_Status}</ListGroup.Item>
                        <ListGroup.Item>Initiated: {delivery.Initiated_Timestamp}</ListGroup.Item>
                        <ListGroup.Item>Planned Delivery: {delivery.Planned_Delivery_Timestamp}</ListGroup.Item>
                    </ListGroup>
                </Card.Body>
            </Card>

            <h2 className="mb-3">Tasks</h2>
            <Row>
                {tasks.length > 0 ? (
                    tasks.map((task) => (
                        <Col md={6} lg={4} className="mb-4" key={task.Key}>
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
