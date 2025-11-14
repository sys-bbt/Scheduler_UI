import React, { useEffect, useState, useContext, useCallback, memo, useMemo } from 'react';
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

const COMPLETED_TASK_STATUS = 'Completed';

const ADMIN_EMAILS_FRONTEND = [
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// Helper function for the dropdown menu
const renderMenu = (task, onMenuItemClick) => (
    <Menu>
        {/* Conditional rendering based on task status */}
        {task.Current_Status === 'Running' && (
            <MenuItem key="pause" onClick={(e) => { e.stopPropagation(); onMenuItemClick(task, 'pause'); }}>
                <FaPause style={{ marginRight: '5px' }} /> Pause
            </MenuItem>
        )}
        {task.Current_Status === 'Paused' && (
            <MenuItem key="play" onClick={(e) => { e.stopPropagation(); onMenuItemClick(task, 'play'); }}>
                <FaPlay style={{ marginRight: '5px' }} /> Play
            </MenuItem>
        )}
        {/* Changed 'stop' key to 'complete' for clarity, assuming it means final completion */}
        {task.Current_Status !== COMPLETED_TASK_STATUS && ( 
            <MenuItem key="complete" onClick={(e) => { e.stopPropagation(); onMenuItemClick(task, 'complete'); }}>
                <FaStop style={{ marginRight: '5px' }} /> Complete
            </MenuItem>
        )}
        {/* Always allow editing (Schedule/Assign) */}
        <MenuItem key="edit" onClick={(e) => { e.stopPropagation(); onMenuItemClick(task, 'edit'); }}>
            <FaCalendarAlt style={{ marginRight: '5px' }} /> Schedule/Assign
        </MenuItem>
    </Menu>
);

// --- TaskCard Component (The Clickable Card with Inline Form Logic) ---
const TaskCard = memo(({ task, isActive, displayStatus, onCardClick, onMenuItemClick, onFormSubmit, currentUserEmail }) => {
    
    const isTaskCompleted = task.Current_Status === COMPLETED_TASK_STATUS;
    // Task is scheduled if it has a planned start date AND is not completed
    const isTaskScheduled = displayStatus === 'Scheduled';

    const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
        ? task.Planned_Start_Timestamp.value
        : task.Planned_Start_Timestamp;

    return (
        <Col className="mb-4"> {/* Added mb-4 for spacing */}
            <Card
                className={`task-card ${isTaskCompleted ? 'task-completed' : ''} ${isActive ? 'active-task' : ''} ${isTaskScheduled ? 'task-scheduled-uneditable' : ''}`}
                style={{ cursor: isTaskScheduled ? 'default' : 'pointer', backgroundColor: '#D9D9D9' }}
                onClick={() => onCardClick(task.Key, displayStatus)} 
            >
                <Card.Body>
                    <Row className="align-items-center">
                        <Col xs={8}>
                            <Card.Title className="mb-1">{task.Task_Details}</Card.Title>
                            <Card.Text className="mb-0">
                                <span className="text-muted me-3">Step ID: {task.Step_ID}</span>
                                <span>Responsible: <strong>{task.Responsibility || 'Unassigned'}</strong></span>
                                <div className={`mt-1 ${isTaskCompleted ? 'text-success' : ''}`}>
                                    <strong style={{ fontSize: '15px' }}>Status:</strong> {displayStatus}
                                </div>
                            </Card.Text>
                            {rawPlannedStartTimestamp && (
                                <p className="text-muted mb-0 mt-1">
                                    <FaCalendarAlt style={{ marginRight: '5px' }} />
                                    Planned Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                                </p>
                            )}
                        </Col>
                        <Col xs={4} className="d-flex justify-content-end align-items-center">
                            <Dropdown
                                overlay={renderMenu(task, onMenuItemClick)}
                                trigger={['click']}
                                onClick={(e) => e.stopPropagation()} // Prevent card click when clicking dropdown
                            >
                                <FaEllipsisV style={{ cursor: 'pointer', fontSize: '20px' }} />
                            </Dropdown>
                        </Col>
                    </Row>
                    
                    {/* CONDITIONAL FORM RENDERING */}
                    {isActive && (
                        <div className="mt-3 p-3 border-top" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff' }}> 
                            <h6>Schedule/Edit Task: {task.Task_Details}</h6>
                            <FormComponent
                                onSubmit={onFormSubmit}
                                task={task}
                                currentUserEmail={currentUserEmail}
                            />
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Col>
    );
});


const DeliveryDetail = () => {
    const location = useLocation();
    // Safely extract delivery code from the URL path
    const delCodeMatch = location.pathname.match(/\/delivery\/data\/(.*)/);
    const deliveryCode = delCodeMatch ? decodeURIComponent(delCodeMatch[1]) : null;

    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // KEY STATE: Controls which TaskCard form is open
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState(null); // 'edit', 'pause', 'play', 'stop'
    const [refreshKey, setRefreshKey] = useState(0); // Key to manually trigger data refresh

    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    // 1. Refactor fetching into a useCallback
    const fetchDeliveryDetails = useCallback(async () => {
        if (!deliveryCode) {
            setError("Delivery code not found in URL.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // Updated endpoint structure based on your original file
            const endpoint = `${BACKEND_API_BASE_URL}/api/workflow-details/${encodeURIComponent(deliveryCode)}`;
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                const errorData = await response.text(); // Use text() to capture raw response data
                console.error(`API Error (${response.status}) from ${endpoint}:`, errorData);
                // Throw an error with a message for the Alert
                throw new Error(`Failed to fetch workflow details: ${response.statusText}. Check backend logs.`);
            }

            const data = await response.json();
            
            if (!data || data.length === 0) {
                setError(`Workflow with code "${deliveryCode}" not found or has no tasks.`);
                setTasks([]);
                return;
            }

            // Find the main delivery detail (Step_ID 0)
            const mainDeliveryDetail = data.find(task => String(task.Step_ID) === '0');
            setDeliveryDetails(mainDeliveryDetail || data[0]); 

            // Filter out Step_ID 0 for the task list
            const tasksToDisplay = data.filter(task => String(task.Step_ID) !== '0');

            const sortedTasks = tasksToDisplay.sort((a, b) => {
                return a.Step_ID - b.Step_ID;
            });

            setTasks(sortedTasks);
            console.log("Tasks fetched successfully.");

        } catch (err) {
            console.error("Error fetching delivery details:", err);
            // Ensure error message is a string
            setError(`Failed to load tasks. Error: ${err.message || String(err)}`);
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, [deliveryCode]); // Dependency only on deliveryCode

    // 2. Initial fetch and refresh listener
    useEffect(() => {
        fetchDeliveryDetails();
    }, [fetchDeliveryDetails, refreshKey]); // Now depends on fetchDeliveryDetails and refreshKey

    const handleFormSubmit = useCallback((updatedTaskData) => {
        // Optimistic update of tasks for snappier UI
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.Key === updatedTaskData.Key
                    ? { ...task, ...updatedTaskData }
                    : task
            )
        );
        
        // Wait 1.5 seconds, then close the form and refresh.
        setTimeout(() => {
            setActiveTaskKey(null); 
            setActionType(null);
            // Trigger re-fetch for fresh data and accurate status display
            setRefreshKey(prev => prev + 1); 
        }, 1500); 
    }, []);

    // CLICK HANDLER: Controls the activeTaskKey state
    const handleCardClick = useCallback((taskKey, displayStatus) => {
        // Only open the form if it's not completed and not scheduled
        if (displayStatus === COMPLETED_TASK_STATUS) {
            notification.info({
                message: 'Task Completed',
                description: 'This task is already completed and cannot be edited.',
            });
            return;
        }

        // Allow toggling the edit form only if it's an admin or if the task is not yet scheduled/in progress
        if (activeTaskKey === taskKey) {
            // Close the currently active card
            setActiveTaskKey(null);
            setActionType(null);
        } else {
            // Open the new card for editing
            setActiveTaskKey(taskKey);
            setActionType('edit');
        }
    }, [activeTaskKey]); 

    const handleMenuItemClick = useCallback(async (task, action) => {
        // If the action is 'edit', open the form
        if (action === 'edit') {
            setActiveTaskKey(task.Key);
            setActionType('edit');
            return;
        }

        // Determine the new status based on the menu action
        let newStatus;
        if (action === 'play') newStatus = 'Running';
        else if (action === 'pause') newStatus = 'Paused';
        else if (action === 'complete') newStatus = COMPLETED_TASK_STATUS;
        
        if (!newStatus) return;

        // API call to update status
        try {
            const payload = {
                Key: String(task.Key),
                Current_Status: newStatus,
                Updated_at: moment.utc().toISOString(),
                // Include other necessary keys for the backend to identify the task
                Delivery_code: task.Delivery_code,
            };

            const response = await fetch(`${BACKEND_API_BASE_URL}/api/status-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update status: ${response.statusText} - ${errorText.substring(0, 50)}...`);
            }

            // SUCCESS: Trigger a list refresh immediately
            setRefreshKey(prev => prev + 1); 
            
            notification.success({
                message: 'Status Updated',
                description: `Task ${task.Key} status changed to ${newStatus}.`,
                placement: 'topRight',
            });

        } catch (err) {
            console.error(`Error updating task status to ${action}:`, err);
            notification.error({
                message: 'Update Failed',
                description: `Could not update status: ${err.message}`,
                placement: 'topRight',
            });
        }
    }, []);

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
                    <p className="text-break">{error}</p>
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

    // Memoize the TaskCard rendering for better performance
    const renderedTaskCards = useMemo(() => {
        return tasks.map((task) => {
            const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
                ? task.Planned_Start_Timestamp.value
                : task.Planned_Start_Timestamp;
            
            const displayStatus = (rawPlannedStartTimestamp && task.Current_Status !== COMPLETED_TASK_STATUS && task.Current_Status === 'Scheduled')
                ? 'Scheduled' // Explicitly use 'Scheduled' if status is 'Scheduled' and not completed
                : task.Current_Status;
            
            return (
                <TaskCard
                    key={task.Key} 
                    task={task}
                    isActive={activeTaskKey === task.Key && actionType === 'edit'} // Controls form visibility
                    displayStatus={displayStatus}
                    onCardClick={handleCardClick} // Passes down the toggle function
                    onMenuItemClick={handleMenuItemClick}
                    onFormSubmit={handleFormSubmit}
                    currentUserEmail={userEmail}
                />
            );
        });
    }, [tasks, activeTaskKey, actionType, handleCardClick, handleMenuItemClick, handleFormSubmit, userEmail]);


    return (
        <Container className="delivery-detail-container mt-4">
            <h2 className="mb-4">Workflow: {deliveryDetails.Delivery_code}</h2>
            <Card className="mb-4 p-3" style={{backgroundColor: '#f8f9fa'}}>
                <p className="mb-1"><strong>Client:</strong> {deliveryDetails.Client}</p>
                <p className="mb-1"><strong>Description:</strong> {deliveryDetails.Short_Description}</p>
                <p className="mb-1"><strong>Planned Start:</strong> {deliveryDetails.Planned_Start_Timestamp ? moment.utc(deliveryDetails.Planned_Start_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
                <p className="mb-1"><strong>Planned Delivery:</strong> {deliveryDetails.Planned_Delivery_Timestamp ? moment.utc(deliveryDetails.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
                <p className="mb-0"><strong>Overall Status:</strong> <span className="badge bg-info text-dark">{deliveryDetails.Current_Status}</span></p>
            </Card>

            <h3 className="mt-5 mb-3">Tasks in this Workflow:</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
                {tasks.length > 0 ? (
                    renderedTaskCards
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
