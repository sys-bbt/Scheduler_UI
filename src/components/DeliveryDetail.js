import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner, Alert } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaEllipsisV } from 'react-icons/fa';
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';
import moment from 'moment';
import { notification } from 'antd';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const COMPLETED_TASK_STATUS = 'Completed'; 

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
                            // isTaskScheduled is a better name for checking if planned dates exist
                            isTaskScheduled: !!task.Planned_Delivery_Timestamp && 
                                (typeof task.Planned_Delivery_Timestamp === 'string' ? task.Planned_Delivery_Timestamp !== "NULL" : task.Planned_Delivery_Timestamp.value !== null),
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
    }, [delCode, userEmail, isAdmin]);

    useEffect(() => {
        fetchDeliveryDetails();
    }, [fetchDeliveryDetails]); 

    
    const handleTaskClick = (task) => {
        // Do nothing on card click, form is only opened via the dropdown menu for reassign.
    };

    const handleMenuClick = (task, { key }) => {
        if (key === 'reassign' && isAdmin) {
            setActionType('Reassign');
            setActiveTaskKey(task.Key);
        } else if (key === 'reschedule' || key === 'schedule') {
             // Block the old scheduling/rescheduling actions, as the form is removed
             notification.warning({
                message: 'Action Not Available',
                description: 'Scheduling/Rescheduling is disabled. Use this interface for Reassign only.',
            });
        }
    };
    

    const handleFormSubmit = async (formData) => {
        // REVERTED: Use the original /api/schedule-task endpoint to ensure BQ Per_Key_per_Day logic is triggered
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/schedule-task`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to update task: ${response.status}`);
            }
            
            notification.success({
                message: 'Task Updated',
                description: `Responsibility for task ${formData.taskKey} has been updated. (BQ record created).`,
            });

            // After a successful submission, clear the form and refresh the data
            setActiveTaskKey(null);
            setActionType('');
            await fetchDeliveryDetails();

        } catch (error) {
            console.error('Error submitting form:', error);
            setError(`Failed to save task update: ${error.message}`);
        }
    };

    const handleTimerAction = async (taskKey, action) => {
        // Timer action logic remains the same
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
            
            notification.info({
                message: 'Timer Action',
                description: `Timer for task ${taskKey} ${action}ed.`,
            });
            
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
        const date = moment(timestamp?.value || timestamp);
        return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : 'Invalid date';
    };

    const taskMenu = (task) => (
        <Menu onClick={(info) => handleMenuClick(task, info)}>
            {/* Disabled Reschedule/Schedule option */}
            <MenuItem key="schedule" disabled={task.isTaskScheduled}>Schedule Task (Disabled)</MenuItem> 
            <MenuItem key="reschedule" disabled={!task.isTaskScheduled}>Reschedule Task (Disabled)</MenuItem> 
            {/* Only Reassign is now active/useful */}
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
                            
                            <Card className={`task-card mb-3 ${!task.isTaskScheduled ? 'bg-warning-subtle' : ''}`}>
                                <Card.Body onClick={() => handleTaskClick(task)}>
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
                                            
                                            {/* Timer Controls */}
                                            {task.isTaskScheduled && (
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
                                                        className="text-danger me-3"
                                                        onClick={(e) => { e.stopPropagation(); /* Implement stop/complete logic */ }}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </>
                                            )}
                                            
                                            {/* Dropdown Menu (for Reassign) */}
                                            <Dropdown
                                                trigger={['click']}
                                                overlay={taskMenu(task)}
                                                animation="slide-up"
                                                placement="bottomRight"
                                            >
                                                <FaEllipsisV style={{ cursor: 'pointer' }} />
                                            </Dropdown>

                                        </Col>
                                    </Row>
                                    
                                    {activeTaskKey === task.Key && actionType && (
                                        <div className="mt-3">
                                            <h6>{actionType} Task: {task.Task_Details}</h6>
                                            <FormComponent
                                                onSubmit={handleFormSubmit}
                                                task={task}
                                                currentUserEmail={userEmail}
                                                actionType={actionType}
                                            />
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                            
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
