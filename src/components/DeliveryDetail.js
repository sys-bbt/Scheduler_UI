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

const DeliveryDetail = () => {
    const location = useLocation();
    // Assuming the URL path is something like /data/DELCODE_VALUE
    const delCode = location.pathname.substring(location.pathname.lastIndexOf("/data/") + 6); // Adjusted to correctly extract the delCode
    const { userEmail } = useContext(UserContext);
    const [delivery, setDelivery] = useState(null); // This will hold the main delivery (Step_ID=0) info
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null); // To track which task is active for scheduling/other actions
    const [actionType, setActionType] = useState(''); // To differentiate between actions like 'schedule', 'reschedule'
    const [tasks, setTasks] = useState([]); // State to manage all tasks for this DelCode_w_o__

    // Fetching delivery details from the server
    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            if (!userEmail) {
                console.warn("User email not available, skipping delivery detail fetch.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const params = new URLSearchParams({
                    email: userEmail,
                    search: delCode, // Using search to filter by DelCode_w_o__
                    // You might need to adjust limit if a workflow has many tasks,
                    // or add a specific backend endpoint for detailed workflow view
                    limit: 100 // Example: fetch up to 100 tasks for this workflow
                });

                const response = await fetch(`https://server-ui-2.onrender.com/api/data?${params.toString()}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();

                // Filter tasks to ensure only those matching the current delCode are shown
                const filteredTasks = result.filter(task => task.DelCode_w_o__ === delCode);

                setTasks(filteredTasks);
                // Find the main delivery item (Step_ID=0) if it exists
                setDelivery(filteredTasks.find(task => task.Step_ID === 0) || null);

            } catch (error) {
                console.error('Error fetching delivery details:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        if (delCode && userEmail) {
            fetchDeliveryDetails();
        }
    }, [delCode, userEmail]); // Dependencies for re-fetching

    const handleFormSubmit = async (formData) => {
        console.log('Form submitted:', formData);
        try {
            const response = await fetch('https://server-ui-2.onrender.com/api/update-task-status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update task status.');
            }

            const result = await response.json();
            console.log('Update successful:', result.message);
            notification.success({
                message: 'Success',
                description: 'Task updated successfully!',
            });
            setActiveTaskKey(null); // Close the form
            setActionType('');

            // Re-fetch delivery details to get updated data
            // This will trigger the useEffect for fetchDeliveryDetails
            setLoading(true); // Manually set loading to true to show spinner while re-fetching
            // You can call fetchDeliveryDetails() directly here too.
        } catch (error) {
            console.error('Error updating task status:', error);
            notification.error({
                message: 'Error',
                description: `Failed to update task: ${error.message}`,
            });
        }
    };

    const onMenuClick = (taskKey, action) => ({ key }) => {
        console.log(`Action: ${key} on task ${taskKey}`);
        setActiveTaskKey(taskKey);
        setActionType(key); // Set action type (e.g., 'update', 'schedule')
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return <Container className="text-center mt-5">Error: {error}</Container>;
    }

    if (!delivery && tasks.length === 0) {
        return <Container className="text-center mt-5">No delivery details found for this code.</Container>;
    }

    return (
        <Container className="container">
            <h1 className="my-4 text-center">Delivery Details for: {delCode}</h1>

            {delivery && (
                <Card className="mb-4">
                    <Card.Body>
                        <Card.Title>Main Delivery: {delivery.Task_Details}</Card.Title>
                        <Card.Subtitle className="mb-2 text-muted">{delivery.Client} - {delivery.Project}</Card.Subtitle>
                        <Card.Text>
                            <strong>Status:</strong> {delivery.Status} <br />
                            <strong>Initiated:</strong> {delivery.Initiated_Timestamp} <br />
                            <strong>Planned Delivery:</strong> {delivery.Planned_Delivery_Timestamp} <br />
                            <strong>Actual Hours:</strong> {delivery.Task_Duration_In_Minutes || 'N/A'} min
                        </Card.Text>
                    </Card.Body>
                </Card>
            )}

            <h2 className="my-4">Associated Tasks</h2>
            <Row>
                {tasks.length > 0 ? (
                    tasks.map(task => (
                        <Col md={6} lg={4} className="mb-4" key={task.Key}>
                            <Dropdown
                                trigger={['click']}
                                overlay={
                                    <Menu onClick={onMenuClick(task.Key, task.Status)}>
                                        <MenuItem key="update">Update</MenuItem>
                                        <MenuItem key="schedule">Schedule</MenuItem>
                                        {/* Add other menu items as needed based on task status or available actions */}
                                    </Menu>
                                }
                                animation="slide-up"
                            >
                                <div className="task-card">
                                    <Card>
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <Card.Title className="mb-0"><h5>{task.Task_Details}</h5></Card.Title>
                                                <span className="timer-controls">
                                                    {task.Status === 'In Progress' ? <FaPlay className="text-success" /> : <FaPause className="text-warning" />}
                                                </span>
                                            </div>
                                            <p className="task-meta mb-1">Assigned to: {task.Responsibility}</p>
                                            <div className="task-meta">
                                                <FaCalendarAlt /> Start: {task.Planned_Start_Timestamp || 'N/A'}
                                            </div>
                                            <div className="task-meta">
                                                <FaCalendarAlt /> End: {task.Planned_Delivery_Timestamp || 'N/A'}
                                            </div>
                                            <div className="task-status mt-2">
                                                <strong>Status:</strong> {task.Status}
                                                {task.Status === 'Completed' ? (
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
