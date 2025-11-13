import React, { useState, useEffect, useCallback, useContext, useMemo, memo } from 'react';
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
            return 'status-completed';
        case 'In-Progress':
            return 'status-in-progress';
        case 'On-Hold':
            return 'status-on-hold';
        default:
            return 'status-not-started';
    }
};

/**
 * REQ 4: Memoized DeliveryCard Component
 * This component is wrapped in React.memo to prevent unnecessary re-renders.
 */
const DeliveryCard = memo(({ delivery, isAdmin, userEmail, handleDelete }) => {
    const progress = delivery.progress || 0;
    const isCompleted = delivery.Status === 'Completed';

    const copyToClipboard = (e) => {
        e.preventDefault(); // Prevent navigation
        navigator.clipboard.writeText(delivery.DelCode_w_o__)
            .then(() => {
                notification.success({
                    message: 'Copied to Clipboard',
                    description: `${delivery.DelCode_w_o__} copied.`,
                    placement: 'topRight',
                });
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                notification.error({
                    message: 'Copy Failed',
                    description: 'Could not copy text to clipboard.',
                    placement: 'topRight',
                });
            });
    };

    return (
        <Col md={6} lg={4} className="mb-4">
            <Link
                to={`/delivery/${delivery.DelCode_w_o__}`}
                state={{ delivery }}
                className="delivery-link"
            >
                <Card className={`delivery-card h-100 ${getCardClass(delivery.Status)}`}>
                    <Card.Body>
                        <Row>
                            <Col>
                                <Card.Title className="h6">{delivery.Client}</Card.Title>
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
                            label={isCompleted ? 'Completed' : `${progress}%`}
                            variant={isCompleted ? 'success' : 'primary'}
                            className="mb-3"
                        />
                        
                        <div className="delivery-details">
                            <div className="detail-item">
                                <FiFlag className="icon" />
                                <span>{delivery.Status}</span>
                            </div>
                            <div className="detail-item">
                                <FiClock className="icon" />
                                <span>{moment(delivery.Planned_Delivery_Timestamp).format('DD MMM YYYY')}</span>
                            </div>
                            <div className="detail-item">
                                <FiCheckCircle className="icon" />
                                <span>{delivery.Step_ID}</span>
                            </div>
                        </div>

                        <div className="delivery-code-container">
                            <p
                                onClick={copyToClipboard}
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
    
    // REQ 5: Ensure default sort is Initiated_Timestamp_Desc
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

    // Effect to fetch deliveries when filters change
    useEffect(() => {
        // Reset and fetch
        fetchDeliveries(true);
    }, [debouncedSearch, clientFilter, dateSort]); // Removed fetchDeliveries from deps

    // Infinite scroll
    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + document.documentElement.scrollTop + 1 >= document.documentElement.scrollHeight && hasMore && !loading) {
                fetchDeliveries(false); // Fetch next page
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loading, hasMore, fetchDeliveries]);

    // Handlers for filter changes
    const handleSearchChange = (e) => {
        setSearch(e.target.value);
    };

    const handleClientChange = (e) => {
        const newClient = e.target.value;
        setClientFilter(newClient);
        // Reset state for new filter
        setPage(1);
        setDeliveries([]);
        setHasMore(true);
    };

    const handleDateSortChange = (newSortValue) => {
        setDateSort(newSortValue);
        // Reset state for new filter
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
        const clients = new Set(deliveries.map(d => d.Client));
        return ['All', ...Array.from(clients)];
    }, [deliveries]);

    return (
        <Container className="delivery-list-container mt-4">
            <Row className="mb-3 align-items-center">
                <Col md={4}>
                    <Form.Control
                        type="search"
                        placeholder="Search by ID, Client, or Description..."
                        value={search}
                        onChange={handleSearchChange}
                    />
                </Col>
                <Col md={4}>
                    <FilterDeliveryBasedOnClientSelected
                        clientFilter={clientFilter}
                        handleClientChange={handleClientChange}
                        clientOptions={clientOptions}
                    />
                </Col>
                <Col md={4}>
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
                    !loading && <Col><p className="text-center">No deliveries found matching your criteria.</p></Col>
                )}
            </Row>

            <div className="delivery-list-end"></div>

            {loading && (
                <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
                    <FaSpinner
                        className="spinner-icon"
                        style={{ fontSize: '2rem', color: '#007bff', animation: 'spin 1.5s linear infinite' }}
                    />
                </div>
            )}
        </Container>
    );
};

export default DeliveryList;
