import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
// We must mock these functions/objects as they rely on a specific environment (BrowserRouter)
// We use placeholder functions for routing in this single-file context.
const Link = ({ to, children, className }) => <a href={to} className={className} onClick={(e) => { e.preventDefault(); console.log('NAVIGATE TO:', to); window.history.pushState({}, '', to); }}>{children}</a>;
const useNavigate = () => {
    return (path) => {
        console.log('NAVIGATING TO:', path);
        // In a real app, this would change the route. Here, we simulate navigation.
    };
};
// Re-import necessary components from 'react-bootstrap'
import { Container, Row, Col, Card, ProgressBar, Form, Button, Spinner } from 'react-bootstrap';

// --- MOCK AND INTERNAL DEPENDENCIES ---

// MOCK: UserContext (originally from './UserContext')
const UserContext = React.createContext({
    userEmail: 'mock.user@brightbraintech.com',
    userName: 'Mock User',
    logoutUser: () => { console.log('User logged out.'); alert('Logged out.'); }
});

// MOCK: Ant Design Notification (originally from 'antd')
const notification = {
    success: ({ message, description }) => { console.log('SUCCESS:', message, description); alert(`Success: ${message}\n${description}`); },
    error: ({ message, description }) => { console.log('ERROR:', message, description); alert(`Error: ${message}\n${description}`); },
    info: ({ message, description }) => { console.log('INFO:', message, description); alert(`Info: ${message}\n${description}`); },
};

// INLINE: CSS (originally from './DeliveryList.css' and custom styles)
const InlinedStyles = () => (
    <style jsx="true">{`
        .delivery-list-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            font-family: 'Inter', sans-serif;
        }
        .delivery-card {
            border-left: 5px solid #007bff;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            transition: all 0.3s ease;
            text-decoration: none; /* Ensure link style is removed */
            color: inherit;
        }
        .delivery-card:hover {
            box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
            transform: translateY(-2px);
        }
        .text-primary, .text-success, .text-danger {
            font-weight: 500;
        }
        .spinner-icon {
            animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `}</style>
);

// INTERNAL COMPONENT: FilterDeliveryBasedOnClientSelected
const FilterDeliveryBasedOnClientSelected = ({ clients, onClientSelect, selectedClient }) => (
    <Form.Group controlId="clientFilter">
        <Form.Label>Filter by Client</Form.Label>
        <Form.Control
            as="select"
            value={selectedClient}
            onChange={(e) => onClientSelect(e.target.value)}
            className="rounded-lg shadow-sm"
        >
            <option value="">All Clients</option>
            {clients.map((client) => (
                <option key={client} value={client}>{client}</option>
            ))}
        </Form.Control>
    </Form.Group>
);

// INTERNAL COMPONENT: SortDeliveriesByDate
const SortDeliveriesByDate = ({ sortOption, setSortOption }) => (
    <Form.Group controlId="sortOption">
        <Form.Label>Sort By</Form.Label>
        <Form.Control
            as="select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="rounded-lg shadow-sm"
        >
            <option value="latest">Latest Delivery (Code)</option>
            <option value="earliest">Earliest Delivery (Date)</option>
        </Form.Control>
    </Form.Group>
);

// INTERNAL COMPONENT: DeleteButton
const DeleteButton = ({ deliveryCode, onDelete }) => {
    const handleDelete = async (e) => {
        e.preventDefault(); // Prevent navigating to the detail page
        e.stopPropagation(); // Stop event propagation
        
        // In a real app, this would use a custom modal instead of alert
        if (!window.confirm(`Are you sure you want to delete delivery code ${deliveryCode}?`)) {
            return;
        }

        console.log(`Attempting to delete ${deliveryCode}`);
        
        // MOCK API CALL: Simulate deletion success
        // In a real app: await fetch(`${BACKEND_API_BASE_URL}/api/delete/${deliveryCode}`, { method: 'DELETE' });
        
        setTimeout(() => {
            console.log(`Mock deletion successful for ${deliveryCode}`);
            onDelete(deliveryCode); // Call the success handler
        }, 500); 
    };

    return (
        <Button 
            variant="danger" 
            size="sm" 
            onClick={handleDelete} 
            className="ms-2 rounded-lg shadow-md"
            title="Delete this delivery"
        >
            Delete
        </Button>
    );
};

// Debounce utility function
const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// Date formatting utility using native Date API (Replaces Moment.js usage)
const formatTimestamp = (rawTimestamp) => {
    // Safely extract timestamp value from BigQuery object structure if necessary
    const timestampValue = rawTimestamp && typeof rawTimestamp === 'object' && rawTimestamp.value
        ? rawTimestamp.value
        : rawTimestamp;

    if (!timestampValue) return 'N/A';
    
    try {
        const date = new Date(timestampValue);
        if (isNaN(date)) return 'N/A';

        // Use Intl.DateTimeFormat for YYYY-MM-DD format
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'); // Converts MM/DD/YYYY to YYYY-MM-DD

    } catch (e) {
        console.error("Date formatting failed:", e);
        return 'N/A';
    }
};

const BACKEND_API_BASE_URL = 'http://localhost:3001'; // Mock URL for single-file environment

const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// --- MAIN COMPONENT ---
const DeliveryList = () => {
    InlinedStyles(); // Apply internal CSS

    const { userEmail, userName, logoutUser } = useContext(UserContext);
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState('');
    const [clients, setClients] = useState([]);
    const [sortOption, setSortOption] = useState('latest');
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const navigate = useNavigate();

    // Mock Data for a single-file demonstration
    const MOCK_DELIVERIES = [
        { Key: 9003, DelCode_w_o__: 'BTT-9003', Client: 'Client A', Task_Details: 'E-commerce Integration Q3', Current_Status: 'In Progress', Completed_Tasks: 12, Total_Tasks: 20, Planned_Delivery_Timestamp: new Date(Date.now() + 86400000 * 15).toISOString(), Time_Left_For_Next_Task_dd_hh_mm_ss: '05d 10h 30m 00s' },
        { Key: 9001, DelCode_w_o__: 'BTT-9001', Client: 'Client B', Task_Details: 'Q2 Financial Reporting', Current_Status: 'Completed', Completed_Tasks: 10, Total_Tasks: 10, Planned_Delivery_Timestamp: new Date(Date.now() - 86400000 * 5).toISOString(), Time_Left_For_Next_Task_dd_hh_mm_ss: 'N/A' },
        { Key: 9002, DelCode_w_o__: 'BTT-9002', Client: 'Client A', Task_Details: 'CRM Migration Phase 1', Current_Status: 'On Track', Completed_Tasks: 5, Total_Tasks: 15, Planned_Delivery_Timestamp: new Date(Date.now() + 86400000 * 30).toISOString(), Time_Left_For_Next_Task_dd_hh_mm_ss: '15d 04h 00m 00s' },
    ];

    const fetchDeliveries = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // --- MOCK API CALL START ---
            let data = MOCK_DELIVERIES;
            
            // Apply search query mock filter
            const searchLower = searchQuery.toLowerCase();
            if (searchQuery) {
                data = data.filter(d => 
                    d.Task_Details.toLowerCase().includes(searchLower) ||
                    d.Delivery_code.toLowerCase().includes(searchLower) ||
                    d.DelCode_w_o__.toLowerCase().includes(searchLower)
                );
            }

            // Apply client filter mock
            if (selectedClient) {
                data = data.filter(d => d.Client === selectedClient);
            }
            
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 300));

            // Extract unique clients
            const uniqueClients = [...new Set(MOCK_DELIVERIES.map(delivery => delivery.Client))].filter(Boolean);
            setClients(uniqueClients);

            // Sort the data based on sortOption
            const sortedData = [...data].sort((a, b) => {
                if (sortOption === 'latest') {
                    // Sort by Key in descending order (numerically) for "latest"
                    const keyA = Number(a.Key);
                    const keyB = Number(b.Key);
                    return keyB - keyA;
                } else { // 'earliest'
                    const dateA = new Date(formatTimestamp(a.Planned_Delivery_Timestamp));
                    const dateB = new Date(formatTimestamp(b.Planned_Delivery_Timestamp));

                    if (isNaN(dateA) || isNaN(dateB)) return 0;
                    
                    return dateA.getTime() - dateB.getTime(); // Ascending order
                }
            });

            setDeliveries(sortedData);
            // --- MOCK API CALL END ---

        } catch (err) {
            console.error("Error fetching deliveries (mocked):", err);
            setError(err.message);
            setDeliveries([]);
        } finally {
            setLoading(false);
        }
    }, [userEmail, searchQuery, selectedClient, sortOption]);

    const debouncedFetchDeliveries = useCallback(
        debounce(fetchDeliveries, 500),
        [fetchDeliveries]
    );

    useEffect(() => {
        debouncedFetchDeliveries();
    }, [debouncedFetchDeliveries]);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleClientSelect = (client) => {
        setSelectedClient(client);
    };

    const handleDeleteSuccess = (deletedDeliveryCode) => {
        notification.success({
            message: 'Delivery Deleted',
            description: `Delivery with code ${deletedDeliveryCode} has been successfully deleted.`,
        });
        fetchDeliveries();
    };

    if (loading && deliveries.length === 0) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <Spinner animation="border" role="status" style={{ color: '#007bff' }}>
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5 text-center">
                <h2>Error Loading Deliveries</h2>
                <p className="text-danger">{error}</p>
                <Button onClick={fetchDeliveries}>Retry</Button>
            </Container>
        );
    }

    return (
        <Container className="delivery-list-container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Deliveries</h2>
                <div className="d-flex align-items-center">
                    {userEmail && <span className="me-3">Logged in as: <strong>{userName} ({userEmail})</strong></span>}
                    <Button variant="outline-secondary" onClick={logoutUser} className="rounded-lg shadow-md">Logout</Button>
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
                            className="rounded-lg shadow-sm"
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
                        const scheduledTasks = delivery.Completed_Tasks || 0; 
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

                        const formattedDeadline = formatTimestamp(delivery.Planned_Delivery_Timestamp);

                        return (
                            <Col key={delivery.Key}>
                                <Link to={`/delivery/data/${encodeURIComponent(delivery.DelCode_w_o__)}`} className="text-decoration-none">
                                    <Card className={`delivery-card h-100 ${progress === 100 ? 'border-success' : ''}`}>
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
                                                className="my-3 rounded-full"
                                                variant={progressBarVariant}
                                                style={{ height: '10px' }}
                                            />
                                            <p className="mb-0 text-center" style={{ color: 'black', fontWeight: 'bold' }}>
                                                {`${Math.round(progress)}% (${scheduledTasks} of ${totalTasks} completed)`}
                                            </p>
                                            <div className="d-flex justify-content-between align-items-center mt-2">
                                                <p className="mb-0 text-primary">
                                                    {/* Using text placeholder for FiClock */}
                                                    ⏱️ {delivery.Time_Left_For_Next_Task_dd_hh_mm_ss || 'N/A'}
                                                </p>
                                                <p className="mb-0 text-success">
                                                    {/* Using text placeholder for FiCheckCircle */}
                                                    ✅ {delivery.Current_Status}
                                                </p>
                                            </div>
                                            <div className="d-flex justify-content-between align-items-center mt-2">
                                                <p className="mb-0 text-danger">
                                                    {/* Using text placeholder for FiFlag */}
                                                    🚩 Deadline: {formattedDeadline}
                                                </p>
                                                <p
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault(); // Prevent link follow
                                                        
                                                        const el = document.createElement('textarea');
                                                        el.value = delivery.DelCode_w_o__;
                                                        document.body.appendChild(el);
                                                        el.select();
                                                        document.execCommand('copy');
                                                        document.body.removeChild(el);
                                                        
                                                        notification.info({
                                                            message: 'Copied!',
                                                            description: `${delivery.DelCode_w_o__} copied to clipboard.`,
                                                        });
                                                    }}
                                                    style={{ cursor: "pointer", color: "#007bff", textDecoration: "underline", fontWeight: 'bold' }}
                                                    title="Click to copy Delivery Code"
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
                    <Spinner animation="border" size="sm" style={{ color: '#007bff' }} />
                </div>
            )}
        </Container>
    );
};

// In a real application, this would be exported as default, but here 
// we include the minimal App wrapper for the component to function correctly.
// For the purpose of a single-file React component, we export the main component used.
export default DeliveryList;
