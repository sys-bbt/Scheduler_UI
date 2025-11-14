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
        {task.Current_Status === 'On Hold' && (
            <MenuItem key="start" onClick={() => onMenuItemClick(task.Key, 'start')}>
                Start Task
            </MenuItem>
        )}
        {task.Current_Status === 'In Progress' && (
            <>
                <MenuItem key="pause" onClick={() => onMenuItemClick(task.Key, 'pause')}>
                    Pause Task
                </MenuItem>
                <MenuItem key="complete" onClick={() => onMenuItemClick(task.Key, 'complete')}>
                    Mark as Completed
                </MenuItem>
            </>
        )}
        {task.Current_Status !== COMPLETED_TASK_STATUS && task.Current_Status !== 'In Progress' && (
            <MenuItem key="start" onClick={() => onMenuItemClick(task.Key, 'start')}>
                Start Task
            </MenuItem>
        )}
        {task.Current_Status === COMPLETED_TASK_STATUS && (
            <MenuItem key="reopen" onClick={() => onMenuItemClick(task.Key, 'reopen')}>
                Reopen Task
            </MenuItem>
        )}
        <MenuItem key="edit" onClick={() => onMenuItemClick(task.Key, 'edit')}>
            Edit Task Details
        </MenuItem>
    </Menu>
);

// Memoized TaskCard component for performance
const TaskCard = memo(({ task, isActive, displayStatus, onCardClick, onMenuItemClick, onFormSubmit, currentUserEmail }) => {
    // Memoize the time difference calculation for performance
    const timeDiff = useMemo(() => {
        const plannedDelivery = moment(task.Planned_Delivery_Timestamp.value || task.Planned_Delivery_Timestamp);
        const now = moment();
        const diffInDays = plannedDelivery.diff(now, 'days');

        if (displayStatus === COMPLETED_TASK_STATUS) {
            return { text: 'Completed', color: 'text-success' };
        } else if (diffInDays < 0) {
            return { text: `Overdue by ${Math.abs(diffInDays)} days`, color: 'text-danger' };
        } else if (diffInDays <= 3) {
            return { text: `Due in ${diffInDays} days`, color: 'text-warning' };
        } else {
            return { text: `Due in ${diffInDays} days`, color: 'text-muted' };
        }
    }, [task.Planned_Delivery_Timestamp, displayStatus]);

    const handleTimerClick = (action) => {
        if (action === 'start' && task.Current_Status !== 'In Progress') {
            onMenuItemClick(task.Key, 'start');
        } else if (action === 'pause' && task.Current_Status === 'In Progress') {
            onMenuItemClick(task.Key, 'pause');
        }
    };

    const isTaskAssignedToUser = (task.Email === currentUserEmail || task.Emails.includes(currentUserEmail));

    return (
        <Col xs={12} className="mb-3">
            <Card className={`task-card ${isActive ? 'active-card' : ''}`}>
                <Card.Body onClick={() => onCardClick(task.Key)}>
                    <Row className="align-items-center">
                        {/* Task Title and Details */}
                        <Col xs={10}>
                            <h5>{task.Task_Details}</h5>
                            <div className="task-meta">
                                <span className="me-3">ID: {task.Step_ID}</span>
                                <span className="me-3">
                                    <FaCalendarAlt className="me-1" />
                                    {moment(task.Planned_Delivery_Timestamp.value || task.Planned_Delivery_Timestamp).format('MMM D, YYYY')}
                                </span>
                                <span>Responsible: {task.Responsibility}</span>
                            </div>
                            <div className="task-status">
                                Status: <span className="fw-bold">{displayStatus}</span>
                            </div>
                            <div className={`time-diff ${timeDiff.color}`}>{timeDiff.text}</div>
                        </Col>

                        {/* Controls (Timer & Menu) */}
                        <Col xs={2} className="d-flex justify-content-end align-items-center">
                            <div className="timer-controls me-3">
                                {displayStatus === 'In Progress' ? (
                                    <FaPause
                                        className="text-primary me-2 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); handleTimerClick('pause'); }}
                                        title="Pause Task"
                                    />
                                ) : (
                                    <FaPlay
                                        className="text-success me-2 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); handleTimerClick('start'); }}
                                        title="Start Task"
                                    />
                                )}
                            </div>

                            <Dropdown
                                overlay={renderMenu(task, onMenuItemClick)}
                                trigger={['click']}
                                placement="bottomRight"
                                onClick={(e) => e.stopPropagation()} // Prevent card click when opening menu
                            >
                                <FaEllipsisV className="text-muted cursor-pointer" />
                            </Dropdown>
                        </Col>
                    </Row>
                </Card.Body>

                {/* Form Component - Hidden/Shown based on active state */}
                {isActive && actionType === 'edit' && (
                    <Card.Body>
                        <FormComponent
                            task={task}
                            onSubmit={onFormSubmit}
                            currentUserEmail={currentUserEmail}
                        />
                    </Card.Body>
                )}
            </Card>
        </Col>
    );
});


const DeliveryDetail = () => {
    // ----------------------------------------------------
    // START: ALL HOOKS MUST BE UNCONDITIONAL AND AT THE TOP
    // ----------------------------------------------------
    const { userEmail } = useContext(UserContext);
    const location = useLocation();

    // State for data fetching and display
    const [delivery, setDelivery] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for task interaction
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState(null); // 'edit', 'start', 'pause', 'complete', 'reopen'

    // Memoize the admin check (This is likely the hook that was conditionally placed)
    const isAdmin = useMemo(() => ADMIN_EMAILS_FRONTEND.includes(userEmail), [userEmail]);
    
    // Extract deliveryKey from location state
    const deliveryKey = useMemo(() => location.state?.deliveryKey, [location.state]);

    // HANDLERS
    const handleCardClick = useCallback((taskKey) => {
        // Toggle the form visibility for the clicked card
        setActiveTaskKey(prevKey => (prevKey === taskKey && actionType === 'edit') ? null : taskKey);
        setActionType('edit'); // Always switch to edit mode when clicking the card body
    }, [actionType]);

    const handleMenuItemClick = useCallback((taskKey, newActionType) => {
        // This is for menu actions (start, pause, edit, complete)
        if (newActionType === 'edit') {
            setActiveTaskKey(taskKey);
            setActionType('edit');
        } else {
            // For status change actions, we don't need to show the form, just trigger the status change
            // We'll call handleFormSubmit directly with the new action type
            handleFormSubmit(taskKey, null, newActionType);
        }
    }, []);

    const fetchDeliveryDetail = useCallback(async () => {
        if (!deliveryKey) {
            setError('No delivery key provided.');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/deliveries/${deliveryKey}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }
            const data = await response.json();
            
            // Format dates using moment object for internal consistency in forms/display
            const formattedTasks = data.tasks.map(task => ({
                ...task,
                Planned_Start_Timestamp: moment(task.Planned_Start_Timestamp),
                Planned_Delivery_Timestamp: moment(task.Planned_Delivery_Timestamp)
            }));
            
            setDelivery(data.delivery);
            setTasks(formattedTasks);
            setError(null);
        } catch (err) {
            console.error('Fetching error:', err);
            setError(`Error fetching delivery details: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [deliveryKey]);

    const handleFormSubmit = useCallback(async (taskKey, updatedFormData, action) => {
        setLoading(true);
        setActiveTaskKey(null); // Hide form/reset active state immediately
        setActionType(null);

        const currentTask = tasks.find(t => t.Key === taskKey);
        let payload = {};
        let endpoint = `/tasks/${taskKey}`;
        let method = 'PUT';

        if (action) {
            // Status update actions (start, pause, complete, reopen)
            let newStatus = currentTask.Current_Status;
            
            switch (action) {
                case 'start': newStatus = 'In Progress'; break;
                case 'pause': newStatus = 'On Hold'; break;
                case 'complete': newStatus = COMPLETED_TASK_STATUS; break;
                case 'reopen': newStatus = 'In Progress'; break;
                default: break;
            }
            payload = {
                ...currentTask,
                Current_Status: newStatus
            };
            // Send only necessary fields for status update
            payload = { 
                Key: payload.Key, 
                Delivery_code: payload.Delivery_code,
                Current_Status: newStatus,
                Responsibility: payload.Responsibility, // Ensure responsibility is also included
                Email: payload.Email
            };

        } else if (updatedFormData) {
            // Form submission for editing details
            payload = { 
                ...currentTask,
                ...updatedFormData,
                // Ensure date objects are converted back to ISO strings for the backend if needed
                Planned_Start_Timestamp: updatedFormData.Planned_Start_Timestamp ? updatedFormData.Planned_Start_Timestamp.toISOString() : null,
                Planned_Delivery_Timestamp: updatedFormData.Planned_Delivery_Timestamp ? updatedFormData.Planned_Delivery_Timestamp.toISOString() : null
            };
            // Remove moment objects from payload if any remain, keeping only ISO strings or original data
            payload.Planned_Start_Timestamp = payload.Planned_Start_Timestamp?.value || payload.Planned_Start_Timestamp;
            payload.Planned_Delivery_Timestamp = payload.Planned_Delivery_Timestamp?.value || payload.Planned_Delivery_Timestamp;
        }

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}${endpoint}`, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Update failed: ${response.statusText}`);
            }

            notification.success({
                message: 'Task Updated',
                description: `Task ${taskKey} was successfully updated.`,
            });
            
            // Re-fetch data to reflect changes
            await fetchDeliveryDetail();

        } catch (err) {
            console.error('Submission error:', err);
            notification.error({
                message: 'Update Failed',
                description: `Failed to update task: ${err.message}`,
            });
            setLoading(false);
        }
    }, [tasks, fetchDeliveryDetail]);

    // EFFECTS
    useEffect(() => {
        fetchDeliveryDetail();
    }, [fetchDeliveryDetail]);
    // ----------------------------------------------------
    // END: ALL HOOKS MUST BE UNCONDITIONAL AND AT THE TOP
    // ----------------------------------------------------


    // CONDITIONAL RENDERING (Safe now that all hooks are called)
    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5">
                <Alert variant="danger">
                    Error: {error}
                    <Link to="/" className="d-block mt-2">Go back to Deliveries</Link>
                </Alert>
            </Container>
        );
    }

    if (!delivery) {
        return (
            <Container className="mt-5">
                <Alert variant="warning">
                    Delivery data could not be loaded.
                    <Link to="/" className="d-block mt-2">Go back to Deliveries</Link>
                </Alert>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            <h2 className="mb-3">{delivery.Client} - {delivery.DelCode_w_o__}</h2>
            <p><strong>Description:</strong> {delivery.Description}</p>
            <p><strong>Delivery Deadline:</strong> {moment(delivery.Planned_Delivery_Timestamp).format('MMMM D, YYYY')}</p>
            <p><strong>Admin Status:</strong> {isAdmin ? 'Active' : 'Inactive'}</p>
            
            <Row>
                {tasks.length > 0 ? (
                    tasks.map(task => {
                        // Normalize the Planned_Start_Timestamp for display logic
                        const rawPlannedStartTimestamp = task.Planned_Start_Timestamp.value
                            ? task.Planned_Start_Timestamp.value
                            : task.Planned_Start_Timestamp;
                        
                        const displayStatus = (rawPlannedStartTimestamp && task.Current_Status !== COMPLETED_TASK_STATUS)
                            ? 'Scheduled'
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
