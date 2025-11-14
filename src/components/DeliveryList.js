import React, { useEffect, useState, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Container, Card, Row, Col, Spinner, Alert, Form, InputGroup, Button } from 'react-bootstrap';
import { FaSortAlphaUp, FaSortAlphaDown, FaSearch, FaFilter } from 'react-icons/fa';
import moment from 'moment';
import { UserContext } from './UserContext';
import './DeliveryList.css'; // Assuming you have a CSS file

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Note: ADMIN_EMAILS_FRONTEND removed as per previous fix to avoid compilation error

const TaskCard = React.memo(({ delivery }) => {
    const deliveryCode = encodeURIComponent(delivery.DelCode_w_o__);
    const isCompleted = delivery.Current_Status === 'Completed';
    const cardStatus = delivery.Card_Corner_Status || 'Default';

    return (
        <Col>
            <Link to={`/delivery/data/${deliveryCode}`} style={{ textDecoration: 'none' }}>
                <Card className={`delivery-card shadow-sm ${isCompleted ? 'completed-card' : ''} status-${cardStatus.toLowerCase().replace(/\s/g, '-')}`}>
                    <Card.Body>
                        <Card.Title className="text-truncate">{delivery.Delivery_code}</Card.Title>
                        <Card.Text>
                            <strong>Client:</strong> {delivery.Client}<br />
                            <strong>Status:</strong> <span className={`status-badge ${delivery.Current_Status.toLowerCase()}`}>{delivery.Current_Status}</span><br />
                            <strong>Total Tasks:</strong> {delivery.Total_Tasks || 0}<br />
                            <strong>Completed:</strong> {delivery.Completed_Tasks || 0} ({delivery.Percent_Tasks_Completed || 0}%)
                        </Card.Text>
                        <p className="text-muted small mb-0 mt-2">
                            Planned Delivery: {delivery.Planned_Delivery_Timestamp 
                                ? moment.utc(delivery.Planned_Delivery_Timestamp).format('YYYY-MM-DD')
                                : 'N/A'}
                        </p>
                    </Card.Body>
                </Card>
            </Link>
        </Col>
    );
});


const DeliveryList = () => {
    const { userEmail } = useContext(UserContext);
    const [deliveries, setDeliveries] = useState([]);
    const [loadingData, setLoadingData] = useState(true); 
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [clients, setClients] = useState([]); // List for filter dropdown
    const [sortOrder, setSortOrder] = useState('latest'); 


    // ⭐ NEW: Fetch Active Client List Separately ⭐
    useEffect(() => {
        const fetchActiveClients = async () => {
            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/active-clients`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch active client list. Status: ${response.status}`);
                }
                const data = await response.json();
                setClients(data); // Set the client list for the filter dropdown
            } catch (err) {
                console.error('Error fetching active client list:', err);
                // Optionally show an alert or keep the list empty
            }
        };
        fetchActiveClients();
    }, []); // Run only once on mount


    // --- Data Fetching Logic (Task List) ---
    const fetchDeliveries = useCallback(async (currentSearchQuery, currentClientFilter, currentSortOrder) => {
        setLoadingData(true); 
        setError(null);

        // Build the query string
        const params = new URLSearchParams();
        if (userEmail) params.append('email', userEmail);
        if (currentSearchQuery) params.append('searchQuery', currentSearchQuery);
        if (currentClientFilter) params.append('clientFilter', currentClientFilter);

        const url = `${BACKEND_API_BASE_URL}/api/data?${params.toString()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch delivery data. Status: ${response.status}`);
            }
            let data = await response.json();

            // 🛑 REMOVED: Previous logic to extract clients from 'data' is removed. 
            // The clients list is now populated from the separate /api/active-clients endpoint.

            // Client-side sorting
            const sortedData = sortData(data, currentSortOrder);
            
            setDeliveries(sortedData);

        } catch (err) {
            console.error('Error fetching delivery data:', err);
            setError(err.message);
            setDeliveries([]); 
        } finally {
            setLoadingData(false); 
        }
    }, [userEmail]); 

    // --- Client-Side Sorting Function ---
    const sortData = (data, order) => {
        const sorted = [...data];
        
        switch (order) {
            case 'latest':
                // Sort by Planned_Delivery_Timestamp descending (latest first)
                sorted.sort((a, b) => {
                    const timeA = a.Planned_Delivery_Timestamp ? moment.utc(a.Planned_Delivery_Timestamp) : moment.utc(0);
                    const timeB = b.Planned_Delivery_Timestamp ? moment.utc(b.Planned_Delivery_Timestamp) : moment.utc(0);
                    return timeB.valueOf() - timeA.valueOf();
                });
                break;
            case 'earliest':
                // Sort by Planned_Delivery_Timestamp ascending (earliest first)
                sorted.sort((a, b) => {
                    const timeA = a.Planned_Delivery_Timestamp ? moment.utc(a.Planned_Delivery_Timestamp) : moment.utc(0);
                    const timeB = b.Planned_Delivery_Timestamp ? moment.utc(b.Planned_Delivery_Timestamp) : moment.utc(0);
                    return timeA.valueOf() - timeB.valueOf();
                });
                break;
            default:
                break;
        }
        return sorted;
    };

    // Initial data fetch and refetch when filters/sort change
    useEffect(() => {
        const handler = setTimeout(() => {
            fetchDeliveries(searchQuery, clientFilter, sortOrder);
        }, 300); 

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery, clientFilter, sortOrder, fetchDeliveries]);

    // Handlers for UI interactions
    const handleSearchChange = (e) => setSearchQuery(e.target.value);
    const handleClientFilterChange = (e) => setClientFilter(e.target.value);
    const handleSortChange = (newSortOrder) => {
        if (sortOrder === newSortOrder) {
             setSortOrder(newSortOrder === 'latest' ? 'earliest' : 'latest');
        } else {
             setSortOrder(newSortOrder);
        }
    }
    
    // --- Render Logic ---
    if (error && !deliveries.length && !loadingData) {
        return (
            <Container className="mt-5 text-center">
                <Alert variant="danger">
                    <h2>Error</h2>
                    <p>{error}</p>
                </Alert>
            </Container>
        );
    }
    
    return (
        <Container className="delivery-list-container mt-4">
            <h2 className="mb-4">Task Scheduler Dashboard</h2>
            
            {/* --- Filter and Search Controls --- */}
            <Row className="mb-4 g-2 align-items-center">
                
                {/* Search Bar */}
                <Col md={6} lg={4}>
                    <InputGroup>
                        <InputGroup.Text><FaSearch /></InputGroup.Text>
                        <Form.Control
                            type="text"
                            placeholder="Search by Task/Delivery Code..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                    </InputGroup>
                </Col>

                {/* Client Filter */}
                <Col md={3} lg={3}>
                    <InputGroup>
                        <InputGroup.Text><FaFilter /></InputGroup.Text>
                        <Form.Select value={clientFilter} onChange={handleClientFilterChange}>
                            <option value="">Filter by Client (All)</option>
                            {clients.map(client => (
                                // Use the clients list fetched from the new dedicated endpoint
                                <option key={client} value={client}>{client}</option>
                            ))}
                        </Form.Select>
                    </InputGroup>
                </Col>
                
                {/* Sort Buttons */}
                <Col md={3} lg={5} className="d-flex justify-content-end">
                    <Button 
                        variant={sortOrder === 'latest' ? 'primary' : 'outline-secondary'} 
                        onClick={() => handleSortChange('latest')}
                        className="me-2"
                        disabled={loadingData}
                    >
                        <FaSortAlphaDown className="me-1" /> Latest Delivery
                    </Button>
                    <Button 
                        variant={sortOrder === 'earliest' ? 'primary' : 'outline-secondary'} 
                        onClick={() => handleSortChange('earliest')}
                        disabled={loadingData}
                    >
                        <FaSortAlphaUp className="me-1" /> Earliest Delivery
                    </Button>
                </Col>
            </Row>

            {/* --- Data Display Area --- */}
            <div className="position-relative">
                {loadingData && (
                    <div className="loading-overlay">
                        <Spinner animation="border" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </Spinner>
                        <p className="mt-2">Loading tasks, please wait...</p>
                    </div>
                )}
                
                <Row xs={1} md={2} lg={3} xl={4} className={`g-4 ${loadingData ? 'content-hidden' : ''}`}>
                    {deliveries.length > 0 ? (
                        deliveries.map((delivery) => (
                            <TaskCard key={delivery.Key} delivery={delivery} />
                        ))
                    ) : (
                        !loadingData && (
                            <Col xs={12}>
                                <Alert variant="info">
                                    No workflows found matching your criteria.
                                </Alert>
                            </Col>
                        )
                    )}
                </Row>
            </div>
        </Container>
    );
};

export default DeliveryList;
