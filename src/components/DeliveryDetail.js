import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner, Alert } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const COMPLETED_TASK_STATUS = 'Completed'; 

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
    const delCode = delCodeMatch ? delCodeMatch[1] : null;

    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]);

    const fetchDeliveryDetails = useCallback(async () => {
        if (!delCode || !userEmail) {
            setLoading(false);
            if (!delCode) setError('Delivery Code not found in URL.');
            if (!userEmail) setError('User email not available. Please log in.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch delivery data (tasks)
            const deliveryResponse = await fetch(`${BACKEND_API_BASE_URL}/api/data?email=${userEmail}&delCode=${delCode}&isAdmin=${isAdmin}`);
            if (!deliveryResponse.ok) {
                const errorText = await deliveryResponse.text();
                throw new Error(`HTTP error! status: ${deliveryResponse.status}, message: ${errorText}`);
            }
            const deliveryData = await deliveryResponse.json();

            // Fetch per-key-per-day duration data
            const durationResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
            if (!durationResponse.ok) {
                const errorText = await durationResponse.text();
                throw new Error(`HTTP error! status: ${durationResponse.status}, message: ${errorText}`);
            }
            const durationData = await durationResponse.json();

            if (deliveryData.hasOwnProperty(delCode)) {
                const fetchedTasks = deliveryData[delCode]
                    .filter((task) => task.Step_ID !== 0 && task.Current_Status !== COMPLETED_TASK_STATUS)
                    .map((task) => {
                        const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;
                        const hours = Math.floor(taskDurationInMinutes / 60);
                        const minutes = taskDurationInMinutes % 60;
                        const formattedDuration = `${hours}h ${minutes}m`;

                        return {
                            ...task,
                            scheduled: !!task.Planned_Delivery_Timestamp && (typeof task.Planned_Delivery_Timestamp === 'string' ? task.Planned_Delivery_Timestamp !== "NULL" : task.Planned_Delivery_Timestamp.value !== null),
                            personResponsible: task.Responsibility || 'Unassigned',
                            totalTime: taskDurationInMinutes,
                            formattedDuration,
                            isPlaying: false, // Initial state, not from API
                        };
                    });
                setDelivery(deliveryData[delCode][0]); // Assuming the first item has the main delivery details
                setTasks(fetchedTasks);
            } else {
                setError(`Delivery with code "${delCode}" not found in fetched data.`);
            }
        } catch (err) {
            console.error('Error fetching delivery details:', err);
            setError(`Failed to fetch delivery details: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [delCode, userEmail, isAdmin]); // FIX: Removed BACKEND_API_BASE_URL

    useEffect(() => {
        fetchDeliveryDetails();
    }, [fetchDeliveryDetails]); 

    const handleTaskClick = (task) => {
        if (!task.scheduled) {
            setActionType('Schedule');
            setActiveTaskKey(task.Key);
        }
    };

    const handleMenuClick = (task, { key }) => {
        if (key === 'reschedule') {
            setActionType('Reschedule');
        } else if (key === 'reassign') {
            setActionType('Reassign');
        }
        setActiveTaskKey(task.Key);
    };

    const handleFormSubmit = async (formData) => {
        try {
            // API call to submit the scheduled data
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/schedule-task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to submit form: ${response.status}`);
            }

            // After a successful submission, clear the form and refresh the data
            setActiveTaskKey(null);
            setActionType('');
            await fetchDeliveryDetails();

        } catch (error) {
            console.error('Error submitting form:', error);
            setError(`Failed to save task schedule: ${error.message}`);
            // Do not clear form/task if there was an error
        }
    };

    const handleTimerAction = async (taskKey, action) => {
        // Send action to backend
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/timer-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    taskKey, 
                    action, // 'start' or 'pause'
                    userEmail, 
                    timestamp: new Date().toISOString()
                }),
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Timer action failed: ${response.status} - ${errorText}`);
            }
            
            // Optimistic UI update
            setTasks((currentTasks) =>
                currentTasks.map((task) => {
                    if (task.Key === taskKey) {
                        return { ...task, isPlaying: action === 'start' };
                    }
                    return task;
                })
            );
        } catch (error) {
            console.error(`Error performing timer action (${action}):`, error);
            setError(`Failed to perform timer action: ${error.message}`);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'No start time';
        // Handle BigQuery-style object or raw timestamp
        const date = new Date(timestamp?.value || timestamp); 
        return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
    };

    const taskMenu = (task) => (
        <Menu onClick={(info) => handleMenuClick(task, info)}>
            <MenuItem key="reschedule">Reschedule Task</MenuItem>
            <MenuItem key="reassign" disabled={!isAdmin}>Reassign Task</MenuItem>
        </Menu>
    );

    if (loading) {
        return (
            <Container className="text-center mt-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;
    }
    
    if (!delivery) {
         return <Container className="mt-5"><Alert variant="warning">Delivery details could not be loaded.</Alert></Container>;
    }


    return (
        <Container>
            <h1 className="my-4">{delivery.Client} - {delivery.Delivery_code}</h1>
            <p className="lead">
                Total Tasks: {tasks.length + (delivery.Step_ID === 0 ? 1 : 0)} | 
                Progress: {delivery.Current_Status}
            </p>

            <Row>
                {tasks.length > 0 ? (
                    tasks.map((task) => (
                        <Col xs={12} key={task.Key}>
                            <Dropdown
                                trigger={['contextMenu']}
                                overlay={taskMenu(task)}
                                animation="slide-up"
                            >
                                <div onClick={() => handleTaskClick(task)}>
                                    <Card className={`task-card mb-3 ${!task.scheduled ? 'bg-warning-subtle' : ''}`}>
                                        <Card.Body>
                                            <Row className="align-items-center">
                                                <Col xs={8}>
                                                    <h5 className="task-title">{task.Task_Details}</h5>
                                                    <p className="task-meta mb-1">
                                                        Assigned to: <strong>{task.personResponsible}</strong>
                                                    </p>
                                                    <p className="task-meta mb-1">
                                                        Start: {formatTimestamp(task.Planned_Start_Timestamp)} | 
                                                        End: {formatTimestamp(task.Planned_Delivery_Timestamp)}
                                                    </p>
                                                    <p className="task-status">
                                                        Status: <strong>{task.Current_Status}</strong> | 
                                                        Total Time: <strong>{task.formattedDuration}</strong>
                                                    </p>
                                                </Col>

                                                <Col xs={4} className="text-end timer-controls">
                                                    {!task.scheduled && (
                                                        <FaCalendarAlt 
                                                            className="text-primary me-3" 
                                                            title="Click to Schedule" 
                                                        />
                                                    )}
                                                    
                                                    {task.scheduled && (
                                                        <>
                                                            {task.isPlaying ? (
                                                                <FaPause
                                                                    className="text-primary me-3"
                                                                    onClick={(e) => { e.stopPropagation(); handleTimerAction(task.Key, 'pause'); }}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                            ) : (
                                                                <FaPlay
                                                                    className="text-success me-3"
                                                                    onClick={(e) => { e.stopPropagation(); handleTimerAction(task.Key, 'start'); }}
                                                                    style={{ cursor: 'pointer' }}
                                                                />
                                                            )}
                                                            <FaStop
                                                                className="text-danger"
                                                                onClick={(e) => { e.stopPropagation(); /* Implement stop/complete logic */ }}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        </>
                                                    )}
                                                </Col>
                                            </Row>
                                            
                                            {activeTaskKey === task.Key && actionType && (
                                                <div className="mt-3">
                                                    <h6>{actionType} Task: {task.Task_Details}</h6>
                                                    <FormComponent
                                                        onSubmit={handleFormSubmit}
                                                        task={task}
                                                        currentUserEmail={userEmail}
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
                    <ListGroup.Item>
                         <p className="text-center mt-3 mb-0">No active tasks available for this delivery. 
                            It might be completed or pending initial setup.</p>
                    </ListGroup.Item>
                )}
            </Row>

            <Link to="/" className="btn btn-primary mt-4">
                Back to Deliveries
            </Link>
        </Container>
    );
};

export default DeliveryDetail;
