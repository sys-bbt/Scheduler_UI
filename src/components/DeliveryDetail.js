import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, Row, Col, Spinner, Alert, ListGroup } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt, FaEllipsisV } from 'react-icons/fa';
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';
import moment from 'moment';
import { notification } from 'antd';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

// Define the status value that indicates a task is completed and should be hidden
const COMPLETED_TASK_STATUS = 'Completed'; 

// Define admin emails on the frontend, matching the backend
const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

const DeliveryDetail = () => {
    const location = useLocation();
    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null); // Holds the Key of the task whose form is active
    const [actionType, setActionType] = useState(null); // 'edit', 'pause', 'play', 'stop'

    // Extract delivery ID from route state
    const deliveryId = location.state?.deliveryId;

    // Fetch delivery details on component mount or when deliveryId changes
    useEffect(() => {
        if (!deliveryId) {
            setError("No delivery ID provided.");
            setLoading(false);
            return;
        }

        const fetchDeliveryDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/delivery/${deliveryId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setDelivery(data);
            } catch (err) {
                console.error("Failed to fetch delivery details:", err);
                setError("Failed to load delivery details. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchDeliveryDetails();
    }, [deliveryId]);

    // Function to handle the task action (Edit, Pause, Play, Stop)
    const handleAction = useCallback((taskKey, action) => {
        setActionType(action);
        
        if (action === 'edit') {
            // New logic: Toggle the form display for the specific task
            if (activeTaskKey === taskKey) {
                // If the same task is clicked again, close the form
                setActiveTaskKey(null);
                setActionType(null);
            } else {
                // Otherwise, open the form for the new task
                setActiveTaskKey(taskKey);
            }
        } else {
            // Logic for other actions (Pause, Play, Stop)
            // For now, we only handle 'edit' for the form display
            setActiveTaskKey(null);
            console.log(`Action: ${action} triggered for task: ${taskKey}`);
            // TODO: Implement API call for Pause, Play, Stop
            notification.info({
                message: 'Action Triggered',
                description: `Action: ${action} triggered for task: ${taskKey}. (Implementation pending)`,
            });
        }
    }, [activeTaskKey]); // Dependency on activeTaskKey to correctly check and toggle

    // Function to handle form submission
    const handleFormSubmit = useCallback(async (formData) => {
        // Implement the logic to send the updated task data to the backend
        console.log("Form submitted with data:", formData);

        // Prepare data for API (e.g., convert moment objects back to string if needed)
        const dataToSend = {
            ...formData,
            Planned_Start_Timestamp: formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.toISOString() : null,
            Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.toISOString() : null,
            // Assuming Responsibility is an object from react-select, extract the value (email)
            Responsibility: formData.Responsibility?.value || formData.Responsibility, 
        };

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/task/${formData.Key}/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            // Success feedback
            notification.success({
                message: 'Task Scheduled Successfully',
                description: `Task ${formData.Task_Details} updated.`,
            });

            // Close the form upon successful submission
            setActiveTaskKey(null);
            setActionType(null);
            
            // Re-fetch the delivery details to update the UI
            // This is crucial for real-time updates without a live connection
            // The existing useEffect dependency on deliveryId will handle this if we trigger a re-fetch, but for simplicity, we'll ask the user to refresh/navigate back for now, or implement a local state update for tasks.
            // For now, let's just close the form and rely on a full page navigation/refresh if critical.

        } catch (err) {
            console.error("Task scheduling failed:", err);
            notification.error({
                message: 'Scheduling Failed',
                description: err.message,
                duration: 5,
            });
        }
    }, []);

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5">
                <Alert variant="danger">{error}</Alert>
                <Link to="/" className="btn btn-primary mt-4">Back to Deliveries</Link>
            </Container>
        );
    }

    const filteredTasks = delivery.Tasks
        ? delivery.Tasks.filter(task => task.Status !== COMPLETED_TASK_STATUS)
        : [];
    
    // Sort tasks by Step_ID for consistent order
    filteredTasks.sort((a, b) => a.Step_ID - b.Step_ID);

    return (
        <Container className="mt-5">
            <h2 className="mb-4">Delivery Details: {delivery.Delivery_code}</h2>
            
            <Card className="mb-4 shadow-sm">
                <Card.Body>
                    <Card.Title>{delivery.Client}</Card.Title>
                    <Card.Subtitle className="mb-2 text-muted">
                        Delivery Code: {delivery.DelCode_w_o__}
                    </Card.Subtitle>
                    <Card.Text>
                        <strong>Description:</strong> {delivery.Description}
                    </Card.Text>
                    <Card.Text>
                        <strong>Planned Delivery Date:</strong> 
                        {moment(delivery.Planned_Delivery_Timestamp).isValid() 
                            ? moment(delivery.Planned_Delivery_Timestamp).format('YYYY-MM-DD HH:mm:ss')
                            : 'N/A'
                        }
                    </Card.Text>
                    <Card.Text>
                        <strong>Current Status:</strong> <span className={`badge ${delivery.Status === 'InProgress' ? 'bg-primary' : 'bg-success'}`}>{delivery.Status}</span>
                    </Card.Text>
                </Card.Body>
            </Card>

            <h3 className="mt-5 mb-3">Tasks</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
                {filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => {
                        // Use task.Key as the unique identifier for the card and the form
                        const isTaskActive = activeTaskKey === task.Key;

                        return (
                            <Col key={task.Key}>
                                <Card className={`shadow-sm h-100 task-card ${isTaskActive ? 'border-primary' : ''}`}>
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <Card.Title className="mb-1">
                                                {task.Step_ID}. {task.Task_Details}
                                            </Card.Title>
                                            <span className={`badge ${task.Status === 'Pending' ? 'bg-warning' : task.Status === 'InProgress' ? 'bg-primary' : 'bg-secondary'}`}>
                                                {task.Status}
                                            </span>
                                        </div>
                                        <Card.Subtitle className="mb-2 text-muted">
                                            Assigned to: {task.Responsibility || 'System'}
                                        </Card.Subtitle>
                                        
                                        {/* Updated to use Planned_Delivery_Timestamp */}
                                        <Card.Text className="small">
                                            <FaCalendarAlt className="me-1 text-info" />
                                            <strong>Planned End:</strong> 
                                            {moment(task.Planned_Delivery_Timestamp).isValid()
                                                ? moment(task.Planned_Delivery_Timestamp).format('YYYY-MM-DD')
                                                : 'TBD'
                                            }
                                        </Card.Text>
                                        
                                        <div className="d-flex justify-content-end">
                                            <Dropdown
                                                trigger={['click']}
                                                overlay={
                                                    <Menu onClick={({ key }) => handleAction(task.Key, key)}>
                                                        <MenuItem key="edit">Schedule/Edit</MenuItem>
                                                        <MenuItem key="play"><FaPlay className="me-2 text-success" />Start</MenuItem>
                                                        <MenuItem key="pause"><FaPause className="me-2 text-warning" />Pause</MenuItem>
                                                        <MenuItem key="stop"><FaStop className="me-2 text-danger" />Stop</MenuItem>
                                                    </Menu>
                                                }
                                                animation="slide-up"
                                            >
                                                <Button variant="light" size="sm" className="btn-icon">
                                                    <FaEllipsisV />
                                                </Button>
                                            </Dropdown>
                                        </div>

                                        {/* Display FormComponent ONLY if the task is the active one and the action is 'edit' */}
                                        {isTaskActive && actionType === 'edit' && (
                                            <div className="mt-3 p-3 border rounded bg-light">
                                                <h6>Schedule Task: {task.Task_Details}</h6>
                                                <FormComponent
                                                    onSubmit={handleFormSubmit}
                                                    task={task}
                                                    currentUserEmail={userEmail}
                                                />
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })
                ) : (
                    <Col>
                        <ListGroup.Item>No tasks available for this delivery or all tasks are completed.</ListGroup.Item>
                    </Col>
                )}
            </Row>

            <Link to="/" className="btn btn-primary mt-4">
                Back to Deliveries
            </Link>
        </Container>
    );
};

export default DeliveryDetail;
