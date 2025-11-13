import React, { useEffect, useState, useContext } from 'react';
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
    const delCodeMatch = location.pathname.match(/\/delivery\/data\/(.*)/);
    const deliveryCode = delCodeMatch ? decodeURIComponent(delCodeMatch[1]) : null;

    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState(null); // 'edit', 'pause', 'play', 'stop'
    
    // State added to trigger re-fetch after form submission (Fixes ESLint missing dependency)
    const [refreshKey, setRefreshKey] = useState(0); 

    const { userEmail } = useContext(UserContext); // Get userEmail from context
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    // FIX: Moved fetch logic inside useEffect and added refreshKey to dependencies.
    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            if (!deliveryCode) {
                setError("Delivery code not found in URL.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                // Fetch all tasks for this workflow
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

                // Sort by Step_ID ascending
                const sortedTasks = tasksToDisplay.sort((a, b) => {
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

        fetchDeliveryDetails();
    }, [deliveryCode, userEmail, isAdmin, refreshKey]); // Now includes refreshKey as a dependency

    const handleFormSubmit = (updatedTaskData) => {
        // Optimistic update of tasks
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.Key === updatedTaskData.Key
                    ? { ...task, ...updatedTaskData }
                    : task
            )
        );
        setActiveTaskKey(null); // Close the form after submission
        setActionType(null); // Clear action type
        setRefreshKey(prev => prev + 1); // Trigger the useEffect to re-fetch with fresh data
    };

    const handleCardClick = (taskKey, displayStatus) => { 
        const isScheduled = displayStatus === 'Scheduled';
        
        // Only open the form for scheduling/editing if the task is NOT 'Scheduled'
        if (!isScheduled) { 
            setActiveTaskKey(taskKey);
            setActionType('edit'); // Always set to 'edit' when a task card is clicked
        } else {
            // If scheduled, show a notification and close any open form
            notification.info({
                message: 'Task Already Scheduled',
                description: 'This task has a Planned Start Date and cannot be rescheduled.',
            });
            setActiveTaskKey(null);
            setActionType(null);
        }
    };

    // New handler for dropdown menu item clicks (for Pause/Play/Stop)
    const handleMenuItemClick = (taskKey, type) => {
        // Temporarily block P/P/S actions, as API is not yet ready.
        notification.info({
            message: 'Status Change Disabled',
            description: `API for ${type} is not yet implemented.`,
        });
        setActiveTaskKey(null);
        setActionType(null);
    };

    const onVisibleChange = (visible) => {
        // Keeps the form open if the dropdown closes but the form is open for 'edit'
        if (!visible && activeTaskKey && actionType !== 'edit') {
             // Logic to handle closing when not in edit mode
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
                <Alert variant="danger">
                    <h2>Error Loading Workflow Details</h2>
                    <p>{error}</p>
                </Alert>
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
            <p><strong>Planned Start:</strong> {deliveryDetails.Planned_Start_Timestamp ? moment.utc(deliveryDetails.Planned_Start_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Planned Delivery:</strong> {deliveryDetails.Planned_Delivery_Timestamp ? moment.utc(deliveryDetails.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Overall Status:</strong> {deliveryDetails.Current_Status}</p>

            <h3 className="mt-5 mb-3">Tasks in this Workflow:</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
                {tasks.length > 0 ? (
                    tasks.map((task) => {
                        const isTaskCompleted = task.Current_Status === COMPLETED_TASK_STATUS;
                        
                        // Safely extract the timestamp value
                        const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
                            ? task.Planned_Start_Timestamp.value
                            : task.Planned_Start_Timestamp;
                        
                        // Determine the status to display
                        const displayStatus = (rawPlannedStartTimestamp && task.Current_Status !== COMPLETED_TASK_STATUS)
                            ? 'Scheduled'
                            : task.Current_Status;
                        
                        const isTaskScheduled = displayStatus === 'Scheduled'; 

                        return (
                            <Col key={task.Key}>
                                <Card
                                    className={`task-card ${isTaskCompleted ? 'task-completed' : ''} ${task.Key === activeTaskKey ? 'active-task' : ''} ${isTaskScheduled ? 'task-scheduled-uneditable' : ''}`}
                                    style={{ cursor: isTaskScheduled ? 'default' : 'pointer' }}
                                    onClick={() => handleCardClick(task.Key, displayStatus)} // Pass displayStatus
                                >
                                    <Card.Body>
                                        <Card.Title>{task.Task_Details}</Card.Title>
                                        <Card.Text>
                                            <strong>Step ID:</strong> {task.Step_ID}<br />
                                            <strong>Responsibility:</strong> {task.Responsibility}<br />
                                            <strong className={isTaskScheduled ? 'text-info' : ''}>Status:</strong> {displayStatus} {/* Updated status display */}
                                        </Card.Text>
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            {rawPlannedStartTimestamp && ( // Use the safely extracted timestamp
                                                <p className="text-muted mb-0">
                                                    <FaCalendarAlt style={{ marginRight: '5px' }} />
                                                    Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                                                </p>
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

                                        {/* Display FormComponent ONLY if the task is the active one and the action is 'edit' */}
                                        {activeTaskKey === task.Key && actionType === 'edit' && (
                                            <div className="mt-3">
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
                        <ListGroup.Item>No tasks available for this delivery.</ListGroup.Item>
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
