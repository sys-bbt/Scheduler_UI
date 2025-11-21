import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // 👈 Added useNavigate
import { Container, Row, Col, Card, ProgressBar, Form, Button } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag, FiEdit, FiSave, FiXCircle } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
import { useUser } from './UserContext';
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';
import { notification } from 'antd';
import moment from 'moment';
import axios from 'axios';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Debounce function is fine as is
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// --- NEW COMPONENT: Deadline Editor Logic ---
const DeliveryDeadlineEditor = ({ delivery, userEmail, onUpdateSuccess }) => {
    const rawDeadlineTimestamp = delivery.Planned_Delivery_Timestamp && typeof delivery.Planned_Delivery_Timestamp === 'object' && delivery.Planned_Delivery_Timestamp.value
        ? delivery.Planned_Delivery_Timestamp.value
        : delivery.Planned_Delivery_Timestamp;
    
    // Format the current deadline for the date input (YYYY-MM-DD)
    const initialDeadline = rawDeadlineTimestamp
        ? moment(rawDeadlineTimestamp).format('YYYY-MM-DD')
        : moment().format('YYYY-MM-DD');
        
    const [isEditing, setIsEditing] = useState(false);
    const [newDeadline, setNewDeadline] = useState(initialDeadline);
    const [isSaving, setIsSaving] = useState(false);

    // 🛑 FIX 1: Add a local stopPropagation function to buttons inside the editor
    const stopPropagation = (e) => {
        e.stopPropagation();
    };

    const handleSave = async () => {
        if (!newDeadline) return;
        setIsSaving(true);

        const newDeadlineDate = moment.utc(newDeadline).toISOString();

        try {
            await axios.put(`${BACKEND_API_BASE_URL}/api/delivery/update-deadline`, {
                delCodeWO: delivery.DelCode_w_o__,
                newDeadlineDate: newDeadlineDate,
                userEmail: userEmail, // Pass user email for server-side admin check
            });

            notification.success({
                message: 'Deadline Updated',
                description: `Deadline for ${delivery.DelCode_w_o__} updated to ${newDeadline}.`,
            });
            
            // Call the success handler in the parent to refresh the main list
            onUpdateSuccess(delivery.DelCode_w_o__);

            setIsEditing(false);
        } catch (error) {
            console.error('Error updating delivery deadline:', error);
            const errorMessage = error.response?.data?.message || 'Failed to update deadline.';
            notification.error({
                message: 'Update Failed',
                description: errorMessage,
                duration: 5,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        // Reset the date back to the initial date
        setNewDeadline(initialDeadline);
        setIsEditing(false);
    };
    
    // The current formatted deadline for display
    const formattedDisplayDate = moment(rawDeadlineTimestamp).isValid()
        ? moment(rawDeadlineTimestamp).format('YYYY-MM-DD')
        : 'N/A';

    return (
        // 🛑 FIX 2: Add stopPropagation to the main editor div
        // This ensures clicks on the editor component itself (like padding/margins) don't trigger the parent <Link>
        <div className="d-flex justify-content-between align-items-center mt-2" onClick={stopPropagation}>
            {isEditing ? (
                <>
                    <Form.Control
                        type="date"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        style={{ width: '150px' }}
                        disabled={isSaving}
                        // 🛑 FIX 3: Add stopPropagation to the Date input itself
                        onClick={stopPropagation} 
                    />
                    <div className="d-flex ms-2">
                        <Button
                            variant="success"
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="me-1"
                        >
                            {isSaving ? <FaSpinner className="spinner-icon" style={{ animation: 'spin 1.5s linear infinite' }} /> : <FiSave />}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            <FiXCircle />
                        </Button>
                    </div>
                </>
            ) : (
                <>
                    <p className="mb-0 text-danger">
                        <FiFlag style={{ marginRight: '5px' }} /> Deadline: **{formattedDisplayDate}**
                    </p>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        // 🛑 FIX 4: Add stopPropagation to the Edit button itself
                        onClick={(e) => { stopPropagation(e); setIsEditing(true); }}
                        title="Edit Deadline"
                    >
                        <FiEdit />
                    </Button>
                </>
            )}
        </div>
    );
};

// --- MAIN DeliveryList COMPONENT ---
const DeliveryList = () => {
    const navigate = useNavigate(); // 👈 Added hook for navigation
    const { userEmail, userName, logoutUser, isAdmin, isLoadingAdmin } = useUser();
    
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState('');
    const [clients, setClients] = useState([]);
    const [sortOption, setSortOption] = useState('latest');

    // fetchDeliveries function (Kept mostly the same, ensuring it triggers a full refresh)
    const fetchDeliveries = useCallback(async (currentSearchQuery, currentSelectedClient, currentSortOption) => {
        if (!userEmail) return; // Wait for user context
        
        setLoading(true);
        setError(null);
        try {
            let url = `${BACKEND_API_BASE_URL}/api/data?email=${encodeURIComponent(userEmail)}`;

            if (currentSearchQuery) {
                url += `&searchQuery=${encodeURIComponent(currentSearchQuery)}`;
            }
            if (currentSelectedClient) {
                url += `&clientFilter=${encodeURIComponent(currentSelectedClient)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch deliveries.');
            }
            const data = await response.json();

            // --- ACTIVE CLIENT FILTERING LOGIC (Using the previous logic) ---
            const CLIENT_STATUS_FIELD = 'Inactive';
            const ACTIVE_CLIENT_VALUE = 'Active';

            const activeClientDeliveries = data.filter(delivery => {
                const rawStatusValue = delivery[CLIENT_STATUS_FIELD];
                let statusString = null;
                if (rawStatusValue) {
                    statusString = typeof rawStatusValue === 'object' && rawStatusValue.value
                        ? String(rawStatusValue.value)
                        : String(rawStatusValue);
                }
                return statusString && statusString.trim().toLowerCase() === ACTIVE_CLIENT_VALUE.toLowerCase();
            });

            const uniqueClients = [...new Set(activeClientDeliveries.map(delivery => delivery.Client))].filter(Boolean);
            uniqueClients.sort((a, b) => a.localeCompare(b));
            setClients(uniqueClients);

            const sortedData = [...data].sort((a, b) => {
                const timestampA = a.Initiated_Timestamp && typeof a.Initiated_Timestamp === 'object' && a.Initiated_Timestamp.value
                    ? a.Initiated_Timestamp.value
                    : a.Initiated_Timestamp || a.Created_at;
                const timestampB = b.Initiated_Timestamp && typeof b.Initiated_Timestamp === 'object' && b.Initiated_Timestamp.value
                    ? b.Initiated_Timestamp.value
                    : b.Initiated_Timestamp || b.Created_at;

                const dateA = moment(timestampA);
                const dateB = moment(timestampB);

                if (!dateA.isValid() && !dateB.isValid()) return 0;
                if (!dateA.isValid()) return 1;
                if (!dateB.isValid()) return -1;

                if (currentSortOption === 'latest') {
                    return dateB.diff(dateA);
                } else {
                    return dateA.diff(dateB);
                }
            });

            setDeliveries(sortedData);
        } catch (err) {
            console.error("Error fetching deliveries:", err);
            setError(err.message);
            setDeliveries([]);
        } finally {
            setLoading(false);
        }
    }, [userEmail]); // Dependency on userEmail only

    // Create a stable debounced function
    const debouncedFetchDeliveries = useMemo(
        () => debounce((search, client, sort) => fetchDeliveries(search, client, sort), 500),
        [fetchDeliveries]
    );

    // useEffect now tracks the state variables and calls the debounced function
    useEffect(() => {
        if (userEmail) { // Only fetch if user is logged in
            debouncedFetchDeliveries(searchQuery, selectedClient, sortOption);
        }
    }, [searchQuery, selectedClient, sortOption, debouncedFetchDeliveries, userEmail]);

    // Handle delete or deadline update success (triggers a list refresh)
    const handleUpdateAndListRefresh = useCallback(() => {
        // Call fetchDeliveries directly with current state to instantly refresh the list
        fetchDeliveries(searchQuery, selectedClient, sortOption);
    }, [fetchDeliveries, searchQuery, selectedClient, sortOption]);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleClientSelect = (client) => {
        setSelectedClient(client);
    };

    // 🛑 NEW: Handler for the Card click to navigate to the task view
    const handleCardClick = (delCode) => {
        navigate(`/delivery/data/${encodeURIComponent(delCode)}`);
    };
    
    // --- LOADING AND ERROR STATES ---
    if (loading || isLoadingAdmin) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <FaSpinner
                    className="spinner-icon"
                    style={{ fontSize: '3rem', color: '#007bff', animation: 'spin 1.5s linear infinite' }}
                />
                <h4 className="ms-3">{isLoadingAdmin ? "Loading user privileges..." : "Loading deliveries..."}</h4>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5 text-center">
                <h2>Error Loading Deliveries</h2>
                <p className="text-danger">{error}</p>
                <Button onClick={handleUpdateAndListRefresh}>Retry</Button>
            </Container>
        );
    }

    return (
        <Container className="delivery-list-container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Deliveries</h2>
                <div className="d-flex align-items-center">
                    {userEmail && <span className="me-3">Logged in as: <strong>{userName} ({userEmail})</strong></span>}
                    <Button variant="outline-secondary" onClick={logoutUser}>Logout</Button>
                </div>
            </div>

            <Row className="mb-4 align-items-end">
                {/* Search, Filter, Sort Inputs... (Keep these as they were) */}
                <Col md={6}>
                    <Form.Group controlId="searchQuery">
                        <Form.Label>Search Deliveries</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Search by task details or delivery code..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                    </Form.Group>
                </Col>
                <Col md={3}>
                    <FilterDeliveryBasedOnClientSelected
                        clients={clients}
                        onClientSelect={handleClientSelect}
                        selectedClient={selectedClient}
                    />
                </Col>
                <Col md={3}>
                    <SortDeliveriesByDate
                        sortOption={sortOption}
                        setSortOption={setSortOption}
                    />
                </Col>
            </Row>

            <Row xs={1} md={1} lg={1} className="g-4">
                {deliveries.length > 0 ? (
                    deliveries.map((delivery) => {
                        // ... Progress Bar calculation logic ... (Keep as is)
                        const scheduledTasks = delivery.Planned_Tasks !== undefined ? delivery.Planned_Tasks : delivery.Completed_Tasks;
                        const totalTasks = delivery.Total_Tasks || 1;
                        const progress = (scheduledTasks / totalTasks) * 100;
                        let progressBarVariant = "primary";
                        if (progress === 100) {
                            progressBarVariant = "success";
                        } else if (progress >= 50) {
                            progressBarVariant = "warning";
                        } else {
                            progressBarVariant = "danger";
                        }

                        // --- RENDERING CHANGE START: Remove <Link> and use onClick on Card ---
                        return (
                            <Col key={delivery.Key}>
                                {/* 🛑 FIX 5: Use a div instead of <Link> for the card and handle navigation via onClick */}
                                <Card
                                    className={`delivery-card h-100`}
                                    onClick={() => handleCardClick(delivery.DelCode_w_o__)}
                                >
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <Card.Title className="mb-1">{delivery.Task_Details}</Card.Title>
                                                <Card.Subtitle className="mb-2 text-muted">
                                                    {delivery.Client} - {delivery.Delivery_code}
                                                </Card.Subtitle>
                                            </div>
                                            {/* 🚀 ADMIN DELETE BUTTON 🚀 */}
                                            {isAdmin && (
                                                <DeleteButton
                                                    deliveryCode={delivery.DelCode_w_o__}
                                                    onDelete={handleUpdateAndListRefresh} // Use the new universal handler
                                                />
                                            )}
                                        </div>
                                        <ProgressBar
                                            now={progress}
                                            className="my-3"
                                            variant={progressBarVariant}
                                        />
                                        <p className="mb-0 text-center" style={{ color: 'black', fontWeight: 'bold' }}>
                                            {`${Math.round(progress)}% (${scheduledTasks} of ${totalTasks} planned)`}
                                        </p>
                                        <div className="d-flex justify-content-between align-items-center mt-2">
                                            <p className="mb-0 text-primary">
                                                <FiClock style={{ marginRight: '5px' }} /> {delivery.Time_Left_For_Next_Task_dd_hh_mm_ss || 'N/A'}
                                            </p>
                                            <p className="mb-0 text-success">
                                                <FiCheckCircle style={{ marginRight: '5px' }} /> {delivery.Current_Status}
                                            </p>
                                        </div>
                                        
                                        {/* 🎯 ADMIN DEADLINE EDITING 🎯 */}
                                        {isAdmin ? (
                                            <DeliveryDeadlineEditor
                                                delivery={delivery}
                                                userEmail={userEmail}
                                                onUpdateSuccess={handleUpdateAndListRefresh}
                                            />
                                        ) : (
                                            <div className="d-flex justify-content-between align-items-center mt-2">
                                                <p className="mb-0 text-danger">
                                                    <FiFlag style={{ marginRight: '5px' }} /> Deadline: {moment(delivery.Planned_Delivery_Timestamp).isValid() ? moment(delivery.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : 'N/A'}
                                                </p>
                                                {/* Original DelCode link logic remains */}
                                                <p
                                                    onClick={(e) => {
                                                        e.preventDefault(); e.stopPropagation();
                                                        const el = document.createElement('textarea');
                                                        el.value = delivery.DelCode_w_o__;
                                                        document.body.appendChild(el);
                                                        el.select();
                                                        document.execCommand('copy');
                                                        document.body.removeChild(el);
                                                        notification.success({
                                                            message: 'Copied!',
                                                            description: `${delivery.DelCode_w_o__} copied to clipboard.`,
                                                            duration: 2,
                                                        });
                                                    }}
                                                    style={{ cursor: "pointer", color: "blue", textDecoration: "underline" }}
                                                    title="Click to copy"
                                                >
                                                    {delivery.DelCode_w_o__}
                                                </p>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                        // --- RENDERING CHANGE END ---
                    })
                ) : (
                    <Col>
                        <p className="text-center">No deliveries found matching your criteria.</p>
                    </Col>
                )}
            </Row>

            <div className="delivery-list-end"></div>

            {loading && deliveries.length > 0 && (
                <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
                    <FaSpinner
                        className="spinner-icon"
                        style={{ fontSize: '2rem', color: '#007bff', animation: 'spin 10s linear infinite' }}
                    />
                </div>
            )}
        </Container>
    );
};

export default DeliveryList;
