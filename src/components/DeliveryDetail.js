import React, { useEffect, useState, useContext, memo } from 'react';
import { useLocation, Link, useParams } from 'react-router-dom';
import { Container, Card, Row, Col, Spinner, Alert, ListGroup } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt, FaEllipsisV } from 'react-icons/fa';
import FormComponent from './FormComponent'; // This will be the memoized version
import { UserContext } from './UserContext';
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css'; // Assuming you have this CSS file
import moment from 'moment';
import { notification } from 'antd';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

// Define the status value that indicates a task is completed and should be hidden
const COMPLETED_TASK_STATUS = 'Completed'; 

// Define admin emails on the frontend, matching the backend
const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

/**
 * Memoized TaskCard Component
 * This component is wrapped in React.memo to prevent unnecessary re-renders.
 * It will only re-render if its props (task, userEmail, etc.) change.
 */
const TaskCard = memo(({ 
    task, 
    userEmail, 
    isAdmin, 
    activeTaskKey, 
    actionType, 
    handleMenuSelect, 
    handleFormSubmit 
}) => {

    // Define the menu for this specific task
    const menu = (
        <Menu onClick={({ key }) => handleMenuSelect(key, task)}>
            <MenuItem key="edit" disabled={!isAdmin && task.Responsibility !== userEmail}>
                <FaCalendarAlt /> Schedule Task
            </MenuItem>
            <MenuItem key="In-Progress" disabled={!isAdmin && task.Responsibility !== userEmail}>
                <FaPlay /> Start Task
            </MenuItem>
            <MenuItem key="Paused" disabled={!isAdmin && task.Responsibility !== userEmail}>
                <FaPause /> Pause Task
            </MenuItem>
            <MenuItem key="Completed" disabled={!isAdmin && task.Responsibility !== userEmail}>
                <FaStop /> Complete Task
            </MenuItem>
        </Menu>
    );

    return (
        <Col md={6} lg={4} className="mb-4">
            <Card className={`task-card task-status-${task.Status.replace(/\s+/g, '-')}`}>
                <Card.Body>
                    <Row>
                        <Col>
                            <Card.Title>{task.Task_Details}</Card.Title>
                        </Col>
                        <Col xs="auto">
                            <Dropdown
                                trigger={['click']}
                                overlay={menu}
                                animation="slide-up"
                            >
                                <FaEllipsisV style={{ cursor: 'pointer', color: '#007bff' }} />
                            </Dropdown>
                        </Col>
                    </Row>
                    <Card.Text>{task.Short_Description}</Card.Text>
                    <Row className="task-details-row">
                        <Col md={6}>
                            <p><strong>Status:</strong> {task.Status}</p>
                        </Col>
                        <Col md={6}>
                            <p><strong>Responsible:</strong> {task.Responsibility.split('@')[0]}</p>
                        </Col>
                    </Row>
                    <Row className="task-details-row">
                        <Col md={6}>
                            <p><strong>Planned Delivery:</strong> {moment(task.Planned_Delivery_Timestamp).format('YYYY-MM-DD')}</p>
                        </Col>
                        {/* REQ 1: "Initiated Timestamp" display has been removed from here.
                        */}
                    </Row>

                    {/* REQ 3 & 4: FormComponent is displayed conditionally.
                      Because this TaskCard is memoized, this check is efficient and won't
                      cause other cards to re-evaluate or re-render.
                    */}
                    {activeTaskKey === task.Key && actionType === 'edit' && (
                        <div className="mt-3">
                            <hr />
                            <h6>Schedule Task: {task.Task_Details}</h6>
                            <FormComponent
                                onSubmit={handleFormSubmit}
                                task={task}
                                currentUserEmail={userEmail}
                            />
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Col>
    );
});

// Main DeliveryDetail Component
const DeliveryDetail = () => {
    const { deliveryId } = useParams();
    const location = useLocation();
    const { userEmail } = useContext(UserContext);

    // Calculate isAdmin once and pass it down
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [delivery, setDelivery] = useState(location.state?.delivery || null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for managing which task form is open
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState(null); // 'edit' or 'status'

    // Fetch Delivery Details
    useEffect(() => {
        if (!delivery) {
            console.log('Fetching delivery details for:', deliveryId);
            fetch(`${BACKEND_API_BASE_URL}/api/deliveries/${deliveryId}`)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => setDelivery(data))
                .catch(err => {
                    console.error('Error fetching delivery details:', err);
                    setError(err.message);
                });
        }
    }, [delivery, deliveryId]);

    // Fetch Tasks
    useEffect(() => {
        console.log('Fetching tasks for:', deliveryId);
        setLoading(true);
        fetch(`${BACKEND_API_BASE_URL}/api/tasks/${deliveryId}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                setTasks(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching tasks:', err);
                setError(err.message);
                setLoading(false);
            });
    }, [deliveryId]);

    // Handler for form submission
    const handleFormSubmit = (updatedTask) => {
        // Update the task in the local state
        const updatedTasks = tasks.map(t => (t.Key === updatedTask.Key ? updatedTask : t));
        setTasks(updatedTasks);
        
        // Close the form
        setActiveTaskKey(null);
        setActionType(null);

        notification.success({
            message: 'Task Updated',
            description: `Task "${updatedTask.Task_Details}" has been successfully scheduled.`,
            placement: 'topRight',
        });
    };

    // Handler for status updates (play, pause, stop)
    const updateTaskStatus = (task, newStatus) => {
        console.log(`Updating status for task ${task.Key} to ${newStatus}`);
        
        fetch(`${BACKEND_API_BASE_URL}/api/tasks/update-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                Key: task.Key,
                Delivery_code: task.Delivery_code,
                Step_ID: task.Step_ID,
                newStatus: newStatus,
                userEmail: userEmail,
            }),
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(err => { throw new Error(err.error || 'Failed to update status'); });
            }
            return res.json();
        })
        .then(updatedTask => {
            // Update local state
            const updatedTasks = tasks.map(t => (t.Key === updatedTask.Key ? updatedTask : t));
            setTasks(updatedTasks);
            
            notification.info({
                message: 'Task Status Updated',
                description: `Task "${updatedTask.Task_Details}" is now ${updatedTask.Status}.`,
                placement: 'topRight',
            });
        })
        .catch(err => {
            console.error('Error updating task status:', err);
            notification.error({
                message: 'Update Failed',
                description: err.message || 'Could not update task status.',
                placement: 'topRight',
            });
        });
    };

    // Handler for menu item selection
    const handleMenuSelect = (key, task) => {
        if (key === 'edit') {
            // REQ 3: Toggle logic
            // If clicking 'edit' on the *same task* that is already active, close it.
            if (activeTaskKey === task.Key && actionType === 'edit') {
                setActiveTaskKey(null);
                setActionType(null);
            } else {
                // Otherwise, open the new task's form.
                setActiveTaskKey(task.Key);
                setActionType('edit');
            }
        } else {
            // Handle status changes (play, pause, stop)
            setActiveTaskKey(null); // Hide form
            setActionType(null);
            updateTaskStatus(task, key);
        }
    };

    if (loading) {
        return (
            <Container className="text-center mt-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p>Loading delivery details...</p>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5">
                <Alert variant="danger">
                    <Alert.Heading>Error</Alert.Heading>
                    <p>Failed to load delivery details: {error}</p>
                    <Link to="/" className="btn btn-primary">Back to Deliveries</Link>
                </Alert>
            </Container>
        );
    }

    return (
        <Container className="delivery-detail-container mt-4">
            {delivery && (
                <div className="delivery-header mb-4">
                    <h2>{delivery.DelCode_w_o__}</h2>
                    <p><strong>Client:</strong> {delivery.Client}</p>
                    <p><strong>Description:</strong> {delivery.Short_Description}</p>
                </div>
            )}

            <h4 className="mb-3">Tasks</h4>
            <Row>
                {tasks.length > 0 ? (
                    tasks.map((task) => {
                        // Filter out completed tasks from display
                        if (task.Status === COMPLETED_TASK_STATUS) {
                            return null;
                        }
                        // Render the memoized TaskCard component
                        return (
                            <TaskCard
                                key={task.Key}
                                task={task}
                                userEmail={userEmail}
                                isAdmin={isAdmin}
                                activeTaskKey={activeTaskKey}
                                actionType={actionType}
                                handleMenuSelect={handleMenuSelect}
                                handleFormSubmit={handleFormSubmit}
                            />
                        );
                    })
                ) : (
                    <Col>
                        <ListGroup.Item>No tasks available for this delivery.</ListGroup.Item>
                    </Col>
                )}
            </Row>

            <Link to="/" className="btn btn-primary mt-4 mb-4">
                Back to Deliveries
            </Link>
        </Container>
    );
};

export default DeliveryDetail;
