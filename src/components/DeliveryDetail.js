import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Define admin emails on the frontend, matching the backend
const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
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
    console.log('DeliveryDetail: userEmail from Context:', userEmail);
    console.log('DeliveryDetail: Extracted delCode from URL:', delCode);

    // Determine isAdmin status for the current user
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);
    console.log(`DeliveryDetail: Current User Email: ${userEmail}, Is Admin: ${isAdmin}`);


    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            if (!delCode || !userEmail) {
                setLoading(false);
                if (!delCode) setError('Delivery Code not found in URL.');
                if (!userEmail) setError('User email not available. Please log in.');
                return;
            }

            try {
                setLoading(true);

                // --- UPDATED: Pass isAdmin flag to backend ---
                const deliveryResponse = await fetch(`${BACKEND_API_BASE_URL}/api/data?email=${userEmail}&delCode=${delCode}&isAdmin=${isAdmin}`);
                if (!deliveryResponse.ok) {
                    const errorText = await deliveryResponse.text();
                    throw new Error(`HTTP error! status: ${deliveryResponse.status}, message: ${errorText}`);
                }
                const deliveryData = await deliveryResponse.json();

                const durationResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                if (!durationResponse.ok) {
                    const errorText = await durationResponse.text();
                    throw new Error(`HTTP error! status: ${durationResponse.status}, message: ${errorText}`);
                }
                const durationData = await durationResponse.json();

                if (deliveryData.hasOwnProperty(delCode)) {
                    // This filter remains the same:
                    // It ensures only tasks (Step_ID !== 0) are shown in the list,
                    // as the backend now sends ALL tasks for admins for a given delCode,
                    // or only assigned tasks for non-admins.
                    const fetchedTasks = deliveryData[delCode]
                       .filter((task) => task.Step_ID !== 0 && (task.Planned_Delivery_Timestamp === null || (typeof task.Planned_Delivery_Timestamp === 'object' && task.Planned_Delivery_Timestamp.value === null)))
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
                                isPlaying: false,
                            };
                        });
                    setDelivery(deliveryData[delCode]);
                    setTasks(fetchedTasks);
                    console.log('Fetched tasks for delivery:', fetchedTasks);
                } else {
                    setError(`Delivery with code "${delCode}" not found in fetched data.`);
                }
            } catch (err) {
                console.error('Error fetching delivery details:', err);
                setError(`Failed to fetch delivery details: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchDeliveryDetails();
    }, [delCode, userEmail, isAdmin]); // Added isAdmin to dependencies


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
        console.log("Form submitted data:", formData);
        const updatedTasks = tasks.map((task) =>
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
        setTasks(updatedTasks);
        setActiveTaskKey(null);
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

    if (!delivery || delivery.length === 0) {
        return (
            <Container className="text-center my-5">
                <p>No delivery data found for code: {delCode}</p>
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
