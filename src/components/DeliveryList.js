import React, { useState, useEffect, useCallback, useContext, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, ProgressBar, Form } from 'react-bootstrap';
// Icons are assumed to be available or inlined via the build process in a real project
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi'; 
import { FaSpinner } from 'react-icons/fa';
import { UserContext } from './UserContext';
// Note: We are assuming react-bootstrap, antd (for notification), react-icons, and moment are available.
import { notification } from 'antd'; 
import moment from 'moment';

// Placeholder/Dummy Imports for missing components in this single-file environment
const FilterDeliveryBasedOnClientSelected = ({ clientFilter, handleClientChange, clientOptions }) => (
    <Form.Select value={clientFilter} onChange={handleClientChange}>
        {clientOptions.map(client => (
            <option key={client} value={client}>{client}</option>
        ))}
    </Form.Select>
);

const SortDeliveriesByDate = ({ dateSort, setDateSort }) => (
    <Form.Select value={dateSort} onChange={(e) => setDateSort(e.target.value)}>
        <option value="Planned_Delivery_Timestamp_Asc">Planned Delivery (Oldest First)</option>
        <option value="Planned_Delivery_Timestamp_Desc">Planned Delivery (Newest First)</option>
        <option value="Initiated_Timestamp_Desc">Initiated (Newest First)</option>
    </Form.Select>
);

const DeleteButton = ({ deliveryKey, userEmail, onDelete }) => {
    const handleDeleteClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this delivery?')) {
            // In a real app, this would call a backend API to delete the delivery
            console.log(`Deleting delivery with key: ${deliveryKey} by user: ${userEmail}`);
            // Mock successful deletion
            onDelete(deliveryKey); 
        }
    };
    return (
        <button 
            onClick={handleDeleteClick} 
            className="btn btn-danger btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
        >
            Delete
        </button>
    );
};

// --- Inlined UserContext (replaces external file) ---
const UserContext = React.createContext({ 
    userEmail: 'default.user@example.com' 
});
// --- End UserContext ---

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Define admin emails on the frontend
const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// Debounce utility function
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

// Helper to determine card class based on status
const getCardClass = (status) => {
    switch (status) {
        case 'Completed':
            return 'border-success shadow-sm';
        case 'In-Progress':
            return 'border-primary shadow-lg';
        case 'On-Hold':
            return 'border-warning shadow-sm';
        default:
            return 'border-secondary shadow-sm';
    }
};

/**
 * DeliveryCard Component
 */
const DeliveryCard = memo(({ delivery, isAdmin, userEmail, handleDelete }) => {
    const progress = delivery.progress || 0;
    const isCompleted = delivery.Status === 'Completed';

    const copyToClipboard = (e) => {
        e.preventDefault(); // Prevent navigation
        // Using document.execCommand('copy') for better compatibility in iFrames
        const el = document.createElement('textarea');
        el.value = delivery.DelCode_w_o__;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);

        notification.success({
            message: 'Copied to Clipboard',
            description: `${delivery.DelCode_w_o__} copied.`,
            placement: 'topRight',
        });
    };

    return (
        <Col md={6} lg={4} className="mb-4">
            <Link
                to={`/delivery/${delivery.DelCode_w_o__}`}
                state={{ delivery }}
                className="text-decoration-none"
            >
                <Card className={`h-100 transition-shadow hover:shadow-xl ${getCardClass(delivery.Status)}`}>
                    <Card.Body>
                        <Row className="align-items-start">
                            <Col className="flex-grow-1">
                                <Card.Title className="h6 text-truncate mb-1">{delivery.Client}</Card.Title>
                                <Card.Subtitle className="mb-2 text-muted small">
                                    {delivery.Short_Description}
                                </Card.Subtitle>
                            </Col>
                            {isAdmin && (
                                <Col xs="auto">
                                    <DeleteButton
                                        deliveryKey={delivery.Key}
                                        userEmail={userEmail}
                                        onDelete={handleDelete}
                                    />
                                </Col>
                            )}
                        </Row>

                        <ProgressBar
                            now={progress}
                            label={isCompleted ? 'Completed' : `${Math.round(progress)}%`}
                            variant={isCompleted ? 'success' : 'primary'}
                            className="my-3"
                            style={{ height: '8px' }}
                        />
                        
                        <div className="d-flex justify-content-between align-items-center small text-secondary">
                            <div className="d-flex align-items-center gap-1">
                                <FiFlag />
                                <span>{delivery.Status}</span>
                            </div>
                            <div className="d-flex align-items-center gap-1">
                                <FiClock />
                                <span>{moment(delivery.Planned_Delivery_Timestamp).format('DD MMM YYYY')}</span>
                            </div>
                            <div className="d-flex align-items-center gap-1">
                                <FiCheckCircle />
                                <span>Step: {delivery.Step_ID}</span>
                            </div>
                        </div>

                        <div className="mt-3">
                            <p
                                onClick={copyToClipboard}
                                className="text-primary small fw-bold"
                                style={{ cursor: "pointer", textDecoration: "underline" }}
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
});


// Main DeliveryList Component
const DeliveryList = () => {
    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [clientFilter, setClientFilter] = useState('All');
    
    // Default sort is Initiated_Timestamp_Desc
    const [dateSort, setDateSort] = useState('Initiated_Timestamp_Desc');

    // Debounce search input
    const debouncedSetSearch = useCallback(debounce(setDebouncedSearch, 300), []);

    useEffect(() => {
        debouncedSetSearch(search);
    }, [search, debouncedSetSearch]);

    // Fetching logic
    const fetchDeliveries = useCallback(async (reset = false) => {
        if (loading) return;
        setLoading(true);
        setError(null);

        const pageToFetch = reset ? 1 : page;
        
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/deliveries?page=${pageToFetch}&limit=20&search=${debouncedSearch}&client=${clientFilter}&dateSort=${dateSort}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            setDeliveries(prevDeliveries => {
                const newDeliveries = reset ? data.deliveries : [...prevDeliveries, ...data.deliveries];
                // Remove duplicates
                const uniqueDeliveries = newDeliveries.filter(
                    (v, i, a) => a.findIndex(t => t.Key === v.Key) === i
                );
                return uniqueDeliveries;
            });

            setHasMore(data.deliveries.length > 0);
            if (reset) setPage(2); // Set page to 2 for next fetch
            else setPage(prevPage => prevPage + 1);

        } catch (error) {
            console.error('Error fetching deliveries:', error);
            setError('Failed to load deliveries.');
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, clientFilter, dateSort, loading]);

    // Effect to fetch deliveries when filters change (resets page/list)
    useEffect(() => {
        fetchDeliveries(true);
    }, [debouncedSearch, clientFilter, dateSort]); // Removed fetchDeliveries from deps

    // Infinite scroll
    useEffect(() => {
        const handleScroll = () => {
            // Check if user is near the bottom of the page
            if (window.innerHeight + document.documentElement.scrollTop + 1 >= document.documentElement.scrollHeight && hasMore && !loading) {
                fetchDeliveries(false); // Fetch next page
            }
        };
        // Use passive event listener for better performance
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loading, hasMore, fetchDeliveries]);

    // Handlers for filter changes
    const handleSearchChange = (e) => {
        setSearch(e.target.value);
    };

    const handleClientChange = (e) => {
        const newClient = e.target.value;
        setClientFilter(newClient);
        // Reset state for new filter (triggers useEffect to call fetchDeliveries(true))
        setPage(1);
        setDeliveries([]);
        setHasMore(true);
    };

    const handleDateSortChange = (newSortValue) => {
        setDateSort(newSortValue);
        // Reset state for new filter (triggers useEffect to call fetchDeliveries(true))
        setPage(1);
        setDeliveries([]);
        setHasMore(true);
    };

    const handleDelete = (deletedKey) => {
        setDeliveries(prev => prev.filter(d => d.Key !== deletedKey));
        notification.success({
            message: 'Delivery Deleted',
            description: 'The delivery has been successfully removed.',
            placement: 'topRight',
        });
    };

    // UseMemo for client filter options
    const clientOptions = useMemo(() => {
        // Collect all client names from currently loaded deliveries
        const clients = new Set(deliveries.map(d => d.Client));
        return ['All', ...Array.from(clients).sort()];
    }, [deliveries]);

    return (
        <Container className="delivery-list-container mt-4">
            <Row className="mb-4 align-items-center">
                <Col md={4} className="mb-2 mb-md-0">
                    <Form.Control
                        type="search"
                        placeholder="Search by ID, Client, or Description..."
                        value={search}
                        onChange={handleSearchChange}
                        className="shadow-sm"
                    />
                </Col>
                <Col md={4} className="mb-2 mb-md-0">
                    {/* FilterDeliveryBasedOnClientSelected is inlined */}
                    <FilterDeliveryBasedOnClientSelected
                        clientFilter={clientFilter}
                        handleClientChange={handleClientChange}
                        clientOptions={clientOptions}
                    />
                </Col>
                <Col md={4}>
                    {/* SortDeliveriesByDate is inlined */}
                    <SortDeliveriesByDate
                        dateSort={dateSort}
                        setDateSort={handleDateSortChange}
                    />
                </Col>
            </Row>

            {error && <p className="text-center text-danger">{error}</p>}
            
            <Row>
                {deliveries.length > 0 ? (
                    deliveries.map((delivery) => (
                        <DeliveryCard
                            key={delivery.Key}
                            delivery={delivery}
                            isAdmin={isAdmin}
                            userEmail={userEmail}
                            handleDelete={handleDelete}
                        />
                    ))
                ) : (
                    !loading && <Col><p className="text-center p-4 bg-light rounded shadow-sm">No deliveries found matching your criteria.</p></Col>
                )}
            </Row>

            <div className="delivery-list-end"></div>

            {loading && (
                <div className="d-flex justify-content-center align-items-center py-5">
                    <FaSpinner
                        className="text-primary"
                        style={{ fontSize: '2.5rem', animation: 'spin 1.5s linear infinite' }}
                    />
                </div>
            )}
            
            {/* Simple CSS for the spinner animation (since we don't have a separate CSS file) */}
            <style jsx="true">{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </Container>
    );
};

export default DeliveryList;
