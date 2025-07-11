// src/components/DeliveryDetail.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ProgressBar, Spinner, ListGroup, Badge, Alert } from 'react-bootstrap';
import { UserContext } from './UserContext'; // Correct: UserContext is in the same folder
import { notification } from 'antd';
import { FiClock, FiCheckCircle, FiFlag, FiLayers, FiAlertCircle, FiInfo } from 'react-icons/fi';
import './DeliveryDetail.css'; // Make sure this CSS file exists for styling

const BACKEND_API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://server-ui-2.onrender.com' // Your Render backend URL
    : 'http://localhost:3001';

const DeliveryDetail = () => {
    console.log('DeliveryDetail component is attempting to render');
    const { delCode } = useParams(); // Extract delCode from URL parameters
    console.log('delCode from useParams:', delCode);

    const { userEmail, logoutUser } = useContext(UserContext);
    const navigate = useNavigate();
    const [deliveryData, setDeliveryData] = useState(null); // Stores main delivery info (Step_ID = 0)
    const [tasks, setTasks] = useState([]); // Stores all tasks for this delCode
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [authToken, setAuthToken] = useState(null); // Assuming auth token is managed outside context for now

    // Function to format timestamps
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        // BigQuery Timestamps often come as objects with a 'value' property, or direct string/number
        const date = new Date(timestamp?.value || timestamp);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
    };

    // Function to calculate deadline
    const calculateDeadline = (deliveryTimestamp) => {
        if (!deliveryTimestamp) return 'No deadline';

        const deliveryTime = new Date(deliveryTimestamp?.value || deliveryTimestamp);
        const currentTime = new Date();

        if (isNaN(deliveryTime.getTime()) || isNaN(currentTime.getTime())) return 'Invalid deadline';

        const timeDiff = deliveryTime - currentTime;

        if (timeDiff <= 0) {
            return 'Past Deadline';
        }

        const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (daysLeft > 0) {
            return `${daysLeft} days ${hoursLeft} hrs left`;
        } else if (hoursLeft > 0) {
            return `${hoursLeft} hrs left`;
        } else {
            const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            return `${minutesLeft} mins left`;
        }
    };

    // Determine isAdmin status on the frontend (consistent with other files)
    const ADMIN_EMAILS_FRONTEND = [
        "neelam.p@brightbraintech.com",
        "meghna.j@brightbraintech.com",
        "zoya.a@brightbraintech.com",
        "shweta.g@brightbraintech.com",
        "hitesh.r@brightbraintech.com"
    ];
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    // Effect to check for auth token on component mount
    useEffect(() => {
        const storedAuthToken = localStorage.getItem('authToken');
        if (storedAuthToken) {
            setAuthToken(storedAuthToken);
        } else {
            console.warn("No auth token found in localStorage. User might not be logged in.");
            notification.error({
                message: 'Authentication Required',
                description: 'Please log in to view delivery details.',
            });
            navigate('/login'); // Redirect to login if no token
        }
    }, [navigate]);

    // Effect to fetch delivery details and tasks
    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            // Ensure auth token, user email, and delCode are available before fetching
            if (!authToken || !userEmail || !delCode) {
                console.log("DeliveryDetail: Skipping fetch because authToken, userEmail, or delCode is missing.", { authToken: !!authToken, userEmail: !!userEmail, delCode: !!delCode });
                setLoading(false);
                if (!delCode) {
                    setError("Delivery code is missing from the URL. Cannot fetch details.");
                }
                return;
            }

            setLoading(true);
            setError(null);
            console.log(`DeliveryDetail: Attempting to fetch details for delCode: ${delCode} with email: ${userEmail}, isAdmin: ${isAdmin}`);

            try {
                // Encode delCode as it might contain slashes
                const encodedDelCode = encodeURIComponent(delCode);

                const queryParams = new URLSearchParams({
                    email: userEmail,
                    isAdmin: isAdmin,
                    delCode: encodedDelCode // Pass encoded delCode to the backend
                });

                const response = await fetch(`${BACKEND_API_BASE_URL}/api/data?${queryParams.toString()}`, {
                    headers: {
                        // Assuming your backend uses this for auth, otherwise it might be unnecessary
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
                }

                const result = await response.json(); // Backend should return an array directly for this delCode

                if (!result || result.length === 0) {
                    setError(`No details or tasks found for delivery code: ${delCode}. It might not exist or you don't have access.`);
                    setDeliveryData(null);
                    setTasks([]);
                    notification.info({
                        message: 'No Data',
                        description: `No details or tasks found for delivery code: ${delCode}.`,
                    });
                    return;
                }

                // Filter for Step_ID === 0 for main delivery info
                const mainDeliveryInfo = result.find(task => task.Step_ID === 0);

                if (!mainDeliveryInfo) {
                    // If Step_ID 0 is missing, but other tasks exist, you might want to use the first task
                    // or set an error if the primary workflow step (ID 0) is crucial and absent.
                    setError(`Could not find the main workflow entry (Step ID 0) for ${delCode}.`);
                    setDeliveryData(null);
                    setTasks([]);
                    return;
                }

                // Prepare tasks for display
                const formattedTasks = result.map(task => ({
                    stepId: task.Step_ID,
                    taskName: task.Task_Details || task.Short_Description, // Use Task_Details or Short_Description
                    responsibility: task.Responsibility,
                    durationMinutes: task.Duration_In_Minutes,
                    isPlanned: task.is_planned_on_google_calendar,
                    actualStart: formatTimestamp(task.Actual_Start_Timestamp),
                    actualEnd: formatTimestamp(task.Actual_End_Timestamp),
                    plannedStart: formatTimestamp(task.Planned_Start_Timestamp),
                    plannedEnd: formatTimestamp(task.Planned_Delivery_Timestamp), // Changed from Planned_End_Timestamp
                    status: task.Status,
                    notes: task.Notes
                }));

                // Calculate total and planned tasks
                const totalTasksCount = formattedTasks.length;
                const plannedTasksCount = formattedTasks.filter(task => task.isPlanned).length;

                setDeliveryData({
                    delCode: mainDeliveryInfo.DelCode_w_o__,
                    client: mainDeliveryInfo.Client,
                    shortDescription: mainDeliveryInfo.Short_Description,
                    initiated: formatTimestamp(mainDeliveryInfo.Created_at), // Assuming Created_at is initiation
                    initiatedTimestampRaw: mainDeliveryInfo.Created_at,
                    deadline: calculateDeadline(mainDeliveryInfo.Planned_Delivery_Timestamp),
                    plannedDeliveryTimestamp: mainDeliveryInfo.Planned_Delivery_Timestamp,
                    totalTasks: totalTasksCount,
                    plannedTasks: plannedTasksCount,
                });
                setTasks(formattedTasks); // Set the separate tasks state

            } catch (err) {
                console.error("Error fetching delivery details:", err);
                setError(`Failed to load details: ${err.message}. Please try again.`);
                notification.error({
                    message: 'Fetch Error',
                    description: `Could not load delivery details: ${err.message}`,
                });
            } finally {
                setLoading(false);
            }
        };

        // Fetch only if delCode is present and authToken/userEmail are confirmed
        if (delCode && authToken && userEmail) {
            fetchDeliveryDetails();
        } else {
            setLoading(false); // If prerequisites aren't met, stop loading
        }
    }, [authToken, delCode, userEmail, isAdmin, navigate]); // Dependencies for useEffect


    if (loading) {
        return (
            <Container className="text-center my-5">
                <Spinner animation="border" role="status">
                    <span className="sr-only">Loading...</span>
                </Spinner>
                <p className="mt-3">Loading delivery details...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="text-center my-5">
                <Alert variant="danger">
                    <FiAlertCircle style={{ marginRight: '10px' }} />
                    {error}
                </Alert>
                <Button variant="primary" onClick={() => navigate('/')}> {/* Corrected: navigate to '/' */}
                    Back to Deliveries List
                </Button>
                {userEmail && <Button variant="outline-danger" onClick={logoutUser} className="ml-2">
                    Logout
                </Button>}
            </Container>
        );
    }

    if (!deliveryData) {
        return (
            <Container className="text-center my-5">
                <p>No data available for this delivery code.</p>
                <Button variant="primary" onClick={() => navigate('/')}> {/* Corrected: navigate to '/' */}
                    Back to Deliveries List
                </Button>
                {userEmail && <Button variant="outline-danger" onClick={logoutUser} className="ml-2">
                    Logout
                </Button>}
            </Container>
        );
    }

    // Calculate progress based on plannedTasks and totalTasks from deliveryData
    const progress = deliveryData.totalTasks === 0 ? 0 : (deliveryData.plannedTasks / deliveryData.totalTasks) * 100;

    return (
        <Container className="delivery-detail-container my-4">
            <Row className="mb-4 align-items-center">
                <Col>
                    <h1 className="mb-0">Delivery: {deliveryData.delCode}</h1>
                    <p className="text-muted">Client: {deliveryData.client}</p>
                    <p className="mb-0 text-muted">{deliveryData.shortDescription}</p>
                </Col>
                <Col xs="auto" className="text-right">
                    <Button variant="secondary" onClick={() => navigate('/')} className="mr-2"> {/* Corrected: navigate to '/' */}
                        Back to List
                    </Button>
                    {userEmail && <Button variant="outline-danger" onClick={logoutUser}>
                        Logout
                    </Button>}
                </Col>
            </Row>

            <Card className="shadow-sm mb-4">
                <Card.Body>
                    <Row className="align-items-center">
                        <Col md={6}>
                            <p className="mb-1"><FiCheckCircle style={{ marginRight: '8px', color: 'green' }} /> <strong>{deliveryData.plannedTasks} of {deliveryData.totalTasks} Tasks Planned</strong></p>
                            <ProgressBar
                                now={progress}
                                variant={progress > 50 ? 'success' : progress > 20 ? 'warning' : 'danger'}
                                className="mb-3"
                            />
                        </Col>
                        <Col md={6} className="text-md-right">
                            <p className="mb-1 text-muted"><FiClock style={{ marginRight: '8px' }} /> Initiated: {deliveryData.initiated}</p>
                            <p className="mb-0 text-danger"><FiFlag style={{ marginRight: '8px' }} /> Deadline: {deliveryData.deadline}</p>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <h2 className="mb-3">Tasks Breakdown <FiLayers style={{ marginLeft: '5px' }} /></h2>
            {tasks && tasks.length > 0 ? (
                <ListGroup className="tasks-list">
                    {tasks.map((task, index) => (
                        <ListGroup.Item key={task.Key || index} className="task-item shadow-sm mb-3">
                            <Row className="align-items-center">
                                <Col md={8}>
                                    <h5 className="mb-1">Task {task.stepId}: {task.taskName}</h5>
                                    <p className="mb-1 text-muted">Responsibility: <Badge bg="info">{task.responsibility}</Badge></p>
                                    <p className="mb-1 text-muted">Duration: {task.durationMinutes} minutes</p>
                                    <p className="mb-1 text-muted">Planned: {task.isPlanned ? <Badge bg="success">Yes</Badge> : <Badge bg="warning">No</Badge>}</p>
                                    {task.notes && <p className="mb-0 text-info small"><FiInfo /> Notes: {task.notes}</p>}
                                </Col>
                                <Col md={4} className="text-md-right">
                                    {/* Using 'bg' prop for Bootstrap 5+ for Badge variants */}
                                    <p className="mb-1"><strong>Status:</strong> <Badge bg={task.status === 'Completed' ? 'success' : task.status === 'In Progress' ? 'primary' : 'secondary'}>{task.status || 'N/A'}</Badge></p>
                                    {task.plannedStart !== 'N/A' && <p className="mb-1 text-muted">Planned Start: {task.plannedStart}</p>}
                                    {task.plannedEnd !== 'N/A' && <p className="mb-1 text-muted">Planned End: {task.plannedEnd}</p>}
                                    {task.actualStart !== 'N/A' && <p className="mb-1 text-muted">Actual Start: {task.actualStart}</p>}
                                    {task.actualEnd !== 'N/A' && <p className="mb-0 text-muted">Actual End: {task.actualEnd}</p>}
                                </Col>
                            </Row>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            ) : (
                <Alert variant="info">No tasks found for this delivery.</Alert>
            )}
        </Container>
    );
};

export default DeliveryDetail;
