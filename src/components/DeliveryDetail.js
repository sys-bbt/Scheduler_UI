import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt, FaEllipsisV } from 'react-icons/fa'; // Assuming react-icons is available
import 'rc-dropdown/assets/index.css'; // This CSS import is known to cause issues; relying on inline/global styles
import moment from 'moment'; // Assuming moment is available
import { notification } from 'antd'; // Assuming antd is available

// --- MOCK DEPENDENCIES (To resolve local file import errors) ---

// MOCK: UserContext (originally from './UserContext')
const UserContext = React.createContext({
    userEmail: 'mock.user@brightbraintech.com', // Provide a default/mock user
    // Add other necessary context values if needed
});

// MOCK: FormComponent (originally from './FormComponent')
const FormComponent = ({ onSubmit, task, currentUserEmail, isReadOnly }) => {
    // Minimal mock to simulate form submission effect
    const handleMockSubmit = (newStatus) => {
        // Construct a mock update payload
        const mockUpdate = {
            Key: task.Key,
            Current_Status: newStatus,
        };
        onSubmit(mockUpdate);
    };
    
    // Determine action text based on status for demonstration
    let actionText = 'Update Status';

    return (
        <Card className="p-3 bg-light shadow-sm border-0 mt-3">
            <h6 className="text-primary">{isReadOnly ? 'Task View' : 'Edit Task'}</h6>
            <div className="mb-2">
                <strong>Current Status:</strong> {task.Current_Status}
            </div>
            
            {isReadOnly && (
                <p className="text-warning small fst-italic">This task is currently **Scheduled** and its details cannot be modified.</p>
            )}
            
            {!isReadOnly && (
                <div className="d-flex gap-2">
                    {task.Current_Status !== 'Completed' && (
                        <>
                            <button 
                                className="btn btn-sm btn-success" 
                                onClick={() => handleMockSubmit('Running')}
                            >
                                Start/Play
                            </button>
                            <button 
                                className="btn btn-sm btn-warning" 
                                onClick={() => handleMockSubmit('Paused')}
                            >
                                Pause
                            </button>
                            <button 
                                className="btn btn-sm btn-danger" 
                                onClick={() => handleMockSubmit('Stopped')}
                            >
                                Stop
                            </button>
                            <button 
                                className="btn btn-sm btn-info" 
                                onClick={() => handleMockSubmit('Completed')}
                            >
                                Mark Completed (Mock)
                            </button>
                        </>
                    )}
                </div>
            )}
            
            <button 
                className="btn btn-sm btn-outline-secondary mt-2" 
                onClick={() => onSubmit(task)} // Just closes the form without changes
            >
                Close Form
            </button>
        </Card>
    );
};

// --- INLINED CSS (Originally from './DeliveryDetail.css' and rc-dropdown assets) ---
const CustomStyles = () => (
    <style jsx="true">{`
        .delivery-detail-container {
            max-width: 1200px;
            margin: auto;
        }
        .task-card {
            cursor: pointer;
            transition: all 0.3s ease;
            border-left: 5px solid #007bff;
        }
        .task-card:hover {
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(-2px);
        }
        .task-completed {
            opacity: 0.7;
            border-left: 5px solid #28a745;
            background-color: #f1fff1;
        }
        .task-scheduled-uneditable {
            cursor: not-allowed;
            background-color: #fff7e6;
            border-left: 5px solid #ffc107;
        }
        .active-task {
            border: 1px solid #007bff;
            box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
        }
    `}</style>
);
// ---------------------------------------------------------------------------------


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
    // Inject custom styles
    CustomStyles(); 

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

    // FIX: Wrap fetchDeliveryDetails in useCallback and include deliveryCode as dependency
    const fetchDeliveryDetails = useCallback(async () => {
        if (!deliveryCode) {
            setError("Delivery code not found in URL.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // UPDATED API ENDPOINT: Fetch all tasks for this workflow
            // Note: Since this is a mock environment, the fetch call will likely fail,
            // so we add mock data generation logic here for the UI to render.
            
            // --- MOCK DATA GENERATION START ---
            let data = [];
            if (deliveryCode === 'MOCK-123') {
                data = [
                    { Key: 'MOCK-123', Step_ID: 0, Delivery_code: 'MOCK-123', Client: 'Mock Client Inc.', Short_Description: 'Mock Workflow for Demo', Current_Status: 'In Progress', Planned_Start_Timestamp: new Date().toISOString(), Planned_Delivery_Timestamp: new Date(Date.now() + 86400000 * 5).toISOString() },
                    { Key: 'MOCK-123-T1', Step_ID: 1, Task_Details: 'Initial Setup', Responsibility: 'Dev', Current_Status: 'Completed', Planned_Start_Timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
                    { Key: 'MOCK-123-T2', Step_ID: 2, Task_Details: 'Data Processing', Responsibility: 'Data Engineer', Current_Status: 'Running', Planned_Start_Timestamp: new Date(Date.now() - 86400000 * 1).toISOString() },
                    { Key: 'MOCK-123-T3', Step_ID: 3, Task_Details: 'Analysis Phase', Responsibility: 'Analyst', Current_Status: 'Paused', Planned_Start_Timestamp: new Date(Date.now() - 86400000 * 0.5).toISOString() },
                    { Key: 'MOCK-123-T4', Step_ID: 4, Task_Details: 'Client Review', Responsibility: 'PM', Current_Status: 'Scheduled', Planned_Start_Timestamp: new Date(Date.now() + 86400000 * 2).toISOString() },
                ];
            } else {
                 // Try actual fetch first
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/workflow-details/${encodeURIComponent(deliveryCode)}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to fetch workflow details for ${deliveryCode}.`);
                }
                data = await response.json();
            }
            // --- MOCK DATA GENERATION END ---


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
            console.error("Error fetching delivery details (or using mock data):", err);
            // If API fails, fall back to mock data presentation if we haven't already
            if (tasks.length === 0 && deliveryCode === 'MOCK-123') {
                 // Already used mock data above, so just show error if it's not the specific mock code
                 setError(err.message);
            } else {
                 setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [deliveryCode]); 

    // FIX: Added fetchDeliveryDetails to the dependency array
    useEffect(() => {
        fetchDeliveryDetails();
    }, [fetchDeliveryDetails, userEmail, isAdmin]);


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
        // In a real app, we might call an update API here, then refetch or just update local state.
        // For this mock, we rely on the state update above, but call refetch for consistency.
        fetchDeliveryDetails(); 
    };

    // Modified handleActionClick to always set actionType to 'edit' when card is clicked
    const handleCardClick = (taskKey, statusToEvaluate) => { 
        // Log the exact status and the comparison result
        const isScheduled = statusToEvaluate === 'Scheduled';
        console.log(`Task Key: ${taskKey}, Status on click: "${statusToEvaluate}", isScheduled check: ${isScheduled}`);

        // Only open the form for editing if the task is NOT 'Scheduled'
        if (!isScheduled) { 
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
        // Keep as is, controlling dropdown visibility
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
            <p><strong>Planned Start:</strong> {deliveryDetails.Planned_Start_Timestamp ? moment.utc(deliveryDetails.Planned_Start_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Planned Delivery:</strong> {deliveryDetails.Planned_Delivery_Timestamp ? moment.utc(deliveryDetails.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Overall Status:</strong> {deliveryDetails.Current_Status}</p>

            <h3 className="mt-5 mb-3">Tasks in this Workflow:</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
                {tasks.length > 0 ? (
                    tasks.map((task) => {
                        const isTaskCompleted = task.Current_Status === COMPLETED_TASK_STATUS;
                        // Determine the status to display
                        // If it has a planned start timestamp AND is not 'Completed', show 'Scheduled'
                        // Otherwise, show its actual Current_Status
                        const displayStatus = (task.Planned_Start_Timestamp && task.Current_Status !== COMPLETED_TASK_STATUS)
                            ? 'Scheduled'
                            : task.Current_Status;
                        
                        // Use displayStatus for the isTaskScheduled check
                        const isTaskScheduled = displayStatus === 'Scheduled'; 

                        // Safely get the timestamp value, handling BigQuery's object structure
                        const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
                            ? task.Planned_Start_Timestamp.value
                            : task.Planned_Start_Timestamp;

                        return (
                            <Col key={task.Key}>
                                <Card
                                    className={`task-card ${isTaskCompleted ? 'task-completed' : ''} ${task.Key === activeTaskKey ? 'active-task' : ''} ${isTaskScheduled ? 'task-scheduled-uneditable' : ''}`}
                                    onClick={() => handleCardClick(task.Key, displayStatus)} // Pass displayStatus
                                >
                                    <Card.Body>
                                        <Card.Title>{task.Task_Details}</Card.Title>
                                        <Card.Text>
                                            <strong>Step ID:</strong> {task.Step_ID}<br />
                                            <strong>Responsibility:</strong> {task.Responsibility}<br />
                                            <strong>Status:</strong> {displayStatus} {/* Updated status display */}
                                        </Card.Text>
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            {rawPlannedStartTimestamp && ( // Use the safely extracted timestamp
                                                <p className="text-muted mb-0">
                                                    <FaCalendarAlt style={{ marginRight: '5px' }} />
                                                    {/* Parse as UTC, then format to YYYY-MM-DD */}
                                                    Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
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
