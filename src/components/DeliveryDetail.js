// DeliveryDetails.js
import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Row, Col, Spinner, Alert, ListGroup } from 'react-bootstrap';

import { FaCalendarAlt } from 'react-icons/fa';
import TaskCard from './TaskCard';

// 💡 CORRECT IMPORT: Import useUser and UserContext (if needed, though useUser is preferred)
import { useUser } from './UserContext'; 
import './DeliveryDetail.css';
import moment from 'moment';
import { notification, Modal } from 'antd';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

// STATUS CONSTANTS 
const COMPLETED_TASK_STATUS = 'Complete';
const NOT_REQUIRED_TASK_STATUS = 'Not Required';
const SCHEDULED_STATUS = 'Scheduled'; // Used locally for display logic

// 🛑 IMPORTANT: The hardcoded ADMIN_EMAILS_FRONTEND array has been REMOVED.
// The admin status is now sourced securely from UserContext.

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

    // 🟢 CORRECT IMPLEMENTATION: Get userEmail and isAdmin from the secure context
    const { userEmail, isAdmin } = useUser(); 

    // useEffect dependency cleanup: Removed isAdmin from dependency array as it's now handled correctly
    // by UserContext and does not need to trigger the fetch.
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

        // Removed isAdmin from dependency list as its primary job is not to trigger the fetch
        // (fetch only needs to run on deliveryCode or userEmail change).
        fetchDeliveryDetails();
    }, [deliveryCode, userEmail, refreshKey]);


    // 💡 MODIFICATION 2: Replacing window.confirm with Modal.confirm
    const handleStatusUpdate = useCallback(async (key, status) => { 
        
        // 🛑 NEW CHECK: Prevent non-admin users from updating status
        if (!isAdmin) {
             notification.error({
                message: 'Permission Denied',
                description: 'You do not have administrative privileges to update task status.',
                duration: 5,
            });
            return;
        }

        setActiveTaskKey(null); // Close any open form
        setActionType(null);

        // Use Ant Design Modal.confirm for status update confirmation
        Modal.confirm({
            title: 'Confirm Task Status Update',
            content: `Are you sure you want to mark task as "${status}"?`,
            okText: 'Confirm',
            cancelText: 'Cancel',
            onOk: async () => { // The actual update logic runs inside onOk
                
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
                    if (status === 'Complete' || status === 'Not Required') {
                        setTasks(prevTasks => 
                            prevTasks.filter(task => task.Key !== key)
                        );
                    } else {
                        // This else block is kept for future status types if needed
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
            },
            onCancel: () => {
                // User clicked cancel, do nothing
            },
        });
    }, [userEmail, isAdmin]); // 💡 ADDED isAdmin to dependency array

    // ... (rest of the component, handleFormSubmit, handleCardClick, handleMenuItemClick, loading/error blocks)

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
                                onStatusUpdate={handleStatusUpdate} 
                                currentUserEmail={userEmail}
                                isAdmin={isAdmin} // Passes the context-derived status
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
