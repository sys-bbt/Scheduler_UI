import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, ProgressBar, Form, Button } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
import { UserContext } from './UserContext';
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';
import { notification } from 'antd';

const BACKEND_API_BASE_URL = 'https://server-ui-2.onrender.com';

const ADMIN_EMAILS_FRONTEND = [
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

const DeliveryList = () => {
    const { userEmail, authToken, isAdmin: contextIsAdmin, logoutUser } = useContext(UserContext); // Get isAdmin from context
    const navigate = useNavigate();
    const [deliveries, setDeliveries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [selectedClient, setSelectedClient] = useState('');
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef(null);
    const [sortOption, setSortOption] = useState('earliest');

    // Use the isAdmin from context. If not available yet, default to false.
    const isAdmin = contextIsAdmin || false;
    console.log(`DeliveryList: Current User Email: ${userEmail}, Is Admin: ${isAdmin}`);

    const handleSort = useCallback((deliveriesToSort) => {
        return [...deliveriesToSort].sort((a, b) => {
            const dateA = new Date(a.initiatedTimestampRaw?.value || a.initiatedTimestampRaw);
            const dateB = new Date(b.initiatedTimestampRaw?.value || b.initiatedTimestampRaw);

            const isValidDateA = !isNaN(dateA.getTime());
            const isValidDateB = !isNaN(dateB.getTime());

            if (!isValidDateA && !isValidDateB) return 0;
            if (!isValidDateA) return 1;
            if (!isValidDateB) return -1;

            return sortOption === 'earliest' ? dateA - dateB : dateB - dateA;
        });
    }, [sortOption]);

    const handleClientSelect = (client) => {
        setSelectedClient(client);
        setDeliveries([]);
        setPage(0);
        setHasMore(true);
    };

    // Corrected fetchData dependencies
    const fetchData = useCallback(
        async (currentPage, searchQuery, clientFilter) => {
            // No need to check !authToken or !userEmail here,
            // as the calling useEffect will handle it.
            // Also, hasMore check is redundant here, as the caller (useEffect)
            // will only trigger if hasMore is true.

            setLoading(true);
            console.log(`DeliveryList: Fetching data for page ${currentPage} with email: ${userEmail}, isAdmin: ${isAdmin}, Search: "${searchQuery}", Client: "${clientFilter}"`);

            const limit = 500;
            const currentOffset = currentPage * limit;

            try {
                const queryParams = new URLSearchParams({
                    email: userEmail,
                    offset: currentOffset,
                    limit: limit,
                });

                if (searchQuery) {
                    queryParams.append('searchTerm', searchQuery);
                }
                if (clientFilter) {
                    queryParams.append('selectedClient', clientFilter);
                }

                const response = await fetch(`${BACKEND_API_BASE_URL}/api/data?${queryParams.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
                }

                const data = await response.json();

                const uniqueDeliveriesMap = new Map();
                data.forEach(delivery => {
                    const delCode = (delivery.DelCode_w_o__?.value || delivery.DelCode_w_o__);
                    if (!uniqueDeliveriesMap.has(delCode)) {
                        uniqueDeliveriesMap.set(delCode, delivery);
                    } else if (delivery.Step_ID === 0) {
                         uniqueDeliveriesMap.set(delCode, delivery);
                    }
                });

                const deliveriesForList = Array.from(uniqueDeliveriesMap.values());
                console.log(`DeliveryList: Fetched ${deliveriesForList.length} unique deliveries for page ${currentPage}.`);

                setDeliveries((prev) => {
                    let combinedDeliveries;
                    if (currentPage === 0) {
                        combinedDeliveries = deliveriesForList;
                    } else {
                        const newUniqueDeliveries = deliveriesForList.filter(
                            (newDel) => !prev.some((prevDel) => prevDel.delCode === newDel.delCode)
                        );
                        combinedDeliveries = [...prev, ...newUniqueDeliveries];
                    }
                    const sortedCombinedDeliveries = handleSort(combinedDeliveries);
                    return sortedCombinedDeliveries;
                });

                setHasMore(deliveriesForList.length === limit);

            } catch (error) {
                console.error('Error fetching data in DeliveryList:', error);
                notification.error({
                    message: 'Data Fetch Error',
                    description: `Failed to load deliveries: ${error.message}. Please try again.`,
                });
                setHasMore(false);
            } finally {
                setLoading(false);
            }
        },
        [userEmail, authToken, isAdmin, handleSort] // Removed 'hasMore' from fetchData's dependencies
    );

    const handleDelete = (deliveryCode) => {
        setDeliveries(prevDeliveries => prevDeliveries.filter(delivery => delivery.delCode !== deliveryCode));
    };

    // Effect for INITIAL data fetch and when search/filter criteria change
    useEffect(() => {
        // Only proceed if userEmail and authToken are available
        if (userEmail && authToken) {
            console.log("DeliveryList: Triggering INITIAL/FILTERING fetchData with new criteria.");
            setDeliveries([]);     // Clear previous deliveries
            setPage(0);            // Reset page to 0 for a fresh fetch
            setHasMore(true);      // Assume there's more data for a new search/filter
            // Call fetchData directly, as it's stable because of useCallback
            fetchData(0, debouncedSearchTerm, selectedClient);
        } else if (!userEmail) { // If userEmail is not there, means not logged in
             setLoading(false); // Stop loading, as we can't fetch without userEmail
             // navigate('/login'); // Optionally redirect to login if no userEmail
        }
    }, [userEmail, authToken, debouncedSearchTerm, selectedClient, fetchData]); // REMOVED `fetchData` from the dependencies, it's now fine because the `useCallback` version is stable.

    // Effect for subsequent pages (infinite scroll) - only triggered by page state change
    useEffect(() => {
        if (page > 0 && !loading && hasMore && userEmail && authToken) { // Added userEmail & authToken check
            console.log(`DeliveryList: Triggering infinite scroll fetchData for page ${page}.`);
            fetchData(page, debouncedSearchTerm, selectedClient);
        }
    }, [page, fetchData, debouncedSearchTerm, selectedClient, loading, hasMore, userEmail, authToken]); // Added userEmail & authToken

    const debouncedSetSearchTerm = useCallback(
        debounce((value) => {
            setDebouncedSearchTerm(value);
        }, 500),
        []
    );

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearchTerm(value);
        debouncedSetSearchTerm(value);
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'No start time';
        const date = new Date(timestamp?.value || timestamp);
        return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
    };

    const calculateDeadline = (deliveryTimestamp) => {
        if (!deliveryTimestamp) return 'No deadline';
        const deliveryTime = new Date(deliveryTimestamp?.value || deliveryTimestamp);
        const currentTime = new Date();
        if (isNaN(deliveryTime.getTime()) || isNaN(currentTime.getTime())) return 'Invalid deadline';
        const timeDiff = deliveryTime - currentTime;
        if (timeDiff <= 0) {
            return 'Past Deadline';
        }
        const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${daysLeft} days ${hoursLeft} hrs left`;
    };

    // Intersection Observer for infinite scrolling
    useEffect(() => {
        if (observer.current) observer.current.disconnect();

        const loadMoreDeliveries = (entries) => {
            const [entry] = entries;
            // Only load more if intersecting, not loading, and hasMore data
            if (entry.isIntersecting && !loading && hasMore) {
                setPage((prevPage) => prevPage + 1);
            }
        };

        observer.current = new IntersectionObserver(loadMoreDeliveries, { threshold: 1.0 });

        const lastDeliveryElement = document.querySelector('.delivery-list-end');
        if (lastDeliveryElement) observer.current.observe(lastDeliveryElement);

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [loading, hasMore]); // Dependencies: re-create observer if loading or hasMore changes

    // Re-sorts the displayed deliveries when sortOption changes
    useEffect(() => {
        if (deliveries.length > 0 && !loading) {
            setDeliveries((currentDeliveries) => handleSort([...currentDeliveries]));
        }
    }, [sortOption, loading, handleSort]);

    const uniqueClients = [...new Set(deliveries.map((delivery) => delivery.client))]
        .filter(client => client)
        .map(client => client.toLowerCase())
        .filter((value, index, self) => self.indexOf(value) === index)
        .sort()
        .map(client => client.charAt(0).toUpperCase() + client.slice(1));

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
    };

    if (loading && deliveries.length === 0) {
        return (
            <Container className="text-center my-5">
                <FaSpinner
                    className="spinner-icon"
                    style={{ fontSize: '3rem', color: '#007bff', animation: 'spin 1s linear infinite' }}
                />
                <p className="mt-3">Loading deliveries...</p>
            </Container>
        );
    }

    if (!loading && deliveries.length === 0 && !debouncedSearchTerm && !selectedClient) {
        return (
            <Container className="text-center my-5">
                <p>No active deliveries found for your account.</p>
                <Button variant="outline-primary" onClick={handleLogout}>
                    Logout
                </Button>
            </Container>
        );
    }

    if (!loading && deliveries.length === 0 && (debouncedSearchTerm || selectedClient)) {
        return (
            <Container className="text-center my-5">
                <p>No deliveries match your current search/filter criteria.</p>
                <Button variant="outline-secondary" onClick={() => {
                    setSearchTerm('');
                    setDebouncedSearchTerm('');
                    setSelectedClient('');
                    setDeliveries([]);
                    setPage(0);
                    setHasMore(true);
                }}>
                    Clear Search/Filters
                </Button>
                <Button variant="outline-danger" onClick={handleLogout} className="ml-2">
                    Logout
                </Button>
            </Container>
        );
    }

    return (
        <Container>
            <Row className="justify-content-between align-items-center my-4">
                <Col>
                    <h1 className="mb-0">List of Deliveries</h1>
                </Col>
                <Col xs="auto">
                    {userEmail && (
                        <span className="text-muted mr-2">Logged in as: {userEmail}</span>
                    )}
                    <Button variant="outline-danger" onClick={handleLogout}>
                        Logout
                    </Button>
                </Col>
            </Row>
            <Row className="mb-4">
                <Col xs={10}>
                    <Form.Control
                        type="text"
                        placeholder="Search for delivery code or client..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
                </Col>
                <Col xs={2} className="text-right">
                    <span role="img" aria-label="filter" style={{ fontSize: '1.5rem', cursor: 'pointer' }}>
                        🔍
                    </span>
                </Col>
                <Col xs={2} className="text-right">
                    <FilterDeliveryBasedOnClientSelected
                        clients={uniqueClients}
                        onClientSelect={handleClientSelect}
                        selectedClient={selectedClient}
                    />
                </Col>
                <Col xs={12}>
                    <SortDeliveriesByDate sortOption={sortOption} setSortOption={setSortOption} />
                </Col>
            </Row>

            <p>You have {deliveries.length} active deliveries (showing unique workflows)</p>

            <Row>
                {deliveries.map((delivery) => {
                    const progress =
                        delivery.tasksTotal === 0 ? 0 : (delivery.tasksPlanned / delivery.tasksTotal) * 100;

                    return (
                        <Col xs={12} key={delivery.delCode} className="mb-3">
                            <Link to={`/delivery/data/${delivery.delCode}`} className="card-link-wrapper">
                                <Card className="p-3 shadow-sm task-card">
                                    <div className="shaded-bg" style={{ width: `${progress}%` }}></div>
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <div className="d-flex align-items-center mb-2">
                                                    <FiCheckCircle style={{ marginRight: '8px', color: 'green' }} />
                                                    <span
                                                        className="font-weight-bold"
                                                        style={{ fontSize: '1.5rem' }}
                                                    >
                                                        {delivery.tasksPlanned} of {delivery.tasksTotal} Planned
                                                    </span>
                                                    {isAdmin && <DeleteButton deliveryCode={delivery.delCode} onDelete={handleDelete} />}
                                                </div>
                                                {delivery.client && (
                                                    <p className="mb-1 text-muted">
                                                        Client: {delivery.client}
                                                    </p>
                                                )}
                                                {delivery.shortDescription && (
                                                    <p className="mb-1 text-muted">
                                                        Description: {delivery.shortDescription}
                                                    </p>
                                                )}
                                                <p className="mb-1 text-muted">
                                                    Current Step: {delivery.stepId}
                                                </p>
                                                <div className="mb-2">
                                                    <ProgressBar
                                                        now={progress}
                                                        variant={progress > 50 ? 'success' : progress > 20 ? 'warning' : 'danger'}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="mb-1 text-muted">
                                                    <FiClock style={{ marginRight: '5px' }} /> {formatTimestamp(delivery.initiatedTimestampRaw)}
                                                </p>
                                                <p className="mb-0 text-danger">
                                                    <FiFlag style={{ marginRight: '5px' }} /> {delivery.deadline}
                                                </p>
                                                <p
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const el = document.createElement('textarea');
                                                        el.value = delivery.delCode;
                                                        document.body.appendChild(el);
                                                        el.select();
                                                        document.execCommand('copy');
                                                        document.body.removeChild(el);
                                                    }}
                                                    style={{ cursor: "pointer", color: "blue", textDecoration: "underline" }}
                                                    title="Click to copy"
                                                >
                                                    {delivery.delCode}
                                                </p>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Link>
                        </Col>
                    );
                })}
            </Row>

            <div className="delivery-list-end"></div>

            {loading && deliveries.length > 0 && hasMore && (
                <div className="d-flex justify-content-center align-items-center my-3" style={{ height: '100px' }}>
                    <FaSpinner
                        className="spinner-icon"
                        style={{ fontSize: '2rem', color: '#007bff', animation: 'spin 1s linear infinite' }}
                    />
                    <p className="ms-2">Loading more deliveries...</p>
                </div>
            )}
            {!hasMore && deliveries.length > 0 && (
                <p className="text-center my-3 text-muted">You've reached the end of the list.</p>
            )}
        </Container>
    );
};

export default DeliveryList;
