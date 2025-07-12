import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import { FiCheckCircle } from 'react-icons/fi'; // Added import for FiCheckCircle
import FormComponent from './FormComponent';
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';
import moment from 'moment'; // Added import for moment

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

// Define the status value that indicates a task is completed and should be hidden
const COMPLETED_TASK_STATUS = 'Completed'; // Adjust this string to match your BigQuery 'Current_Status' for completed tasks

// Define admin emails on the frontend, matching the backend
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
    const deliveryCode = delCodeMatch ? decodeURIComponent(delCodeMatch[1]) : null;

    const [deliveryDetails, setDeliveryDetails] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState(null); // 'edit', 'pause', 'play', 'stop'

    const { userEmail } = useContext(UserContext); // Get userEmail from context
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail); // Corrected spelling here


    const fetchDeliveryDetails = async () => {
        if (!deliveryCode) {
            setError("Delivery code not found in URL.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // UPDATED API ENDPOINT: Fetch all tasks for this workflow
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/workflow-details/${encodeURIComponent(deliveryCode)}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch workflow details for ${deliveryCode}.`);
            }
            const data = await response.json();
            
            if (data.length === 0) {
                setError(`Workflow with code "${deliveryCode}" not found or has no tasks.`);
                setLoading(false);
                return;
            }

            // Assuming the first item with Step_ID=0 is the main workflow detail
            const mainDeliveryDetail = data.find(task => task.Step_ID === 0);
            setDeliveryDetails(mainDeliveryDetail || data[0]); // Fallback if no Step_ID=0

            // Filter out completed tasks if not admin
            const filteredTasks = isAdmin
                ? data
                : data.filter(task => task.Current_Status !== COMPLETED_TASK_STATUS || task.Emails?.includes(userEmail) || task.Emails?.includes("systems@brightbraintech.com"));

            // Sort tasks: Step_ID=0 first, then by Step_ID ascending
            const sortedTasks = filteredTasks.sort((a, b) => {
                if (a.Step_ID === 0) return -1;
                if (b.Step_ID === 0) return 1;
                return a.Step_ID - b.Step_ID;
            });

            setTasks(sortedTasks);

        } catch (err) {
            console.error("Error fetching delivery details:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveryDetails();
    }, [deliveryCode, userEmail, isAdmin]); // Re-fetch if deliveryCode or userEmail/isAdmin changes


    const handleFormSubmit = (updatedTaskData) => {
        // Find the task by key and update its properties
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.Key === updatedTaskData.Key
                    ? { ...task, ...updatedTaskData }
                    : task
            )
        );
        setActiveTaskKey(null); // Close the form after submission
        setActionType(null); // Clear action type
        fetchDeliveryDetails(); // Re-fetch all details to ensure consistency
    };

    const handleActionClick = (taskKey, type) => {
        setActiveTaskKey(taskKey);
        setActionType(type);
    };

    const onVisibleChange = (visible) => {
        if (!visible) {
            setActiveTaskKey(null); // Close form if dropdown closes
            setActionType(null);
        }
    };

    const renderMenu = (task) => (
        <Menu>
            <MenuItem key="edit" onClick={() => handleActionClick(task.Key, 'edit')}>
                Edit
            </MenuItem>
            {/* Add more actions here if needed, e.g., Pause, Play, Stop */}
            {/* Conditional rendering based on task status */}
            {task.Current_Status === 'Running' && (
                <MenuItem key="pause" onClick={() => handleActionClick(task.Key, 'pause')}>
                    <FaPause style={{ marginRight: '5px' }} /> Pause
                </MenuItem>
            )}
            {task.Current_Status === 'Paused' && (
                <MenuItem key="play" onClick={() => handleActionClick(task.Key, 'play')}>
                    <FaPlay style={{ marginRight: '5px' }} /> Play
                </MenuItem>
            )}
            {task.Current_Status !== 'Completed' && ( // Assuming 'Completed' tasks cannot be stopped
                <MenuItem key="stop" onClick={() => handleActionClick(task.Key, 'stop')}>
                    <FaStop style={{ marginRight: '5px' }} /> Stop
                </MenuItem>
            )}
            {/* Example: Mark as Completed */}
            {task.Current_Status !== 'Completed' && (
                <MenuItem key="complete" onClick={() => handleActionClick(task.Key, 'complete')}>
                    <FiCheckCircle style={{ marginRight: '5px' }} /> Mark as Completed
                </MenuItem>
            )}
        </Menu>
    );

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5 text-center">
                <h2>Error Loading Workflow Details</h2>
                <p className="text-danger">{error}</p>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    if (!deliveryDetails) {
        return (
            <Container className="mt-5 text-center">
                <h2>No Workflow Details Found</h2>
                <p>The requested workflow could not be found.</p>
                <Link to="/" className="btn btn-primary mt-3">Back to Deliveries</Link>
            </Container>
        );
    }

    return (
        <Container className="delivery-detail-container mt-4">
            <h2 className="mb-4">Workflow: {deliveryDetails.Delivery_code}</h2>
            <p><strong>Client:</strong> {deliveryDetails.Client}</p>
            <p><strong>Description:</strong> {deliveryDetails.Short_Description}</p>
            <p><strong>Planned Start:</strong> {deliveryDetails.Planned_Start_Timestamp ? moment(deliveryDetails.Planned_Start_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Planned Delivery:</strong> {deliveryDetails.Planned_Delivery_Timestamp ? moment(deliveryDetails.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : 'N/A'}</p>
            <p><strong>Overall Status:</strong> {deliveryDetails.Current_Status}</p>

            <h3 className="mt-5 mb-3">Tasks in this Workflow:</h3>
            <Row xs={1} md={2} lg={3} className="g-4">
                {tasks.length > 0 ? (
                    tasks.map((task) => {
                        const isTaskCompleted = task.Current_Status === COMPLETED_TASK_STATUS;
                        const isTaskAssignedToCurrentUser = task.Emails?.includes(userEmail);
                        const isTaskAssignedToSystem = task.Emails?.includes("systems@brightbraintech.com");

                        // Determine if the task should be shown based on admin status and assignment
                        const shouldShowTask = isAdmin || isTaskAssignedToCurrentUser || isTaskAssignedToSystem;

                        if (!shouldShowTask) {
                            return null; // Skip rendering if not visible to the current user
                        }

                        return (
                            <Col key={task.Key}>
                                <Dropdown
                                    overlay={renderMenu(task)}
                                    trigger={['click']}
                                    onVisibleChange={onVisibleChange}
                                >
                                    <div className="d-flex justify-content-center">
                                        <Card
                                            className={`task-card ${isTaskCompleted ? 'task-completed' : ''} ${task.Key === activeTaskKey ? 'active-task' : ''}`}
                                            style={{ width: '100%', cursor: 'pointer' }}
                                        >
                                            <Card.Body>
                                                <Card.Title>{task.Task_Details}</Card.Title>
                                                <Card.Text>
                                                    <strong>Step ID:</strong> {task.Step_ID}<br />
                                                    <strong>Responsibility:</strong> {task.Responsibility}<br />
                                                    <strong>Status:</strong> {task.Current_Status}
                                                </Card.Text>
                                                <div className="d-flex justify-content-between align-items-center mt-3">
                                                    {task.Planned_Start_Timestamp && (
                                                        <p className="text-muted mb-0">
                                                            <FaCalendarAlt style={{ marginRight: '5px' }} />
                                                            Start: {moment(task.Planned_Start_Timestamp).format('YYYY-MM-DD')}
                                                        </p>
                                                    )}
                                                    {task.Current_Status === 'Paused' && (
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
