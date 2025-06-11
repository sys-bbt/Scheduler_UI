import React, { useEffect, useState, useContext, useMemo } from 'react'; // Import useMemo
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent'; // Ensure your form component is imported
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

const DeliveryDetail = () => {
    const location = useLocation();
    // Adjusted delCode extraction - make sure this matches your URL structure
    // If your URL is like /delivery/data/DELCODE, then +11 is correct.
    // If it's just /delivery/DELCODE, it might need adjustment.
    const delCode = location.pathname.substring(location.pathname.lastIndexOf("/") + 1);
    const { userEmail } = useContext(UserContext);
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null); // To track which task is active for scheduling/other actions
    const [actionType, setActionType] = useState(''); // To differentiate between actions like 'schedule', 'reschedule'
    const [tasks, setTasks] = useState([]); // State to manage all tasks

    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            try {
                setLoading(true); // Set loading state to true
                setError(null); // Clear previous errors

                // --- DEBUGGING FETCHED DATA ---
                console.log(`Fetching data for email: ${userEmail} and delCode: ${delCode}`);
                // --- END DEBUGGING ---

                // Fetch delivery data
                const deliveryResponse = await fetch(`https://server-ui-2.onrender.com/api/data?email=${userEmail}`);
                if (!deliveryResponse.ok) {
                    throw new Error(`HTTP error! status: ${deliveryResponse.status}`);
                }
                const deliveryData = await deliveryResponse.json();
                console.log("Fetched deliveryData:", deliveryData); // Log the full delivery data

                // Fetch totalDuration data
                const durationResponse = await fetch(`https://server-ui-2.onrender.com/api/per-key-per-day`);
                if (!durationResponse.ok) {
                    throw new Error(`HTTP error! status: ${durationResponse.status}`);
                }
                const durationData = await durationResponse.json();
                console.log("Fetched durationData:", durationData); // Log the duration data

                // --- DEBUGGING `delCode` in `deliveryData` ---
                console.log(`Checking if deliveryData hasOwnProperty('${delCode}'):`, deliveryData.hasOwnProperty(delCode));
                if (deliveryData.hasOwnProperty(delCode)) {
                    console.log(`Content of deliveryData[delCode]:`, deliveryData[delCode]);
                } else {
                    console.log(`Keys available in deliveryData:`, Object.keys(deliveryData));
                }
                // --- END DEBUGGING ---

                // Check if the delivery code exists in the deliveryData response
                if (deliveryData.hasOwnProperty(delCode)) {
                    const fetchedDeliveryArray = deliveryData[delCode];

                    // Set the main delivery details from the first item (Step_ID 0)
                    // Ensure delivery is an object and not an array, as it represents the main delivery details
                    const mainDeliveryInfo = fetchedDeliveryArray.find(task => task.Step_ID === 0) || fetchedDeliveryArray[0];
                    setDelivery(mainDeliveryInfo);


                    const filteredTasks = fetchedDeliveryArray
                        .filter((task) => task.Step_ID !== 0) // Remove tasks with Step_ID = 0 from the tasks list
                        .map((task) => {
                            // Retrieve totalDuration for the task using its Key
                            const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;

                            // Convert totalDuration from minutes to hours and minutes
                            const hours = Math.floor(taskDurationInMinutes / 60);
                            const minutes = taskDurationInMinutes % 60;
                            const formattedDuration = `${hours}h ${minutes}m`;

                            return {
                                ...task,
                                scheduled: !!task.Planned_Delivery_Timestamp, // Use !! to convert to boolean
                                personResponsible: task.Responsibility || 'Unassigned', // Ensure person responsible is included
                                totalTime: taskDurationInMinutes, // Store total duration in minutes
                                formattedDuration, // Add the formatted duration for display
                                isPlaying: false, // Initialize isPlaying state
                            };
                        });
                    setTasks(filteredTasks); // Setting tasks with scheduling info
                    console.log("Processed tasks:", filteredTasks);
                } else {
                    setError('Delivery not found. Please check the URL or if the delivery exists for your email.');
                }
            } catch (err) {
                console.error('Error fetching delivery details:', err);
                setError(`Failed to fetch delivery details: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        if (userEmail && delCode) { // Only fetch if userEmail and delCode are available
            fetchDeliveryDetails();
        }
    }, [delCode, userEmail]);

    // Use useMemo to filter tasks into scheduled and unscheduled lists
    const scheduledTasks = useMemo(() => {
        return tasks.filter(task => task.scheduled);
    }, [tasks]);

    const unscheduledTasks = useMemo(() => {
        return tasks.filter(task => !task.scheduled);
    }, [tasks]);

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
        console.log("Form submitted with data:", formData);

        // Update the tasks state based on the form submission
        const updatedTasks = tasks.map((task) =>
            task.Key === activeTaskKey
                ? {
                    ...task,
                    scheduled: true, // Mark the task as scheduled
                    personResponsible: formData.personResponsible || task.personResponsible,
                    totalTime: formData.totalTime || task.totalTime, // Update totalTime in minutes
                    formattedDuration: `${Math.floor((formData.totalTime || task.totalTime) / 60)}h ${(formData.totalTime || task.totalTime) % 60}m`, // Recalculate formatted duration
                    Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp || task.Planned_Delivery_Timestamp, // Update delivery timestamp
                    Planned_Start_Timestamp: formData.Planned_Start_Timestamp || task.Planned_Start_Timestamp, // Update start timestamp
                }
                : task
        );
        setTasks(updatedTasks); // Update tasks state
        setActiveTaskKey(null); // Reset after form submission
        setActionType(''); // Clear action type
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

    if (!delivery) {
        return (
            <Container className="text-center my-5">
                <p>No delivery found for this code or email.</p>
                <Link to="/">Back to Deliveries</Link>
            </Container>
        );
    }

    // Safely access properties of delivery (which is now the main delivery info object)
    const client = delivery.Client || 'Unknown Client';
    const shortDescription = delivery.Short_Description || 'No description available';
    const plannedStart = delivery.Planned_Start_Timestamp ? new Date(delivery.Planned_Start_Timestamp).toLocaleString() : 'N/A';
    const plannedDelivery = delivery.Planned_Delivery_Timestamp ? new Date(delivery.Planned_Delivery_Timestamp).toLocaleString() : 'N/A';


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
                    <Card.Text>
                        Delivery Code: {delCode}
                    </Card.Text>
                </Card.Body>
            </Card>

            {/* Section for Unscheduled Tasks (currently displayed) */}
            {unscheduledTasks.length > 0 && (
                <>
                    <h3>Unscheduled Tasks</h3>
                    <Row>
                        {unscheduledTasks.map((task, index) => (
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
                                                        {/* Calendar icon for unscheduled tasks */}
                                                        <FaCalendarAlt
                                                            onClick={(e) => { e.stopPropagation(); handleTaskClick(task); }}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </div>

                                                    <div className="flex-grow-1 text-center">
                                                        <h5 className="mb-1">{task.Task_Details}</h5>
                                                        <span className="text-muted">{task.personResponsible}</span>
                                                    </div>

                                                    <span>
                                                        {task.formattedDuration || '0m'}
                                                    </span>
                                                </div>

                                                <div className="task-status mt-2">
                                                    <p className="text-muted">Unscheduled</p>
                                                </div>

                                                {activeTaskKey === task.Key && actionType && (
                                                    <div className="mt-3">
                                                        <h6>{actionType} Task: {task.Task_Details}</h6>
                                                        <FormComponent
                                                            onSubmit={handleFormSubmit}
                                                            task={task}
                                                        />
                                                    </div>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    </div>
                                </Dropdown>
                            </Col>
                        ))}
                    </Row>
                </>
            )}

            {unscheduledTasks.length === 0 && scheduledTasks.length === 0 && (
                 <ListGroup.Item>No tasks available for this delivery.</ListGroup.Item>
            )}

            {/* Section for Scheduled Tasks (commented out by default, uncomment to show) */}
            {/*
            {scheduledTasks.length > 0 && (
                <>
                    <h3 className="mt-4">Scheduled Tasks</h3>
                    <Row>
                        {scheduledTasks.map((task, index) => (
                            <Col xs={12} key={task.Key || index}>
                                <Dropdown trigger={['contextMenu']} overlay={taskMenu(task)}>
                                    <div
                                        className="task-card"
                                        onClick={() => handleTaskClick(task)} // Still allow click for scheduled tasks if needed for other actions
                                        style={{ cursor: 'default' }} // Scheduled tasks are not for initial scheduling
                                    >
                                        <Card className="mb-3">
                                            <Card.Body>
                                                <div className="d-flex align-items-center">
                                                    <div className="timer-controls" style={{ marginRight: '10px' }}>
                                                        {task.isPlaying ? (
                                                            <FaPause
                                                                onClick={(e) => { e.stopPropagation(); toggleTimer(task.Key); }}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        ) : (
                                                            <FaPlay
                                                                onClick={(e) => { e.stopPropagation(); toggleTimer(task.Key); }}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        )}
                                                        <FaStop
                                                            onClick={(e) => { e.stopPropagation(); toggleTimer(task.Key); }}
                                                            style={{ cursor: 'pointer', marginLeft: '5px' }}
                                                        />
                                                    </div>

                                                    <div className="flex-grow-1 text-center">
                                                        <h5 className="mb-1">{task.Task_Details}</h5>
                                                        <span className="text-muted">{task.personResponsible}</span>
                                                    </div>

                                                    <span>
                                                        {task.formattedDuration || '0m'}
                                                    </span>
                                                </div>

                                                <div className="task-status mt-2">
                                                    {task.isPlaying ? (
                                                        <p className="text-success">On time for going live</p>
                                                    ) : (
                                                        <p className="text-muted">Paused</p>
                                                    )}
                                                    <p className="text-info">Delivers by: {task.Planned_Delivery_Timestamp ? new Date(task.Planned_Delivery_Timestamp).toLocaleString() : 'N/A'}</p>
                                                </div>

                                                {activeTaskKey === task.Key && actionType && (
                                                    <div className="mt-3">
                                                        <h6>{actionType} Task: {task.Task_Details}</h6>
                                                        <FormComponent
                                                            onSubmit={handleFormSubmit}
                                                            task={task}
                                                        />
                                                    </div>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    </div>
                                </Dropdown>
                            </Col>
                        ))}
                    </Row>
                </>
            )}
            */}

            <Link to="/" className="btn btn-primary mt-4">
                Back to Deliveries
            </Link>
        </Container>
    );
};

export default DeliveryDetail;
