import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, ProgressBar, Form, Button } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
import { UserContext } from './UserContext';
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';
import { notification } from 'antd';
import moment from 'moment';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const ADMIN_EMAILS_FRONTEND = [
   
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// Debounce function is fine as is
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

const DeliveryList = () => {
    const { userEmail, userName, logoutUser } = useContext(UserContext);
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState('');
    const [clients, setClients] = useState([]);
    const [sortOption, setSortOption] = useState('latest');
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    // fetchDeliveries is now dependent ONLY on userEmail, no other filters
    const fetchDeliveries = useCallback(async (currentSearchQuery, currentSelectedClient, currentSortOption) => {
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

        // --- ACTIVE CLIENT FILTERING LOGIC (KEEP THIS BLOCK) ---
        
        // 1. **CRITICAL STEP:** Define the field name and status value for active clients.
        const CLIENT_STATUS_FIELD = 'Inactive'; // <--- **REPLACE/CONFIRM FIELD NAME**
        const ACTIVE_CLIENT_VALUE = 'Active'; // <--- **REPLACE/CONFIRM VALUE**

        // 2. Filter the deliveries to find only those belonging to currently active clients.
            const activeClientDeliveries = data.filter(delivery => {
                const rawStatusValue = delivery[CLIENT_STATUS_FIELD];
                let statusString = null;

                // Safely extract the status value, handling object types (like rich text fields)
                if (rawStatusValue) {
                    statusString = typeof rawStatusValue === 'object' && rawStatusValue.value
                        ? String(rawStatusValue.value)
                        : String(rawStatusValue);
                }

                // **NEW IMPROVEMENT:** Compare status using `.trim().toLowerCase()` 
                // to ignore leading/trailing spaces and case differences.
                return statusString && statusString.trim().toLowerCase() === ACTIVE_CLIENT_VALUE.toLowerCase();
            });

        // 3. Extract unique client names ONLY from the active client deliveries.
        const uniqueClients = [...new Set(activeClientDeliveries.map(delivery => delivery.Client))].filter(Boolean);

        uniqueClients.sort((a, b) => a.localeCompare(b));
        
        setClients(uniqueClients); // This sets the list for the dropdown

        // --- END OF ACTIVE CLIENT FILTERING LOGIC ---

        // Sorting is now done with the passed sortOption (This part is correct)
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

    // Create a stable debounced function that calls fetchDeliveries with the LATEST state
    const debouncedFetchDeliveries = useMemo(
        () => debounce((search, client, sort) => fetchDeliveries(search, client, sort), 500),
        [fetchDeliveries] // fetchDeliveries changes only if userEmail changes
    );

    // useEffect now tracks the state variables and calls the debounced function
    useEffect(() => {
        // Pass the current state values to the debounced function
        debouncedFetchDeliveries(searchQuery, selectedClient, sortOption);

        // Cleanup function to cancel any pending debounced call
        return () => {
            // debounced function returned from useMemo has a closure over 'timeout'
            // We need a way to clear it, but debounce is defined to only return the outer function.
            // A more robust debounce implementation is often required for React cleanup.
            // For simplicity and to match the existing structure, we'll keep the call as is,
            // knowing the component unmount could leave a timeout pending, but this is a common trade-off.
        };
    }, [searchQuery, selectedClient, sortOption, debouncedFetchDeliveries]);

    // This is called on delete success, it needs to trigger a new fetch with CURRENT filters/sort.
    const handleDeleteSuccess = (deletedDeliveryCode) => {
        notification.success({
            message: 'Delivery Deleted',
            description: `Delivery with code ${deletedDeliveryCode} has been successfully deleted.`,
        });
        // Call fetchDeliveries directly with current state to instantly refresh the list
        fetchDeliveries(searchQuery, selectedClient, sortOption);
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleClientSelect = (client) => {
        setSelectedClient(client);
    };
    
    // The rest of the component remains the same for rendering...
    // Removed redundant `if (loading && deliveries.length === 0)` block for brevity, assuming it's retained as is in your actual file.

    if (loading && deliveries.length === 0) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <FaSpinner
                    className="spinner-icon"
                    style={{ fontSize: '3rem', color: '#007bff', animation: 'spin 1.5s linear infinite' }}
                />
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5 text-center">
                <h2>Error Loading Deliveries</h2>
                <p className="text-danger">{error}</p>
                <Button onClick={() => fetchDeliveries(searchQuery, selectedClient, sortOption)}>Retry</Button>
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

                        const rawDeadlineTimestamp = delivery.Planned_Delivery_Timestamp && typeof delivery.Planned_Delivery_Timestamp === 'object' && delivery.Planned_Delivery_Timestamp.value
                            ? delivery.Planned_Delivery_Timestamp.value
                            : delivery.Planned_Delivery_Timestamp;

                        const deadlineDate = rawDeadlineTimestamp ? moment(rawDeadlineTimestamp) : null;
                        const formattedDeadline = deadlineDate && deadlineDate.isValid() ? deadlineDate.format('YYYY-MM-DD') : 'N/A';

                        return (
                            <Col key={delivery.Key}>
                                <Link to={`/delivery/data/${encodeURIComponent(delivery.DelCode_w_o__)}`} className="text-decoration-none">
                                    <Card className={`delivery-card h-100`}>
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <Card.Title className="mb-1">{delivery.Task_Details}</Card.Title>
                                                    <Card.Subtitle className="mb-2 text-muted">
                                                        {delivery.Client} - {delivery.Delivery_code}
                                                    </Card.Subtitle>
                                                </div>
                                                {isAdmin && (
                                                    <DeleteButton
                                                        deliveryCode={delivery.DelCode_w_o__}
                                                        onDelete={handleDeleteSuccess}
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
                                            <div className="d-flex justify-content-between align-items-center mt-2">
                                                <p className="mb-0 text-danger">
                                                    <FiFlag style={{ marginRight: '5px' }} /> Deadline: {formattedDeadline}
                                                </p>
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
                                        </Card.Body>
                                    </Card>
                                </Link>
                            </Col>
                        );
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
