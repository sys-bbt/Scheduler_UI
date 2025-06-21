import React, { useEffect, useState, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Card, ListGroup, Row, Col, Spinner } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt } from 'react-icons/fa';
import FormComponent from './FormComponent'; // Ensure your form component is imported
import { UserContext } from './UserContext'; // Import UserContext
import { notification } from 'antd'; // Ensure notification is imported
import 'rc-dropdown/assets/index.css';
import './DeliveryDetail.css';

// --- NEW: Define the base URL for your backend API, consistent with FormComponent ---
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryDetail: Using Backend API URL:', BACKEND_API_BASE_URL);

const DeliveryDetail = () => {
    const location = useLocation();
    const delCodeMatch = location.pathname.match(/\/delivery\/data\/(\d+)/);
    const delCode = delCodeMatch ? delCodeMatch[1] : null;

    const { userEmail } = useContext(UserContext);
    console.log('DeliveryDetail: userEmail from Context:', userEmail);

    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTaskKey, setActiveTaskKey] = useState(null);
    const [actionType, setActionType] = useState('');
    const [tasks, setTasks] = useState([]);
    // NEW STATE: To hold Planned_Tasks and Total_Tasks for the main delivery card
    const [deliveryCounts, setDeliveryCounts] = useState({ totalTasks: 0, plannedTasks: 0 });

    // Fetching delivery details from the server
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

                const deliveryResponse = await fetch(`${BACKEND_API_BASE_URL}/api/data?email=${userEmail}&delCode=${delCode}`);
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
                    const allTasksForDelCode = deliveryData[delCode];
                    
                    // Identify the main delivery card (Step_ID = 0)
                    const mainDeliveryEntry = allTasksForDelCode.find(task => task.Step_ID === 0);
                    if (mainDeliveryEntry) {
                        setDeliveryCounts({
                            totalTasks: mainDeliveryEntry.Total_Tasks || 0,
                            plannedTasks: mainDeliveryEntry.Planned_Tasks || 0,
                        });
                    }

                    // Filtering tasks with Step_ID !== 0 and Planned_Delivery_Timestamp being null
                    const fetchedTasks = allTasksForDelCode
                       .filter((task) => task.Step_ID !== 0) // Filter for sub-tasks
                        .map((task) => {
                            const taskDurationInMinutes = durationData[task.Key]?.totalDuration || 0;
                            const hours = Math.floor(taskDurationInMinutes / 60);
                            const minutes = taskDurationInMinutes % 60;
                            const formattedDuration = `${hours}h ${minutes}m`;

                            // Determine 'scheduled' status based on whether it has a planned delivery timestamp
                            const isScheduled = !!task.Planned_Delivery_Timestamp && 
                                (typeof task.Planned_Delivery_Timestamp === 'string' 
                                    ? task.Planned_Delivery_Timestamp !== "NULL" && task.Planned_Delivery_Timestamp !== ""
                                    : task.Planned_Delivery_Timestamp.value !== null && task.Planned_Delivery_Timestamp.value !== "");

                            return {
                                ...task,
                                scheduled: isScheduled, // Use the new isScheduled variable
                                personResponsible: task.Responsibility || 'Unassigned',
                                totalTime: taskDurationInMinutes, // Keep total duration in minutes
                                formattedDuration,
                                isPlaying: false, // Default to not playing
                            };
                        });
                    setDelivery(allTasksForDelCode); // Set all delivery data
                    setTasks(fetchedTasks); // Set filtered sub-tasks
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
    }, [delCode, userEmail]); 

    // Handle form submission from FormComponent
    const handleFormSubmit = async (formData) => {
        console.log("Form submitted data to DeliveryDetail:", formData);
        
        // Find the task that was just updated
        const updatedTask = tasks.find(t => t.Key === activeTaskKey);
        
        // Check if the task was newly scheduled (it was unscheduled, and now has planned time)
        // AND if the totalTime is greater than 0
        const wasNewlyScheduled = !updatedTask?.scheduled && (formData.totalTime || 0) > 0;

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

        // NEW LOGIC: Update Planned_Tasks for the main delivery card if a task was newly scheduled
        if (wasNewlyScheduled) {
            const newPlannedTasksCount = deliveryCounts.plannedTasks + 1;
            setDeliveryCounts(prev => ({ ...prev, plannedTasks: newPlannedTasksCount })); // Update local state immediately

            try {
                // Call backend to update Planned_Tasks for the main delivery entry (Step_ID = 0)
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/delivery_counts/${delCode}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ newPlannedTasks: newPlannedTasksCount, newTotalTasks: deliveryCounts.totalTasks }), // Pass both for completeness
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }
                notification.success({
                    message: 'Delivery Counts Updated',
                    description: `Planned tasks for delivery ${delCode} updated successfully!`,
                });
            } catch (error) {
                console.error('Error updating delivery counts:', error);
                notification.error({
                    message: 'Update Failed',
                    description: `Failed to update delivery planned tasks: ${error.message}`,
                });
                // OPTIONAL: Rollback local state if backend update fails
                setDeliveryCounts(prev => ({ ...prev, plannedTasks: prev.plannedTasks - 1 }));
            }
        }
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

    // Find the main delivery card for display data
    const mainDeliveryDisplay = delivery.find(task => task.Step_ID === 0) || delivery[0]; // Fallback to first if 0 not found

    const client = mainDeliveryDisplay?.Client || 'Unknown Client';
    const shortDescription = mainDeliveryDisplay?.Short_Description || 'No description available';
    const plannedStart = mainDeliveryDisplay?.Planned_Start_Timestamp?.value ? new Date(mainDeliveryDisplay.Planned_Start_Timestamp.value).toLocaleString() : 'N/A';
    const plannedDelivery = mainDeliveryDisplay?.Planned_Delivery_Timestamp?.value ? new Date(mainDeliveryDisplay.Planned_Delivery_Timestamp.value).toLocaleString() : 'N/A';

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
                                                        <span className="text-muted">{task.personResponsible}</span> {/* Show the person responsible */}
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
