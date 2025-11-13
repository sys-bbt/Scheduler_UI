import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom'; // FIX: Removed useNavigate
import { Container, Row, Col, Card, ProgressBar, Form, Button } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
import { UserContext } from './UserContext';
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';
import { notification } from 'antd'; // Import notification from antd
import moment from 'moment'; // Import moment for date formatting

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
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

const DeliveryList = () => {
    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState('');
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    const deliveriesPerPage = 10; // Number of items to fetch per page

    // Memoized debounce handler for search term
    const debouncedSetSearchTerm = useMemo(() => debounce(setSearchTerm, 300), []);

    // Function to calculate progress (assuming Total_Tasks and Completed_Tasks are available)
    const calculateProgress = (delivery) => {
        if (!delivery.Total_Tasks || delivery.Total_Tasks === 0) return 0;
        return Math.round((delivery.Completed_Tasks / delivery.Total_Tasks) * 100);
    };

    // Helper to format the Planned Delivery Date (using Planned_Delivery_Timestamp as requested)
    const formatDeliveryDate = (timestamp) => {
        return moment(timestamp).isValid() 
            ? moment(timestamp).format('YYYY-MM-DD HH:mm') 
            : 'N/A';
    };

    // Core data fetching function
    const fetchDeliveries = useCallback(async (pageNumber, currentDeliveries) => {
        setLoading(true);
        setError(null);
        try {
            // Include pagination params in the API call
            const response = await fetch(`${BACKEND_API_BASE_URL}/deliveries?page=${pageNumber}&limit=${deliveriesPerPage}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newDeliveries = await response.json();

            if (newDeliveries.length === 0) {
                setHasMore(false);
            } else {
                // Append new deliveries to the existing list
                setDeliveries([...currentDeliveries, ...newDeliveries]);
            }
        } catch (err) {
            console.error("Failed to fetch deliveries:", err);
            // Only set error if no deliveries were loaded initially
            if (currentDeliveries.length === 0 && pageNumber === 1) {
                 setError("Failed to load deliveries. Please check the backend connection.");
            }
           
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchDeliveries(1, []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    // Infinite scroll logic (Observer)
    useEffect(() => {
        if (!loading && hasMore) {
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setPage(prevPage => prevPage + 1);
                    }
                },
                { threshold: 1.0 }
            );

            const target = document.querySelector('.delivery-list-end');
            if (target) {
                observer.observe(target);
            }

            return () => {
                if (target) {
                    observer.unobserve(target);
                }
            };
        }
    }, [loading, hasMore]); // Re-run when loading status or hasMore changes

    // Fetch next page when 'page' state updates
    useEffect(() => {
        if (page > 1) {
            fetchDeliveries(page, deliveries);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]); // Dependency on page and the initial delivery list

    // Handle search input change
    const handleSearchChange = (e) => {
        // Use the debounced setter
        debouncedSetSearchTerm(e.target.value);
    };

    // Memoize the filtered, searched, and sorted list for performance (Optimization #4)
    const filteredAndSortedDeliveries = useMemo(() => {
        let result = deliveries;

        // 1. Client Filter
        if (selectedClient) {
            result = result.filter(delivery => delivery.Client === selectedClient);
        }

        // 2. Search Filter (by DelCode_w_o__ or Description)
        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            result = result.filter(delivery => 
                delivery.DelCode_w_o__?.toLowerCase().includes(lowerCaseSearchTerm) ||
                delivery.Description?.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }

        // 3. Sorting by Initiated_Timestamp Descending (Requirement #5)
        // Note: Assumes Initiated_Timestamp is a date string that moment.js can parse
        result.sort((a, b) => {
            const dateA = moment(a.Initiated_Timestamp);
            const dateB = moment(b.Initiated_Timestamp);

            if (dateA.isValid() && dateB.isValid()) {
                // Descending order (latest first)
                if (dateA.isBefore(dateB)) return 1;
                if (dateA.isAfter(dateB)) return -1;
            } else if (dateA.isValid()) {
                // Keep valid dates before invalid ones
                return -1; 
            } else if (dateB.isValid()) {
                return 1;
            }
            return 0;
        });

        return result;
    }, [deliveries, selectedClient, searchTerm]);


    if (error && deliveries.length === 0) {
        return (
            <Container className="mt-5">
                <Alert variant="danger">{error}</Alert>
            </Container>
        );
    }
    
    // Extract unique clients for the filter dropdown
    const uniqueClients = useMemo(() => {
        const clients = deliveries.map(d => d.Client).filter(Boolean);
        return [...new Set(clients)];
    }, [deliveries]);

    return (
        <Container className="delivery-list-container mt-4">
            <h1 className="mb-4 text-center">Active Deliveries</h1>
            
            <Row className="mb-4 align-items-center">
                <Col md={6} className="mb-3 mb-md-0">
                    {/* Search Input */}
                    <Form.Control
                        type="text"
                        placeholder="Search by Delivery Code or Description"
                        onChange={handleSearchChange}
                        // Note: Using a separate state for display would be better, but we stick to the provided structure
                        // For performance, the debounce applies to the final searchTerm state
                    />
                </Col>
                <Col md={4} className="mb-3 mb-md-0">
                    {/* Client Filter */}
                    <FilterDeliveryBasedOnClientSelected 
                        clients={uniqueClients} 
                        selectedClient={selectedClient} 
                        setSelectedClient={setSelectedClient} 
                    />
                </Col>
                <Col md={2} className="d-flex justify-content-end">
                    {/* Placeholder for Sort Component if needed, currently sorting is done via useMemo */}
                    {/* <SortDeliveriesByDate /> */}
                </Col>
            </Row>

            <Row xs={1} md={2} lg={3} className="g-4">
                {filteredAndSortedDeliveries.length > 0 ? (
                    filteredAndSortedDeliveries.map((delivery) => {
                        const progress = calculateProgress(delivery);
                        const deliveryDate = formatDeliveryDate(delivery.Planned_Delivery_Timestamp);

                        return (
                            <Col key={delivery.Key}>
                                <Link 
                                    to={`/delivery/${delivery.DelCode_w_o__}`} 
                                    state={{ deliveryId: delivery.Key }} 
                                    style={{ textDecoration: 'none' }}
                                >
                                    <Card className="shadow-sm h-100 delivery-card hover-effect">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <Card.Title className="text-primary mb-0">{delivery.Client}</Card.Title>
                                                {isAdmin && (
                                                    <DeleteButton deliveryKey={delivery.Key} onDelete={(deletedKey) => setDeliveries(d => d.filter(item => item.Key !== deletedKey))} />
                                                )}
                                            </div>

                                            <Card.Subtitle className="mb-3 text-muted">
                                                <FiClock className="me-1" /> Planned End: {deliveryDate}
                                            </Card.Subtitle>

                                            <div className="progress-section mb-3">
                                                <div className="d-flex justify-content-between">
                                                    <small className="text-muted">Progress</small>
                                                    <small className="fw-bold">{progress}%</small>
                                                </div>
                                                <ProgressBar now={progress} variant={progress === 100 ? 'success' : 'info'} style={{ height: '8px' }} />
                                            </div>

                                            <Card.Text className="text-dark">
                                                {delivery.Description?.length > 100 
                                                    ? `${delivery.Description.substring(0, 100)}...` 
                                                    : delivery.Description}
                                            </Card.Text>

                                            <div className="mt-3">
                                                <small className="text-secondary d-block">Delivery Code</small>
                                                <p
                                                    className="fw-bold mb-0"
                                                    onClick={(e) => {
                                                        e.preventDefault(); // Prevent link navigation on click
                                                        navigator.clipboard.writeText(delivery.DelCode_w_o__);
                                                        notification.success({
                                                            message: 'Copied!',
                                                            description: `Delivery code ${delivery.DelCode_w_o__} copied to clipboard.`,
                                                            duration: 2,
                                                        });
                                                    }}
                                                    style={{ cursor: "pointer", color: "#007bff", textDecoration: "underline" }}
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

            <div className="delivery-list-end" style={{ height: '1px' }}></div> {/* Sentinel for infinite scroll */}

            {/* Show spinner only if actively loading and it's not the initial load */}
            {loading && deliveries.length > 0 && hasMore && ( 
                <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
                    <FaSpinner
                        className="spinner-icon"
                        style={{ fontSize: '2rem', color: '#007bff', animation: 'spin 1s linear infinite' }}
                    />
                </div>
            )}
            
             {/* Show spinner only if it is the initial load */}
            {loading && deliveries.length === 0 && ( 
                <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
                    <FaSpinner
                        className="spinner-icon"
                        style={{ fontSize: '2rem', color: '#007bff', animation: 'spin 1s linear infinite' }}
                    />
                </div>
            )}

            {!hasMore && deliveries.length > 0 && (
                <p className="text-center mt-4 text-muted">You have reached the end of the list.</p>
            )}
        </Container>
    );
};

export default DeliveryList;
