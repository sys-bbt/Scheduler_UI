import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Row, Col, Spinner, Alert, ListGroup } from 'react-bootstrap'; 
// NOTE: Card, Dropdown, Button were removed from here as they are now used in TaskCard.js

import { FaCalendarAlt } from 'react-icons/fa'; // Kept FaCalendarAlt as it's used in TaskCard's helper function (renderMenu) if TaskCard.js imports it.
// If TaskCard.js is defined in a separate file, you should remove all imports only used by TaskCard.

// 🟢 NEW IMPORT: Import the TaskCard component from its separate file
import TaskCard from './TaskCard'; 
import { UserContext } from './UserContext'; 
// import 'rc-dropdown/assets/index.css'; // This CSS import should also likely stay here or in a root file if it affects the global app
import './DeliveryDetail.css';
import moment from 'moment';
import { notification } from 'antd';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

// 🟢 STATUS CONSTANTS - Kept here as they are used in the main component's logic (handleCardClick, useEffect, mapping logic)
const COMPLETED_TASK_STATUS = 'Completed';
const NOT_REQUIRED_TASK_STATUS = 'Not Required';
const SCHEDULED_STATUS = 'Scheduled'; // Used locally for display logic

const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// ❌ REMOVED: renderMenu helper function (it must now be inside TaskCard.js or TaskCard's module)
// ❌ REMOVED: TaskCard Component definition

// DeliveryDetail component definition
const DeliveryDetail = () => {
    const location = useLocation();
    const delCodeMatch = location.pathname.match(/\/delivery\/data\/(.*)/);
    const deliveryCode = delCodeMatch ? decodeURIComponent(delCodeMatch[1]) : null;

    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState(null); 
    const [refreshKey, setRefreshKey] = useState(0); 

    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

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

                const mainDeliveryDetail = data.find(task => task.Step_ID === 0);
                setDeliveryDetails(mainDeliveryDetail || data[0]); 

                const tasksToDisplay = data.filter(task => task.Step_ID !== 0)
                .filter(task => 
                    task.Current_Status !== COMPLETED_TASK_STATUS && 
                    task.Current_Status !== NOT_REQUIRED_TASK_STATUS
                );

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
    }, [deliveryCode, userEmail, isAdmin, refreshKey]);


    const handleStatusUpdate = useCallback(async (key, status) => {
        
        setActiveTaskKey(null); // Close any open form
        setActionType(null);

        const confirmAction = window.confirm(`Are you sure you want to mark task Key ${key} as "${status}"?`);
        if (!confirmAction) return;

        notification.info({
            message: 'Updating Task Status',
            description: `Sending request to mark Key ${key} as ${status}...`,
            duration: 5,
            key: 'statusUpdate'
        });

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/task/status-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: key,
                    email: userEmail, // Logged-in user's email
                    status: status, // 'Complete' or 'Not Required'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to update status for Key ${key}.`);
            }

// 1. 🟢 INSTANT OPTIMISTIC REMOVAL: 
        // If the status is final (Complete or Not Required), remove the task from the local list.
        if (status === 'Complete' || status === 'Not Required') {
            setTasks(prevTasks => 
                prevTasks.filter(task => task.Key !== key)
            );
        } else {
            // Keep the old map logic if you ever decide to use a non-final status update
            setTasks(prevTasks =>
                prevTasks.map(task =>
                    task.Key === key ? { ...task, Current_Status: status } : task
                )
            );
        }

            // 2. Success notification
            notification.success({
                message: 'Status Update Successful',
                description: `Task Key ${key} has been successfully marked as **${status}**.`,
                key: 'statusUpdate'
            });

            // 3. Trigger re-fetch for fresh data and accurate overall status display (after a short delay)
            setTimeout(() => setRefreshKey(prev => prev + 1), 1000);

        } catch (err) {
            console.error("Error updating task status:", err);
            notification.error({
                message: 'Status Update Failed',
                description: err.message,
                key: 'statusUpdate'
            });
            // Re-fetch to revert any inaccurate local state in case of failure
            setRefreshKey(prev => prev + 1);
        }
    }, [userEmail]);


    const handleFormSubmit = useCallback((updatedTaskData) => {
    // Optimistic update of tasks
    setTasks(prevTasks =>
        prevTasks.map(task =>
            task.Key === updatedTaskData.Key
                ? { ...task, ...updatedTaskData }
                : task
        )
    );
    
    // NEW LOGIC: Wait 2 seconds, then close the form and refresh.
    setTimeout(() => {
        setActiveTaskKey(null); 
        setActionType(null);
        // Trigger re-fetch for fresh data and accurate status display
        setRefreshKey(prev => prev + 1); 
    }, 2000); // Wait 2 seconds
}, []);

    // CLICK HANDLER: Controls the activeTaskKey state
    const handleCardClick = useCallback((taskKey, displayStatus) => {
        const isScheduled = displayStatus === SCHEDULED_STATUS;
        
        // This check is important to prevent opening the form for scheduled tasks
        if (isScheduled) { 
            notification.info({
                message: 'Task Already Scheduled',
                description: 'This task has a Planned Start Date and cannot be rescheduled.',
            });
            setActiveTaskKey(null);
            setActionType(null);
            return;
        }

        if (activeTaskKey === taskKey) {
            // Close the currently active card
            setActiveTaskKey(null);
            setActionType(null);
        } else {
            // Open the new card
            setActiveTaskKey(taskKey);
            setActionType('edit');
        }
    }, [activeTaskKey]); 

    const handleMenuItemClick = useCallback((taskKey, type) => {
        // Temporary block for P/P/S actions
        notification.info({
            message: 'Status Change Disabled',
            description: `API for ${type} is not yet implemented.`,
        });
        setActiveTaskKey(null);
        setActionType(null);
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
                        const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
                            ? task.Planned_Start_Timestamp.value
                            : task.Planned_Start_Timestamp;
                        
                        const displayStatus = (rawPlannedStartTimestamp && task.Current_Status !== COMPLETED_TASK_STATUS && task.Current_Status !== NOT_REQUIRED_TASK_STATUS)
                            ? SCHEDULED_STATUS
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
                                onStatusUpdate={handleStatusUpdate} // NEW PROP
                                currentUserEmail={userEmail}
                                isAdmin={isAdmin} // NEW PROP
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
