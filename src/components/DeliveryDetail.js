import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent'; // Ensure your form component is imported
import { UserContext } from './UserContext'; // Import UserContext
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

// --- NEW: Define the base URL for your backend API, consistent with FormComponent ---
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

const DeliveryDetail = () => {
    const location = useLocation();
    // Adjusted delCode extraction logic based on the likely URL structure,
    // assuming it comes after /delivery/data/ and then a numerical ID.
    // If your URL is like /delivery/<DEL_CODE>, you might need to adjust this.
    const delCodeMatch = location.pathname.match(/\/delivery\/data\/(\d+)/);
    const delCode = delCodeMatch ? delCodeMatch[1] : null;

    // Corrected context usage to get currentUserEmail as defined in UserContext
    const { currentUserEmail } = useContext(UserContext);

    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]);

    // Fetching delivery details from the server
    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            // Ensure delCode and userEmail are available before fetching
            if (!delCode || !currentUserEmail) {
                setLoading(false);
                if (!delCode) setError('Delivery Code not found in URL.');
                if (!currentUserEmail) setError('User email not available. Please log in.');
                return;
            }

            try {
                setLoading(true);

                // --- UPDATED: Use full backend URL for API calls ---
                const deliveryResponse = await fetch(`${BACKEND_API_BASE_URL}/api/data?email=${currentUserEmail}`);
                if (!deliveryResponse.ok) {
                    const errorText = await deliveryResponse.text();
                    throw new Error(`HTTP error! status: ${deliveryResponse.status}, message: ${errorText}`);
                }
                const deliveryData = await deliveryResponse.json();

                // --- UPDATED: Use full backend URL for API calls ---
                const durationResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                if (!durationResponse.ok) {
                    const errorText = await durationResponse.text();
                    throw new Error(`HTTP error! status: ${durationResponse.status}, message: ${errorText}`);
                }
                const durationData = await durationResponse.json();

                if (deliveryData.hasOwnProperty(delCode)) {
                    // Filtering tasks with Step_ID !== 0 and Planned_Delivery_Timestamp being null
                    const fetchedTasks = deliveryData[delCode]
                       .filter((task) => task.Step_ID !== 0 && (task.Planned_Delivery_Timestamp === null || (typeof task.Planned_Delivery_Timestamp === 'object' && task.Planned_Delivery_Timestamp.value === null)))
                        .map((task) => {
                            const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;
                            const hours = Math.floor(taskDurationInMinutes / 60);
                            const minutes = taskDurationInMinutes % 60;
                            const formattedDuration = `${hours}h ${minutes}m`;

                            return {
                                ...task,
                                // Check if Planned_Delivery_Timestamp has a valid value (not null/undefined)
                                scheduled: !!task.Planned_Delivery_Timestamp && (typeof task.Planned_Delivery_Timestamp === 'string' ? task.Planned_Delivery_Timestamp !== "NULL" : task.Planned_Delivery_Timestamp.value !== null),
                                personResponsible: task.Responsibility || 'Unassigned',
                                totalTime: taskDurationInMinutes, // Keep total duration in minutes
                                formattedDuration,
                                isPlaying: false,
                            };
                        });
                    setDelivery(deliveryData[delCode]);
                    setTasks(fetchedTasks);
                    console.log('Fetched tasks for delivery:', fetchedTasks);
                } else {
                    setError('Delivery not found.');
                }
            } catch (err) {
                console.error('Error fetching delivery details:', err);
                setError(`Failed to fetch delivery details: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchDeliveryDetails();
    }, [delCode, currentUserEmail]); // Add currentUserEmail to dependencies to re-fetch when it changes


    // Handling task click for scheduling or editing
    const handleTaskClick = (task) => {
        if (!task.scheduled) {
            setActionType('Schedule');
            setActiveTaskKey(task.Key);
        }
    };

    // Dropdown menu for rescheduling or reassigning task
    const handleMenuClick = (task, { key }) => {
        if (key === 'reschedule') {
            setActionType('Reschedule');
        } else if (key === 'reassign') {
            setActionType('Reassign');
        }
        setActiveTaskKey(task.Key);
    };

    // Handle form submission from FormComponent
    const handleFormSubmit = (formData) => {
        console.log("Form submitted data:", formData);
        const updatedTasks = tasks.map((task) =>
            task.Key === activeTaskKey
                ? {
                      ...task,
                      scheduled: true, // Mark the task as scheduled
                      personResponsible: formData.personResponsible || task.personResponsible, // Updated person responsible
                      totalTime: formData.totalTime || task.totalTime, // Update totalTime with minutes from form
                      formattedDuration: `${Math.floor((formData.totalTime || 0) / 60)}h ${ (formData.totalTime || 0) % 60}m`, // Recalculate formattedDuration
                      Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp || task.Planned_Delivery_Timestamp, // Update delivery timestamp
                  }
                : task
        );
        setTasks(updatedTasks);
        setActiveTaskKey(null); // Reset after form submission
    };

    // Timer control logic for tasks
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
            <MenuItem key="reschedule">Reschedule Task</MenuItem>
            <MenuItem key="reassign">Reassign Task</MenuItem>
            {/* Conditional "Delete" option (example, if needed) */}
            {/* <MenuItem key="delete">Delete Task</MenuItem> */}
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

    // Ensure delivery array is not empty before accessing its first element
    if (!delivery || delivery.length === 0) {
        return (
            <Container className="text-center my-5">
                <p>No delivery found for code: {delCode}</p>
                <Link to="/">Back to Deliveries</Link>
            </Container>
        );
    }

    const client = delivery[0]?.Client || 'Unknown Client';
    const shortDescription = delivery[0]?.Short_Description || 'No description available';
    const plannedStart = delivery[0]?.Planned_Start_Timestamp?.value ? new Date(delivery[0].Planned_Start_Timestamp.value).toLocaleString() : 'N/A';
    const plannedDelivery = delivery[0]?.Planned_Delivery_Timestamp?.value ? new Date(delivery[0].Planned_Delivery_Timestamp.value).toLocaleString() : 'N/A';

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
                {tasks.length > 0 ? (
                    tasks.map((task, index) => (
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
                                                    <span className="text-muted">{task.personResponsible}</span> {/* Show the person responsible */}
                                                </div>

                                                <span>
                                                    {task.totalTime ||task.formattedDuration||'0m'}
                                                </span>
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
                                                        currentUserEmail={currentUserEmail} {/* <-- PASSED THE EMAIL HERE! */}
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
