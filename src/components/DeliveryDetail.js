import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { useLocation, Link, useParams } from 'react-router-dom'; // Keep useParams just in case, though we won't use it for `delCode` directly now
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

    // Use this line to correctly extract the full delCode
    const delCode = location.pathname.substring("/delivery/".length); // This will extract "PIA/SMM/POST/FEB12/5629"

    // You can remove these console.logs after confirming it works
    console.log("------------------- DEBUGGING DELCODE -------------------");
    console.log("location.pathname:", location.pathname);
    console.log("Extracted delCode (Corrected logic):", delCode); // This should now be correct
    // console.log("Extracted delCode (from last /):", location.pathname.substring(location.pathname.lastIndexOf("/") + 1));
    // console.log("Extracted delCode (from old logic /data/ + 11):", location.pathname.substring(location.pathname.lastIndexOf("/data/") + 11));
    // console.log("Extracted delCode (from useParams, if route configured):", useParams().delCode); // If your route is /delivery/:delCode, this would also work.
    console.log("---------------------------------------------------------");


    const { userEmail } = useContext(UserContext);
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]);

    // The fetchAllTasksForDelivery function (ensure it also uses the correct `delCode`)
    const fetchAllTasksForDelivery = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch delivery data from your API
            const deliveryResponse = await fetch(`https://server-ui-2.onrender.com/api/data?email=${userEmail}`);
            if (!deliveryResponse.ok) {
                throw new Error(`HTTP error! status: ${deliveryResponse.status}`);
            }
            const deliveryData = await deliveryResponse.json();

            // Add these console logs here to confirm the data and key existence
            console.log("Full deliveryData fetched from API:", deliveryData);
            console.log("Checking if deliveryData has property '" + delCode + "':", deliveryData.hasOwnProperty(delCode));

            if (deliveryData.hasOwnProperty(delCode)) {
                const fetchedDelivery = deliveryData[delCode];
                setDelivery(fetchedDelivery[0]); // Assuming the first item in the array holds delivery details

                // Filter out tasks where Step_ID is 0 (assuming these are not actual tasks)
                const filteredTasks = fetchedDelivery.filter(task => task.Step_ID !== 0);

                // Fetch totalDuration data
                const durationResponse = await fetch(`https://server-ui-2.onrender.com/api/per-key-per-day`);
                if (!durationResponse.ok) {
                    throw new Error(`HTTP error! status: ${durationResponse.status}`);
                }
                const durationData = await durationResponse.json();

                const tasksWithDetails = filteredTasks.map(task => {
                    const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;
                    const hours = Math.floor(taskDurationInMinutes / 60);
                    const minutes = taskDurationInMinutes % 60;
                    const formattedDuration = `${hours}h ${minutes}m`;

                    return {
                        ...task,
                        scheduled: !!task.Planned_Delivery_Date, // Check if Planned_Delivery_Date exists
                        personResponsible: task.Responsibility || 'Unassigned',
                        totalTime: taskDurationInMinutes, // Store minutes
                        formattedDuration,
                        isPlaying: false, // Default to not playing
                    };
                });
                setTasks(tasksWithDetails);
                console.log("Tasks processed:", tasksWithDetails);

            } else {
                setError('Delivery not found.');
                setTasks([]);
            }
        } catch (err) {
            console.error('Error fetching delivery details:', err);
            setError(err.message || 'Failed to fetch delivery details.');
        } finally {
            setLoading(false);
        }
    }, [delCode, userEmail]); // `delCode` is now correctly used as a dependency

    useEffect(() => {
        if (userEmail) { // Only fetch if userEmail is available
            fetchAllTasksForDelivery();
        } else {
            setLoading(false); // If no user email, stop loading and show no data
            setError("User email not available. Please log in.");
        }
    }, [fetchAllTasksForDelivery, userEmail]);

    // ... rest of your component (return JSX)
    // Make sure the `tasks` state is used to display both scheduled and unscheduled tasks.
    // Your original code filters by `task.scheduled` to render them into separate sections.
    // The `tasks` state now contains ALL tasks, and your rendering logic should handle separating them.
    // For example:
    const scheduledTasks = useMemo(() => tasks.filter(task => task.scheduled), [tasks]);
    const unscheduledTasks = useMemo(() => tasks.filter(task => !task.scheduled), [tasks]);


    // The JSX rendering part:
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
        return (
            <Container className="text-center mt-5">
                <div className="alert alert-danger">
                    Error: {error}
                </div>
                <Link to="/" className="btn btn-primary mt-3">
                    Back to Deliveries
                </Link>
            </Container>
        );
    }

    if (!delivery) {
        return (
            <Container className="text-center mt-5">
                <div className="alert alert-warning">
                    Delivery data could not be loaded. Please ensure the delivery code is correct.
                </div>
                <Link to="/" className="btn btn-primary mt-3">
                    Back to Deliveries
                </Link>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            <Card className="mb-4">
                <Card.Body>
                    <Card.Title>{delivery.Client} - {delivery.Short_Description}</Card.Title>
                    <Card.Text>
                        <strong>Planned Start:</strong> {delivery.Planned_Start_Timestamp ? new Date(delivery.Planned_Start_Timestamp).toLocaleString() : 'N/A'} <br />
                        <strong>Planned Delivery:</strong> {delivery.Planned_Delivery_Timestamp ? new Date(delivery.Planned_Delivery_Timestamp).toLocaleString() : 'N/A'}
                    </Card.Text>
                </Card.Body>
            </Card>

            {/* Unscheduled Tasks Section */}
            <h4 className="mt-4">Unscheduled Tasks</h4>
            <Row xs={1} md={2} lg={3} className="g-4">
                {unscheduledTasks.length > 0 ? (
                    unscheduledTasks.map((task) => (
                        <Col key={task.Key}>
                            <Dropdown
                                trigger={['click']}
                                overlay={
                                    <Menu onSelect={({ key }) => {
                                        setActiveTaskKey(task.Key);
                                        setActionType(key);
                                    }}>
                                        <MenuItem key="schedule">Schedule</MenuItem>
                                        {/* <MenuItem key="reschedule">Reschedule</MenuItem> */}
                                    </Menu>
                                }
                                animation="slide-up"
                            >
                                <div className="task-card">
                                    <Card.Body>
                                        <Card.Title><h5>{task.Task_Details}</h5></Card.Title>
                                        <Card.Text className="task-meta">
                                            Time: {task.formattedDuration} | Responsibility: {task.personResponsible}
                                        </Card.Text>
                                        <div className="task-status d-flex align-items-center">
                                            <FaCalendarAlt className="me-2" />
                                            <p className="text-muted mb-0">Unscheduled</p>
                                        </div>

                                        {activeTaskKey === task.Key && actionType && (
                                            <div className="mt-3">
                                                <h6>{actionType} Task: {task.Task_Details}</h6>
                                                <FormComponent
                                                    onSubmit={() => {
                                                        setActiveTaskKey(null); // Close form
                                                        setActionType('');
                                                        fetchAllTasksForDelivery(); // Refresh tasks
                                                    }}
                                                    task={task}
                                                />
                                            </div>
                                        )}
                                    </Card.Body>
                                </div>
                            </Dropdown>
                        </Col>
                    ))
                ) : (
                    <Col><ListGroup.Item>No unscheduled tasks for this delivery.</ListGroup.Item></Col>
                )}
            </Row>

            {/* Scheduled Tasks Section */}
            <h4 className="mt-4">Scheduled Tasks</h4>
            <Row xs={1} md={2} lg={3} className="g-4">
                {scheduledTasks.length > 0 ? (
                    scheduledTasks.map((task) => (
                        <Col key={task.Key}>
                            <Dropdown
                                trigger={['click']}
                                overlay={
                                    <Menu onSelect={({ key }) => {
                                        setActiveTaskKey(task.Key);
                                        setActionType(key);
                                    }}>
                                        {/* <MenuItem key="schedule">Schedule</MenuItem> */}
                                        <MenuItem key="reschedule">Reschedule</MenuItem>
                                        <MenuItem key="pause">Pause Timer</MenuItem>
                                        <MenuItem key="play">Play Timer</MenuItem>
                                        <MenuItem key="stop">Stop Timer</MenuItem>
                                    </Menu>
                                }
                                animation="slide-up"
                            >
                                <div className="task-card">
                                    <Card.Body>
                                        <Card.Title><h5>{task.Task_Details}</h5></Card.Title>
                                        <Card.Text className="task-meta">
                                            Time: {task.formattedDuration} | Responsibility: {task.personResponsible}
                                        </Card.Text>
                                        <div className="task-status d-flex align-items-center">
                                            {task.Planned_Delivery_Date ? (
                                                <p className="text-success mb-0">Scheduled for: {new Date(task.Planned_Delivery_Date).toLocaleDateString()}</p>
                                            ) : (
                                                <p className="text-muted mb-0">No Date</p>
                                            )}
                                        </div>
                                        <div className="timer-controls mt-2">
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
                                                    onSubmit={() => {
                                                        setActiveTaskKey(null);
                                                        setActionType('');
                                                        fetchAllTasksForDelivery();
                                                    }}
                                                    task={task}
                                                />
                                            </div>
                                        )}
                                    </Card.Body>
                                </div>
                            </Dropdown>
                        </Col>
                    ))
                ) : (
                    <Col><ListGroup.Item>No scheduled tasks available for this delivery.</ListGroup.Item></Col>
                )}
            </Row>

            <Link to="/" className="btn btn-primary mt-4">
                Back to Deliveries
            </Link>
        </Container>
    );
};

export default DeliveryDetail;
