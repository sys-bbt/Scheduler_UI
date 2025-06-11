import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react'; // Added useCallback, useMemo
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

const DeliveryDetail = () => {
    const location = useLocation();
    // Assuming your route is something like /delivery/:delCode or /data/:delCode
    // We'll try both to be sure.
    // const { delCode: paramsDelCode } = useParams(); // Option 1: if using route params

    // Current location-based extraction
    const extractedDelCodeByPath = location.pathname.substring(location.pathname.lastIndexOf("/") + 1);

    // This is the problematic line from your initial code - let's see what it yields
    const extractedDelCodeByOldLogic = location.pathname.substring(location.pathname.lastIndexOf("/data/") + 11);

    console.log("------------------- DEBUGGING DELCODE -------------------");
    console.log("location.pathname:", location.pathname);
    console.log("Extracted delCode (from last /):", extractedDelCodeByPath);
    console.log("Extracted delCode (from old logic /data/ + 11):", extractedDelCodeByOldLogic);
    // if (paramsDelCode) {
    //     console.log("Extracted delCode (from useParams):", paramsDelCode); // Option 1: if using route params
    // }
    console.log("---------------------------------------------------------");

    // The delCode you *intend* to use. Let's start with the last segment
    const delCode = extractedDelCodeByPath; // Or `paramsDelCode` if you are using route params properly

    const { userEmail } = useContext(UserContext);
    const [delivery, setDelivery] = useState(null); // State for the main delivery details (if fetched)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]); // State to manage ALL tasks fetched for this delivery

    // --- NEW: Refactored fetch function ---
    const fetchAllTasksForDelivery = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Your existing API calls to fetch delivery data and total duration
            const deliveryResponse = await fetch(`https://server-ui-2.onrender.com/api/data?email=${userEmail}`);
            if (!deliveryResponse.ok) {
                throw new Error(`HTTP error! status: ${deliveryResponse.status}`);
            }
            const deliveryData = await deliveryResponse.json();

            const durationResponse = await fetch(`https://server-ui-2.onrender.com/api/per-key-per-day`);
            if (!durationResponse.ok) {
                throw new Error(`HTTP error! status: ${durationResponse.status}`);
            }
            const durationData = await durationResponse.json();

            if (deliveryData.hasOwnProperty(delCode)) {
                // Filter out step 0 tasks and then process the rest
                const nonStep0Tasks = deliveryData[delCode]
                    .filter(task => task.Step_ID !== 0) // Keep your existing filter for Step_ID = 0
                    .map((task) => {
                        const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;
                        const hours = Math.floor(taskDurationInMinutes / 60);
                        const minutes = taskDurationInMinutes % 60;
                        const formattedDuration = `${hours}h ${minutes}m`;

                        return {
                            ...task,
                            // Use Planned_Delivery_Date itself to determine 'scheduled' status
                            // An empty string, null, or undefined means it's NOT scheduled
                            scheduled: !!task.Planned_Delivery_Date, // Convert to boolean
                            personResponsible: task.Responsibility || 'Unassigned',
                            totalTime: task.totalTime || 0,
                            formattedDuration,
                            isPlaying: false, // Initialize isPlaying state
                        };
                    });
                setDelivery(deliveryData[delCode]);
                setTasks(nonStep0Tasks); // Store all relevant tasks (non-step 0), including scheduled ones
                console.log("Fetched and processed tasks (all relevant):", nonStep0Tasks); // Debugging
            } else {
                setError('Delivery not found.');
                setTasks([]); // Clear tasks if delivery not found
            }
        } catch (err) {
            console.error('Error fetching delivery details:', err);
            setError('Failed to fetch delivery details.');
        } finally {
            setLoading(false);
        }
    }, [delCode, userEmail]); // Dependencies for useCallback

    // --- NEW: useEffect to trigger fetch on mount/delCode/userEmail change ---
    useEffect(() => {
        if (delCode && userEmail) {
            fetchAllTasksForDelivery();
        }
    }, [delCode, userEmail, fetchAllTasksForDelivery]);


    // --- NEW: Memoized filtered tasks for display ---
    // This derived state will only contain tasks that are NOT scheduled
    const unscheduledViewTasks = useMemo(() => {
        return tasks.filter(task => !task.scheduled); // Filter based on the 'scheduled' property
    }, [tasks]); // Recalculate only when the 'tasks' state changes

    // --- NEW: Callback for FormComponent after successful scheduling ---
    const handleTaskScheduled = useCallback(() => {
        console.log("Task scheduled successfully, refreshing task list...");
        fetchAllTasksForDelivery(); // Trigger a re-fetch of all tasks
        setActiveTaskKey(null); // Close the form
        setActionType('');
    }, [fetchAllTasksForDelivery]); // Dependency for useCallback

    // Handle task click for scheduling or editing
    const handleTaskClick = (task) => {
        // Only allow scheduling if the task is NOT already scheduled
        if (!task.scheduled) {
            setActionType('schedule'); // Lowercase 'schedule' to match FormComponent logic
            setActiveTaskKey(task.Key);
        }
    };

    // Dropdown menu for rescheduling or reassigning task
    const handleMenuClick = (task, { key }) => {
        // You might want to allow reschedule/reassign even if already scheduled
        setActiveTaskKey(task.Key);
        if (key === 'reschedule') {
            setActionType('reschedule');
        } else if (key === 'reassign') {
            setActionType('reassign'); // You'll need to adapt FormComponent or create a new one for reassign
        } else if (key === 'schedule') { // Add 'schedule' option explicitly for dropdown if needed
            setActionType('schedule');
        }
    };

    // The handleFormSubmit function in DeliveryDetail.js is now largely obsolete for task updates.
    // The actual update logic will be handled within FormComponent, and it will call `onScheduleSuccess`.
    // You can remove it or keep it as a placeholder if other form submissions might use it.
    // For this specific feature, we'll assume FormComponent handles its own API calls.
    // If it's still needed, ensure it doesn't conflict with the `onScheduleSuccess` flow.
    // const handleFormSubmit = (formData) => { /* ... (remove or adjust) ... */ };


    // Timer control logic for tasks (remains the same)
    const toggleTimer = (taskKey) => {
        const updatedTasks = tasks.map((task) => {
            if (task.Key === taskKey) {
                return { ...task, isPlaying: !task.isPlaying };
            }
            return task;
        });
        setTasks(updatedTasks);
    };

    const taskMenu = (task) => (
        <Menu onClick={(info) => handleMenuClick(task, info)}>
            <MenuItem key="schedule">Schedule Task</MenuItem> {/* Added for consistency */}
            <MenuItem key="reschedule">Reschedule Task</MenuItem>
            <MenuItem key="reassign">Reassign Task</MenuItem>
            {/* Add timer controls to menu if desired */}
            {/* <MenuItem key="pause">Pause Timer</MenuItem>
            <MenuItem key="play">Play Timer</MenuItem>
            <MenuItem key="stop">Stop Timer</MenuItem> */}
        </Menu>
    );

    // Dynamic class assignment for card styling
    // This function will be called for each task to get its CSS classes
    const getTaskCardClasses = (task) => {
        let classes = ['task-card']; // Base class from DeliveryDetail.css

        // Map Latest_Status to a class
        if (task.Latest_Status) {
            classes.push(`status-${task.Latest_Status.toLowerCase().replace(/ /g, '-')}`);
        }

        // Add 'planned-date-null' class if it's considered unscheduled by the view
        // This is crucial for styling the unscheduled tasks yellow/gold
        if (!task.scheduled) {
            classes.push('planned-date-null');
        }

        return classes.join(' ');
    };

    if (loading) {
        return (
            <Container className="text-center my-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
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

    if (!delivery) {
        return (
            <Container className="text-center my-5">
                <p>No delivery found</p>
                <Link to="/">Back to Deliveries</Link>
            </Container>
        );
    }

    const client = delivery[0]?.Client || 'Unknown Client';
    const shortDescription = delivery[0]?.Short_Description || 'No description available';
    // Ensure Planned_Start_Timestamp and Planned_Delivery_Timestamp are not objects with 'value' property
    // If they come as direct strings, this parsing might be different.
    const plannedStart = delivery[0]?.Planned_Start_Timestamp ? new Date(delivery[0].Planned_Start_Timestamp).toLocaleString() : 'N/A';
    const plannedDelivery = delivery[0]?.Planned_Delivery_Timestamp ? new Date(delivery[0].Planned_Delivery_Timestamp).toLocaleString() : 'N/A';


    return (
        <Container className="mt-4">
            <h2>Tasks for Delivery Code: {delCode}</h2>

            <Card className="mb-4">
                <Card.Body>
                    <Card.Title>{shortDescription}</Card.Title>
                    <Card.Subtitle className="mb-2 text-muted">
                        Client: {client}
                    </Card.Subtitle>
                    <Card.Subtitle className="mb-2 text-muted">
                        Start Time: {plannedStart}
                    </Card.Subtitle>
                    <Card.Subtitle className="mb-2 text-muted">
                        Delivery Deadline: {plannedDelivery}
                    </Card.Subtitle>
                </Card.Body>
            </Card>

            <h3>Unscheduled Tasks</h3>
            <Row>
                {unscheduledViewTasks.length > 0 ? (
                    unscheduledViewTasks.map((task, index) => (
                        <Col key={task.Key || index} md={4} className="mb-3">
                            <Dropdown trigger={['contextMenu']} overlay={taskMenu(task)}>
                                <div
                                    className={getTaskCardClasses(task)} // Apply dynamic classes here
                                    onClick={() => handleTaskClick(task)}
                                    style={{ cursor: task.scheduled ? 'default' : 'pointer' }}
                                >
                                    <Card.Body>
                                        <h5>{task.Task_Details}</h5>
                                        <p className="task-meta">Key: {task.Key}</p>
                                        <p className="task-meta">Step ID: {task.Step_ID}</p>
                                        <p className="task-status">Status: {task.Latest_Status}</p>
                                        {task.Planned_Delivery_Date && (
                                            <p className="task-meta">Planned Date: {task.Planned_Delivery_Date}</p>
                                        )}
                                        {/* Display person responsible and total time */}
                                        <div className="d-flex align-items-center justify-content-between">
                                            <span className="text-muted">{task.personResponsible}</span>
                                            <span>{task.formattedDuration || '0m'}</span>
                                        </div>

                                        {/* Timer controls and status - unchanged */}
                                        <div className="timer-controls">
                                            {/* You might want to reconsider timer controls for unscheduled tasks */}
                                            {/* or only show them if a task becomes 'Playing' after scheduling */}
                                            {!task.scheduled ? (
                                                <FaCalendarAlt />
                                            ) : (
                                                <>
                                                    {task.isPlaying ? (
                                                        <FaPause onClick={() => toggleTimer(task.Key)} style={{ cursor: 'pointer' }} />
                                                    ) : (
                                                        <FaPlay onClick={() => toggleTimer(task.Key)} style={{ cursor: 'pointer' }} />
                                                    )}
                                                    <FaStop onClick={() => toggleTimer(task.Key)} style={{ cursor: 'pointer', marginLeft: '5px' }} />
                                                </>
                                            )}
                                            {task.isPlaying ? (
                                                <p className="text-success ms-2">Running</p>
                                            ) : task.scheduled ? (
                                                <p className="text-muted ms-2">Paused</p>
                                            ) : (
                                                <p className="text-muted ms-2">Unscheduled</p>
                                            )}
                                        </div>

                                        {/* Conditional form rendering for scheduling/rescheduling */}
                                        {activeTaskKey === task.Key && (actionType === 'schedule' || actionType === 'reschedule') && (
                                            <div className="mt-3">
                                                <h6>{actionType} Task: {task.Task_Details}</h6>
                                                <FormComponent
                                                    task={task}
                                                    onScheduleSuccess={handleTaskScheduled} // This is the key prop!
                                                    userEmail={userEmail}
                                                />
                                            </div>
                                        )}
                                    </Card.Body>
                                </div>
                            </Dropdown>
                        </Col>
                    ))
                ) : (
                    <Col>
                        <ListGroup.Item>No unscheduled tasks available for this delivery.</ListGroup.Item>
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
