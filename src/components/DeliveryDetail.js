import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt, FaEllipsisV } from 'react-icons/fa'; // Added FaEllipsisV for dropdown trigger
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';
import moment from 'moment';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

// Define the status value that indicates a task is completed and should be hidden
const COMPLETED_TASK_STATUS = 'Completed'; // Adjust this string to match your BigQuery 'Current_Status' for completed tasks

// Define admin emails on the frontend, matching the backend
const ADMIN_EMAILS_FRONTEND = [
   
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

const DeliveryDetail = () => {
    const location = useLocation();
    const delCodeMatch = location.pathname.match(/\/delivery\/data\/(.*)/);
    const deliveryCode = delCodeMatch ? decodeURIComponent(delCodeMatch[1]) : null;

    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState(null); // 'edit', 'pause', 'play', 'stop'

    const { userEmail } = useContext(UserContext); // Get userEmail from context
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);


    const fetchDeliveryDetails = async () => {
        if (!deliveryCode) {
            setError("Delivery code not found in URL.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // UPDATED API ENDPOINT: Fetch all tasks for this workflow
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/workflow-details/${encodeURIComponent(deliveryCode)}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch workflow details for ${deliveryCode}.`);
            }
            const data = await response.json();
            
            if (data.length === 0) {
                setError(`Workflow with code "${deliveryCode}" not found or has no tasks.`);
                setLoading(false);
                return;
            }

            // Assuming the first item with Step_ID=0 is the main workflow detail
            const mainDeliveryDetail = data.find(task => task.Step_ID === 0);
            setDeliveryDetails(mainDeliveryDetail || data[0]); // Fallback if no Step_ID=0

            // Filter out Step_ID = 0 from the tasks array for display
            const tasksToDisplay = data.filter(task => task.Step_ID !== 0);

            // All tasks received from the /api/workflow-details/:deliveryCode endpoint will be displayed.
            const sortedTasks = tasksToDisplay.sort((a, b) => {
                // Sort by Step_ID ascending for the remaining tasks.
                return a.Step_ID - b.Step_ID;
            });

            setTasks(sortedTasks);

        } catch (err) {
            console.error("Error fetching delivery details:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveryDetails();
    }, [deliveryCode, userEmail, isAdmin]);


    const handleFormSubmit = (updatedTaskData) => {
        // Find the task by key and update its properties
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.Key === updatedTaskData.Key
                    ? { ...task, ...updatedTaskData }
                    : task
            )
        );
        setActiveTaskKey(null); // Close the form after submission
        setActionType(null); // Clear action type
        fetchDeliveryDetails(); // Re-fetch all details to ensure consistency
    };

    // Modified handleActionClick to always set actionType to 'edit' when card is clicked
    const handleCardClick = (taskKey, currentStatus) => {
        // Only open the form for editing if the task is NOT 'Scheduled'
        if (currentStatus !== 'Scheduled') {
            setActiveTaskKey(taskKey);
            setActionType('edit'); // Always set to 'edit' when a task card is clicked
        } else {
            // Optionally, show a notification or do nothing if it's scheduled
            notification.info({
                message: 'Task Scheduled',
                description: 'This task is already scheduled and cannot be edited.',
            });
        }
    };

    // New handler for dropdown menu item clicks (for Pause/Play/Stop)
    const handleMenuItemClick = (taskKey, type) => {
        setActiveTaskKey(taskKey);
        setActionType(type);
    };

    const onVisibleChange = (visible) => {
        if (!visible && activeTaskKey) { // Only clear if dropdown is closing and a task was active
            // If the form is open, we don't want to close it just because the dropdown closed.
            // The form will be closed by handleFormSubmit or explicit user action.
            // This ensures the form stays open when clicking outside the dropdown but within the form.
            // If you want to close the form when clicking anywhere outside the dropdown,
            // you'd need a more complex click-outside detection for the form itself.
        }
    };

    const renderMenu = (task) => (
        <Menu>
            {/* Conditional rendering based on task status */}
            {task.Current_Status === 'Running' && (
                <MenuItem key="pause" onClick={() => handleMenuItemClick(task.Key, 'pause')}>
                    <FaPause style={{ marginRight: '5px' }} /> Pause
                </MenuItem>
            )}
            {task.Current_Status === 'Paused' && (
                <MenuItem key="play" onClick={() => handleMenuItemClick(task.Key, 'play')}>
                    <FaPlay style={{ marginRight: '5px' }} /> Play
                </MenuItem>
            )}
            {task.Current_Status !== 'Completed' && ( // Assuming 'Completed' tasks cannot be stopped
                <MenuItem key="stop" onClick={() => handleMenuItemClick(task.Key, 'stop')}>
                    <FaStop style={{ marginRight: '5px' }} /> Stop
                </MenuItem>
            )}
            {/* Removed "Mark as Completed" button */}
        </Menu>
    );

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
        return (
            <Container className="mt-5 text-center">
                <h2>Error Loading Workflow Details</h2>
                <p className="text-danger">{error}</p>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    if (!deliveryDetails) {
        return (
            <Container className="mt-5 text-center">
                <h2>No Workflow Details Found</h2>
                <p>The requested workflow could not be found.</p>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    return (
        <Container className="delivery-detail-container mt-4">
            <h2 className="mb-4">Workflow: {deliveryDetails.Delivery_code}</h2>
            <p><strong>Client:</strong> {deliveryDetails.Client}</p>
            <p><strong>Description:</strong> {deliveryDetails.Short_Description}</p>
            <p><strong>Planned Start:</strong> {deliveryDetails.Planned_Start_Timestamp ? moment(deliveryDetails.Planned_Start_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Planned Delivery:</strong> {deliveryDetails.Planned_Delivery_Timestamp ? moment(deliveryDetails.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Overall Status:</strong> {deliveryDetails.Current_Status}</p>

            <h3 className="mt-5 mb-3">Tasks in this Workflow:</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
                {tasks.length > 0 ? (
                    tasks.map((task) => {
                        const isTaskCompleted = task.Current_Status === COMPLETED_TASK_STATUS;
                        const isTaskScheduled = task.Current_Status === 'Scheduled'; // Determine if task is scheduled
                        // Determine the status to display
                        // If it has a planned start timestamp AND is not 'Completed', show 'Scheduled'
                        // Otherwise, show its actual Current_Status
                        const displayStatus = (task.Planned_Start_Timestamp && task.Current_Status !== COMPLETED_TASK_STATUS)
                            ? 'Scheduled'
                            : task.Current_Status;

                        return (
                            <Col key={task.Key}>
                                <Card
                                    className={`task-card ${isTaskCompleted ? 'task-completed' : ''} ${task.Key === activeTaskKey ? 'active-task' : ''} ${isTaskScheduled ? 'task-scheduled-uneditable' : ''}`}
                                    style={{ width: '100%', cursor: isTaskScheduled ? 'not-allowed' : 'pointer' }} // Change cursor
                                    onClick={() => handleCardClick(task.Key, task.Current_Status)} // Pass currentStatus
                                >
                                    <Card.Body>
                                        <Card.Title>{task.Task_Details}</Card.Title>
                                        <Card.Text>
                                            <strong>Step ID:</strong> {task.Step_ID}<br />
                                            <strong>Responsibility:</strong> {task.Responsibility}<br />
                                            <strong>Status:</strong> {displayStatus} {/* Updated status display */}
                                        </Card.Text>
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            {task.Planned_Start_Timestamp && (
                                                <p className="text-muted mb-0">
                                                    <FaCalendarAlt style={{ marginRight: '5px' }} />
                                                    Start: {moment(task.Planned_Start_Timestamp).format('YYYY-MM-DD')}
                                                </p>
                                            )}
                                            {task.Current_Status === 'Paused' && (
                                                <p className="text-muted">Paused</p>
                                            )}
                                            {/* Dropdown for other actions (Pause/Play/Stop) */}
                                            <Dropdown
                                                overlay={renderMenu(task)}
                                                trigger={['click']}
                                                onVisibleChange={onVisibleChange}
                                                // Prevent card click from propagating to dropdown when clicking ellipsis
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <FaEllipsisV style={{ cursor: 'pointer' }} />
                                            </Dropdown>
                                        </div>

                                        {activeTaskKey === task.Key && actionType && (
                                            <div className="mt-3">
                                                <h6>{actionType} Task: {task.Task_Details}</h6>
                                                <FormComponent
                                                    onSubmit={handleFormSubmit}
                                                    task={task}
                                                    currentUserEmail={userEmail}
                                                    isReadOnly={isTaskScheduled} // Pass the new prop here
                                                />
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })
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
