import React, { useEffect, useState, useContext, useMemo } from 'react';
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

    // --- START: CRITICAL CHANGE FOR delCode EXTRACTION ---
    const pathSegments = location.pathname.split('/');
    // Based on the URL path: /delivery/PIA/SMM/POST/FEB12/5629
    // The actual delivery code starts from the 3rd segment (index 2)
    // For example, if pathSegments is ["", "delivery", "PIA", "SMM", "POST", "FEB12", "5629"]
    // We want to capture everything from "PIA" onwards.
    const encodedDelCodeParts = pathSegments.slice(2); // This will give ["PIA", "SMM", "POST", "FEB12", "5629"]
    const encodedDelCode = encodedDelCodeParts.join('/'); // This will join them back to "PIA/SMM/POST/FEB12/5629"
    const delCode = decodeURIComponent(encodedDelCode); // Decodes any URL-encoded characters (like %2F to /)
    // --- END: CRITICAL CHANGE ---

    const { userEmail } = useContext(UserContext);
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            try {
                setLoading(true);
                setError(null);

                // --- DEBUGGING FETCHED DATA ---
                console.log(`--- DEBUGGING FETCHED DATA ---`);
                console.log(`Current URL path: ${location.pathname}`);
                console.log(`Extracted (decoded) delCode: ${delCode}`); // This should now be the full code!
                console.log(`User Email: ${userEmail}`);
                console.log(`Fetching data from: https://server-ui-2.onrender.com/api/data?email=${userEmail}`);
                // --- END DEBUGGING ---

                const deliveryResponse = await fetch(`https://server-ui-2.onrender.com/api/data?email=${userEmail}`);
                if (!deliveryResponse.ok) {
                    throw new Error(`HTTP error! status: ${deliveryResponse.status}`);
                }
                const deliveryData = await deliveryResponse.json();

                // --- DEBUGGING `deliveryData` content (THIS IS WHAT WE NEED TO SEE FROM YOU NEXT) ---
                console.log("Fetched raw deliveryData:", deliveryData);
                console.log(`Checking if deliveryData hasOwnProperty('${delCode}'):`, deliveryData.hasOwnProperty(delCode));
                if (!deliveryData.hasOwnProperty(delCode)) {
                    // Please capture and provide the output of this line next
                    console.log(`Keys available in fetched deliveryData:`, Object.keys(deliveryData));
                    console.log(`Comparing extracted delCode '${delCode}' with available keys...`);
                }
                // --- END DEBUGGING ---

                if (deliveryData.hasOwnProperty(delCode)) {
                    const fetchedDeliveryArray = deliveryData[delCode];

                    const mainDeliveryInfo = fetchedDeliveryArray.find(task => task.Step_ID === 0) || fetchedDeliveryArray[0];
                    setDelivery(mainDeliveryInfo);

                    const filteredTasks = fetchedDeliveryArray
                        .filter((task) => task.Step_ID !== 0)
                        .map((task) => {
                            const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;
                            const hours = Math.floor(taskDurationInMinutes / 60);
                            const minutes = taskDurationInMinutes % 60;
                            const formattedDuration = `${hours}h ${minutes}m`;

                            return {
                                ...task,
                                scheduled: !!task.Planned_Delivery_Timestamp,
                                personResponsible: task.Responsibility || 'Unassigned',
                                totalTime: taskDurationInMinutes,
                                formattedDuration,
                                isPlaying: false,
                            };
                        });
                    setTasks(filteredTasks);
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

        if (userEmail && delCode) {
            fetchDeliveryDetails();
        } else if (!userEmail) {
            setError("User email not available. Please log in.");
            setLoading(false);
        } else if (!delCode || encodedDelCodeParts.length === 0) { // Added check for empty parts
            setError("Delivery code not found in URL or URL path is incomplete.");
            setLoading(false);
        }
    }, [delCode, userEmail, location.pathname]);

    const scheduledTasks = useMemo(() => {
        return tasks.filter(task => task.scheduled);
    }, [tasks]);

    const unscheduledTasks = useMemo(() => {
        return tasks.filter(task => !task.scheduled);
    }, [tasks]);

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

    const handleFormSubmit = (formData) => {
        console.log("Form submitted with data:", formData);
        const updatedTasks = tasks.map((task) =>
            task.Key === activeTaskKey
                ? {
                    ...task,
                    scheduled: true,
                    personResponsible: formData.personResponsible || task.personResponsible,
                    totalTime: formData.totalTime || task.totalTime,
                    formattedDuration: `${Math.floor((formData.totalTime || task.totalTime) / 60)}h ${(formData.totalTime || task.totalTime) % 60}m`,
                    Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp || task.Planned_Delivery_Timestamp,
                    Planned_Start_Timestamp: formData.Planned_Start_Timestamp || task.Planned_Start_Timestamp,
                }
                : task
        );
        setTasks(updatedTasks);
        setActiveTaskKey(null);
        setActionType('');
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

            {/* Section for Scheduled Tasks (commented out by default) */}
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
                                        onClick={() => handleTaskClick(task)}
                                        style={{ cursor: 'default' }}
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
