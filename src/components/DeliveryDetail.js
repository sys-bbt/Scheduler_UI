import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner, ProgressBar } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import { FiCheckCircle } from 'react-icons/fi';
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import { notification } from 'antd';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

const DeliveryDetail = () => {
    const location = useLocation();
    // *** CRITICAL FIX HERE: Changed regex to capture any characters (not just digits) for delCode ***
    // This allows for alphanumeric delivery codes like "DEL123-ABC"
    const delCodeMatch = location.pathname.match(/\/delivery\/(?:data\/)?(.+)/);
    const delCode = delCodeMatch ? delCodeMatch[1] : null;

    const { userEmail } = useContext(UserContext);
    console.log('DeliveryDetail (Render): userEmail from Context:', userEmail);
    console.log('DeliveryDetail (Render): Current pathname:', location.pathname);
    console.log('DeliveryDetail (Render): Extracted delCode:', delCode); // Added for debugging

    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]);
    const [deliveryCounts, setDeliveryCounts] = useState({ totalTasks: 0, plannedTasks: 0 });

    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            console.log('DeliveryDetail (useEffect): Starting fetchDeliveryDetails...');
            console.log('DeliveryDetail (useEffect): delCode:', delCode, 'userEmail:', userEmail);

            if (!delCode || !userEmail) {
                setLoading(false);
                if (!delCode) setError('Delivery Code not found in URL.');
                if (!userEmail) setError('User email not available. Please log in.');
                console.log('DeliveryDetail (useEffect): Skipping fetch due to missing delCode or userEmail.');
                return;
            }

            try {
                setLoading(true);
                setError(null); // Clear previous errors

                console.log(`DeliveryDetail (useEffect): Fetching /api/data?email=${userEmail}&delCode=${delCode}`);
                const deliveryResponse = await fetch(`${BACKEND_API_BASE_URL}/api/data?email=${userEmail}&delCode=${delCode}`);
                
                if (!deliveryResponse.ok) {
                    const errorText = await deliveryResponse.text();
                    console.error(`DeliveryDetail (useEffect): Backend /api/data fetch error: ${deliveryResponse.status} - ${errorText}`);
                    throw new Error(`HTTP error! status: ${deliveryResponse.status}, message: ${errorText}`);
                }
                const deliveryData = await deliveryResponse.json();
                console.log('DeliveryDetail (useEffect): Backend /api/data response:', deliveryData);

                console.log(`DeliveryDetail (useEffect): Fetching /api/per-key-per-day`);
                const durationResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                if (!durationResponse.ok) {
                    const errorText = await durationResponse.text();
                    console.error(`DeliveryDetail (useEffect): Backend /api/per-key-per-day fetch error: ${durationResponse.status} - ${errorText}`);
                    throw new Error(`HTTP error! status: ${durationResponse.status}, message: ${errorText}`);
                }
                const durationData = await durationResponse.json();
                console.log('DeliveryDetail (useEffect): Backend /api/per-key-per-day response:', durationData);


                if (deliveryData.hasOwnProperty(delCode)) {
                    const allTasksForDelCode = deliveryData[delCode];
                    console.log('DeliveryDetail (useEffect): All tasks for delCode from backend:', allTasksForDelCode);
                    
                    const mainDeliveryEntry = allTasksForDelCode.find(task => task.Step_ID === 0);
                    if (mainDeliveryEntry) {
                        setDeliveryCounts({
                            totalTasks: mainDeliveryEntry.Total_Tasks || 0,
                            plannedTasks: mainDeliveryEntry.Planned_Tasks || 0,
                        });
                        console.log('DeliveryDetail (useEffect): Initial deliveryCounts set to:', {
                            totalTasks: mainDeliveryEntry.Total_Tasks || 0,
                            plannedTasks: mainDeliveryEntry.Planned_Tasks || 0,
                        });
                    } else {
                        console.warn('DeliveryDetail (useEffect): Main delivery entry (Step_ID = 0) not found for delCode:', delCode);
                        setDeliveryCounts({ totalTasks: 0, plannedTasks: 0 });
                    }

                    // Now, all sub-tasks (Step_ID !== 0) will be fetched and displayed.
                    // The 'scheduled' status will be derived for rendering logic.
                    const fetchedTasks = allTasksForDelCode
                       .filter((task) => task.Step_ID !== 0) // Only filter out the main delivery entry
                        .map((task) => {
                            const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;
                            const hours = Math.floor(taskDurationInMinutes / 60);
                            const minutes = taskDurationInMinutes % 60;
                            const formattedDuration = `${hours}h ${minutes}m`;

                            const isScheduled = !!task.Planned_Delivery_Timestamp && 
                                (typeof task.Planned_Delivery_Timestamp === 'string' 
                                    ? task.Planned_Delivery_Timestamp !== "NULL" && task.Planned_Delivery_Timestamp !== ""
                                    : task.Planned_Delivery_Timestamp.value !== null && task.Planned_Delivery_Timestamp.value !== "");

                            return {
                                ...task,
                                scheduled: isScheduled,
                                personResponsible: task.Responsibility || 'Unassigned',
                                totalTime: taskDurationInMinutes,
                                formattedDuration,
                                isPlaying: false,
                            };
                        });
                    setDelivery(allTasksForDelCode);
                    setTasks(fetchedTasks);
                    console.log('DeliveryDetail (useEffect): Final fetched tasks (after filtering Step_ID=0):', fetchedTasks);
                } else {
                    setError(`Delivery with code "${delCode}" not found in fetched data.`);
                    console.error(`DeliveryDetail (useEffect): Delivery with code "${delCode}" not found in fetched data.`);
                }
            } catch (err) {
                console.error('DeliveryDetail (useEffect): Error fetching delivery details:', err);
                setError(`Failed to fetch delivery details: ${err.message}`);
            } finally {
                setLoading(false);
                console.log('DeliveryDetail (useEffect): Finished fetchDeliveryDetails. Loading state:', false);
            }
        };

        fetchDeliveryDetails();
    }, [delCode, userEmail, BACKEND_API_BASE_URL]);

    const handleFormSubmit = async (formData) => {
        console.log("DeliveryDetail (handleFormSubmit): Form submitted data:", formData);
        
        const updatedTask = tasks.find(t => t.Key === activeTaskKey);
        const wasNewlyScheduled = !updatedTask?.scheduled && (formData.totalTime || 0) > 0;
        console.log("DeliveryDetail (handleFormSubmit): wasNewlyScheduled:", wasNewlyScheduled);

        const updatedTasksList = tasks.map((task) =>
            task.Key === activeTaskKey
                ? {
                      ...task,
                      scheduled: true,
                      personResponsible: formData.personResponsible || task.personResponsible,
                      totalTime: formData.totalTime || task.totalTime,
                      formattedDuration: `${Math.floor((formData.totalTime || 0) / 60)}h ${ (formData.totalTime || 0) % 60}m`,
                      Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp || task.Planned_Delivery_Timestamp,
                  }
                : task
        );
        setTasks(updatedTasksList);
        setActiveTaskKey(null);

        if (wasNewlyScheduled) {
            const newPlannedTasksCount = deliveryCounts.plannedTasks + 1;
            const newTotalTasksCount = deliveryCounts.totalTasks; // Total tasks don't change on scheduling a sub-task
            console.log("DeliveryDetail (handleFormSubmit): Incrementing planned tasks count to:", newPlannedTasksCount);
            setDeliveryCounts(prev => ({ ...prev, plannedTasks: newPlannedTasksCount }));

            try {
                console.log(`DeliveryDetail (handleFormSubmit): Calling backend to update delivery counts for ${delCode}. Planned: ${newPlannedTasksCount}, Total: ${newTotalTasksCount}`);
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/delivery_counts/${delCode}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ newPlannedTasks: newPlannedTasksCount, newTotalTasks: newTotalTasksCount }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to update delivery counts: ${response.status} - ${errorText}`);
                }
                notification.success({
                    message: 'Delivery Counts Updated',
                    description: `Planned tasks for delivery ${delCode} updated successfully on backend!`,
                });
            } catch (error) {
                console.error('DeliveryDetail (handleFormSubmit): Error updating delivery counts on backend:', error);
                notification.error({
                    message: 'Update Failed',
                    description: `Failed to update delivery planned tasks on backend: ${error.message}`,
                });
                setDeliveryCounts(prev => ({ ...prev, plannedTasks: prev.plannedTasks - 1 })); // Rollback local state
            }
        }
    };

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

    const toggleTimer = (taskKey) => {
        const updatedTasks = tasks.map((task) => {
            if (task.Key === taskKey) {
                return { ...task, isPlaying: !task.isPlaying };
            }
            return task;
        });
        setTasks(updatedTasks);
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'No start time';
        // Handle both BigQuery's { value: "..." } and direct string timestamps
        const dateValue = typeof timestamp === 'object' && timestamp.value ? timestamp.value : timestamp;
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
    };

    const taskMenu = (task) => (
        <Menu onClick={(info) => handleMenuClick(task, info)}>
            <MenuItem key="reschedule">Reschedule Task</MenuItem>
            <MenuItem key="reassign">Reassign Task</MenuItem>
        </Menu>
    );

    if (loading) {
        return (
            <Container className="text-center my-5">
                <Spinner animation="border" role="status">
                    <span className="sr-only">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="text-center my-5">
                <p className="text-danger">{error}</p>
                <Link to="/">Back to Deliveries</Link>
            </Container>
        );
    }

    if (!delivery || delivery.length === 0) {
        return (
            <Container className="text-center my-5">
                <p>No delivery data found for code: {delCode}</p>
                <Link to="/">Back to Deliveries</Link>
            </Container>
        );
    }

    const mainDeliveryDisplay = delivery.find(task => task.Step_ID === 0) || delivery[0];

    const client = mainDeliveryDisplay?.Client || 'Unknown Client';
    const shortDescription = mainDeliveryDisplay?.Short_Description || 'No description available';
    const plannedStart = formatTimestamp(mainDeliveryDisplay?.Planned_Start_Timestamp);
    const plannedDelivery = formatTimestamp(mainDeliveryDisplay?.Planned_Delivery_Timestamp);

    const progress =
        deliveryCounts.totalTasks === 0 ? 0 : (deliveryCounts.plannedTasks / deliveryCounts.totalTasks) * 100;

    return (
        <Container>
            <h1 className="my-4">Delivery Details for {client}</h1>

            <Card className="mb-4">
                <Card.Body>
                    <Card.Title>{shortDescription}</Card.Title>
                    <Card.Subtitle className="mb-2 text-muted">
                        Start Time: {plannedStart}
                    </Card.Subtitle>
                    <Card.Subtitle className="mb-2 text-muted">
                        Delivery Deadline: {plannedDelivery}
                    </Card.Subtitle>
                </Card.Body>
            </Card>

            <h3>Tasks</h3>
            <Row>
                 <Col xs={12}>
                    <Card className="p-3 shadow-sm task-card mb-3">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="d-flex align-items-center mb-2">
                                        <FiCheckCircle style={{ marginRight: '8px', color: 'green' }} />
                                        <span className="font-weight-bold" style={{ fontSize: '1.5rem' }}>
                                            {deliveryCounts.plannedTasks} of {deliveryCounts.totalTasks} Planned
                                        </span>
                                    </div>
                                    <div className="mb-2">
                                        <ProgressBar
                                            now={progress}
                                            variant={progress > 50 ? 'success' : progress > 20 ? 'warning' : 'danger'}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                {tasks.length > 0 ? (
                    tasks.map((task, index) => {
                        const displayDuration = task.totalTime || task.formattedDuration || '0m';

                        return (
                            <Col xs={12} key={task.Key || index}>
                                <Dropdown trigger={['contextMenu']} overlay={taskMenu(task)}>
                                    <div
                                        className="task-card"
                                        onClick={() => handleTaskClick(task)}
                                        style={{ cursor: task.scheduled ? 'default' : 'pointer' }}
                                    >
                                        <Card className="mb-3">
                                            <Card.Body>
                                                <div className="d-flex align-items-center">
                                                    <div className="timer-controls" style={{ marginRight: '10px' }}>
                                                        {!task.scheduled ? (
                                                            <FaCalendarAlt
                                                                onClick={() => handleTaskClick(task)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        ) : (
                                                            <>
                                                                {task.isPlaying ? (
                                                                    <FaPause
                                                                        onClick={() => toggleTimer(task.Key)}
                                                                        style={{ cursor: 'pointer' }}
                                                                    />
                                                                ) : (
                                                                    <FaPlay
                                                                        onClick={() => toggleTimer(task.Key)}
                                                                        style={{ cursor: 'pointer' }}
                                                                    />
                                                                )}
                                                                <FaStop
                                                                    onClick={() => toggleTimer(task.Key)}
                                                                    style={{ cursor: 'pointer', marginLeft: '5px' }}
                                                                />
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="flex-grow-1 text-center">
                                                        <h5 className="mb-1">{task.Task_Details}</h5>
                                                        <span className="text-muted">{task.personResponsible}</span>
                                                    </div>

                                                    <span>{displayDuration}</span>
                                                </div>

                                                <div className="task-status mt-2">
                                                    {task.isPlaying ? (
                                                        <p className="text-success">On time for going live</p>
                                                    ) : (
                                                        <p className="text-muted">Paused</p>
                                                    )}
                                                </div>

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
