import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, ProgressBar, Form, Button } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
import { UserContext } from './UserContext'; // Ensure this path is correct
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';
import { notification } from 'antd'; // Import notification from antd

// Use process.env for backend URL, with a fallback to the Render URL (not localhost)
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://server-ui-2.onrender.com';

// Define admin emails on the frontend (for context if needed, but isAdmin comes from context now)
const ADMIN_EMAILS_FRONTEND = [
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
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
    // Get userEmail, authToken, isAdmin, logoutUser from UserContext
    // This is the correct way to get authentication and admin status
    const { userEmail, authToken, isAdmin, logoutUser } = useContext(UserContext);
    const navigate = useNavigate();

    const [deliveries, setDeliveries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [selectedClient, setSelectedClient] = useState('');
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true); // Maintain hasMore for infinite scroll control
    const observer = useRef(null);
    const [sortOption, setSortOption] = useState('earliest');
    const [totalFilteredDeliveries, setTotalFilteredDeliveries] = useState(0); // State for total count

    // isAdmin is now directly from UserContext, so the local derivation is removed.
    console.log(`DeliveryList: Current User Email: ${userEmail}, Is Admin: ${isAdmin}`);


    // Memoize handleSort to ensure stable function reference
    const handleSort = useCallback((deliveriesToSort) => {
        return [...deliveriesToSort].sort((a, b) => { // Create a shallow copy to avoid direct mutation
            // Using initiatedTimestampRaw for sorting, handling potential nested 'value'
            const dateA = new Date(a.initiatedTimestampRaw?.value || a.initiatedTimestampRaw);
            const dateB = new Date(b.initiatedTimestampRaw?.value || b.initiatedTimestampRaw);

            const isValidDateA = !isNaN(dateA.getTime());
            const isValidDateB = !isNaN(dateB.getTime());

            if (!isValidDateA && !isValidDateB) return 0;
            if (!isValidDateA) return 1; // Put invalid date at end
            if (!isValidDateB) return -1; // Put invalid date at end

            return sortOption === 'earliest' ? dateA - dateB : dateB - dateA;
        });
    }, [sortOption]); // Dependencies for useCallback: re-create when sortOption changes


    const handleClientSelect = (client) => {
        setSelectedClient(client);
        setDeliveries([]); // Reset deliveries to fetch new filtered set
        setPage(0); // Reset page for new filter
        setHasMore(true); // Assume more data for new filter
        setTotalFilteredDeliveries(0); // Reset count
    };

    // Corrected fetchData dependencies and added console.logs for data inspection
    const fetchData = useCallback(
        async (currentPage, searchQuery, clientFilter) => { // Removed isInitialLoad param, managed by useEffect
            // Check for authentication tokens before making the fetch call
            if (!userEmail || !authToken) {
                setLoading(false);
                console.log("DeliveryList: Skipping fetchData because userEmail or authToken is not available yet.");
                return;
            }

            // If no more data is expected and it's not the first page, stop
            // This prevents redundant fetches when hasMore is false
            if (!hasMore && currentPage > 0) {
                setLoading(false);
                console.log("DeliveryList: No more data to load (hasMore is false) and not on first page.");
                return;
            }

            setLoading(true);
            console.log(`DeliveryList: Fetching data for page ${currentPage} with email: ${userEmail}, isAdmin: ${isAdmin}, Search: "${searchQuery}", Client: "${clientFilter}"`);

            const limit = 500; // Hardcoded limit for fetching data in chunks
            const currentOffset = currentPage * limit;

            try {
                // Construct query parameters
                const queryParams = new URLSearchParams({
                    email: userEmail,
                    offset: currentOffset,
                    limit: limit,
                    // isAdmin is passed as a param, though frontend derivation might not be fully secure for backend decisions
                    isAdmin: isAdmin, // Ensure backend handles this flag securely
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

                // --- IMPORTANT DEBUGGING LOGS START ---
                console.log("DEBUG: Raw data received from backend:", data);

                // Assuming data could be an object with values as arrays, flatten it first
                const tasksArray = Object.values(data).flat();
                console.log("DEBUG: Flattened tasksArray:", tasksArray);

                // Filter for deliveries with Step_ID === 0 as per your old logic
                const deliveriesForList = tasksArray.filter((delivery) => delivery.Step_ID === 0);
                console.log(`DeliveryList: Aggregated to ${deliveriesForList.length} unique deliveries for page ${currentPage}.`);


                if (deliveriesForList.length > 0) {
                    const firstItem = deliveriesForList[0]; // Check the first filtered item
                    console.log("DEBUG: First FILTERED item's DelCode_w_o__:", firstItem.DelCode_w_o__);
                    console.log("DEBUG: First FILTERED item's Client:", firstItem.Client);
                    console.log("DEBUG: First FILTERED item's Initiated_Timestamp:", firstItem.Initiated_Timestamp);
                    console.log("DEBUG: First FILTERED item's Planned_Delivery_Timestamp:", firstItem.Planned_Delivery_Timestamp);
                    console.log("DEBUG: First FILTERED item's Planned_Tasks:", firstItem.Planned_Tasks);
                    console.log("DEBUG: First FILTERED item's Total_Tasks:", firstItem.Total_Tasks);
                    console.log("DEBUG: First FILTERED item's Step_ID:", firstItem.Step_ID);
                    console.log("DEBUG: First FILTERED item's Short_Description:", firstItem.Short_Description);
                } else {
                    console.log("DEBUG: No filtered deliveries received or array is empty.");
                }
                // --- IMPORTANT DEBUGGING LOGS END ---

                const newDeliveries = deliveriesForList.map((delivery) => ({
                    delCode: delivery.DelCode_w_o__, // Assuming DelCode_w_o__ is directly accessible
                    client: `${delivery.Client}`, // Convert Client to string explicitly
                    initiated: formatTimestamp(delivery.Initiated_Timestamp),
                    initiatedTimestampRaw: delivery.Initiated_Timestamp, // Store raw timestamp for sorting/calculation
                    deadline: calculateDeadline(delivery.Planned_Delivery_Timestamp), // Pass only delivery timestamp
                    tasksPlanned: delivery.Planned_Tasks || 0, // Default to 0 if null/undefined
                    tasksTotal: delivery.Total_Tasks || 0,     // Default to 0 if null/undefined
                    createdAt: delivery.createdAt || delivery.Created_at,
                    stepId: delivery.Step_ID, // Assuming Step_ID is directly accessible
                    shortDescription: delivery.Short_Description, // Assuming Short_Description is directly accessible
                }));

                setDeliveries((prev) => {
                    let combinedDeliveries;
                    if (currentPage === 0) {
                        combinedDeliveries = newDeliveries;
                    } else {
                        // Filter out duplicates based on delCode
                        const newUniqueDeliveries = newDeliveries.filter(
                            (newDel) => !prev.some((prevDel) => prevDel.delCode === newDel.delCode)
                        );
                        combinedDeliveries = [...prev, ...newUniqueDeliveries];
                    }
                    const sortedCombinedDeliveries = handleSort(combinedDeliveries);
                    setTotalFilteredDeliveries(sortedCombinedDeliveries.length); // Update total count
                    return sortedCombinedDeliveries;
                });

                // Update hasMore based on the limit
                setHasMore(deliveriesForList.length === limit);

            } catch (error) {
                console.error('Error fetching data in DeliveryList:', error);
                notification.error({
                    message: 'Data Fetch Error',
                    description: `Failed to load deliveries: ${error.message}. Please try again.`,
                });
                setHasMore(false); // Stop trying to load more if there's an error
            } finally {
                setLoading(false);
            }
        },
        [userEmail, authToken, isAdmin, handleSort, hasMore] // hasMore is a dependency for useCallback's logic
    );

    const handleDelete = (deliveryCode) => {
        setDeliveries(prevDeliveries => prevDeliveries.filter(delivery => delivery.delCode !== deliveryCode));
    };

    // Effect to trigger initial data fetch and when search/filter criteria change
    useEffect(() => {
        if (userEmail && authToken) {
            console.log("DeliveryList: Triggering INITIAL/FILTERING fetchData with new criteria.");
            setDeliveries([]);     // Clear previous deliveries
            setPage(0);            // Reset page to 0 for a fresh fetch
            setHasMore(true);      // Assume there's more data for a new search/filter
            setTotalFilteredDeliveries(0); // Reset total count
            fetchData(0, debouncedSearchTerm, selectedClient);
        } else if (!userEmail && !authToken && !loading) {
            setLoading(false);
            // Optionally, navigate to login if not authenticated and not already trying to load
            // navigate('/login');
        }
    // IMPORTANT: fetchData is stable due to useCallback.
    // The relevant dependencies for THIS useEffect are userEmail, authToken, search/filter terms.
    }, [userEmail, authToken, debouncedSearchTerm, selectedClient, fetchData]);


    // Effect for subsequent pages (infinite scroll) - only triggered by page state change
    useEffect(() => {
        if (page > 0 && !loading && hasMore && userEmail && authToken) {
            console.log(`DeliveryList: Triggering infinite scroll fetchData for page ${page}.`);
            fetchData(page, debouncedSearchTerm, selectedClient);
        }
    }, [page, fetchData, debouncedSearchTerm, selectedClient, loading, hasMore, userEmail, authToken]);


    // Debounce the searchTerm update
    const debouncedSetSearchTerm = useCallback(
        debounce((value) => {
            setDebouncedSearchTerm(value);
            // These resets will cause the main fetchData useEffect to run
        }, 500), // 500ms debounce delay
        []
    );

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearchTerm(value); // Update instant search term for input field
        debouncedSetSearchTerm(value); // Update debounced search term
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'No start time';
        // Handle potentially nested { value: "..." } structure for timestamp
        const date = new Date(timestamp?.value || timestamp);
        return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
    };

    // Updated calculateDeadline as per your "old" script (removes startTimestamp param)
    const calculateDeadline = (deliveryTimestamp) => {
        if (!deliveryTimestamp) return 'No deadline';

        const deliveryTime = new Date(deliveryTimestamp?.value || deliveryTimestamp);
        const currentTime = new Date(); // Use current date and time

        if (isNaN(deliveryTime.getTime()) || isNaN(currentTime.getTime())) return 'Invalid deadline';

        const timeDiff = deliveryTime - currentTime; // Difference from current time

        if (timeDiff <= 0) {
            return 'Past Deadline';
        }

        const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        // const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60)); // Optionally add minutes

        return `${daysLeft} days ${hoursLeft} hrs left`;
    };

    // Intersection Observer for infinite scrolling (REFINED LOGIC)
    useEffect(() => {
        if (observer.current) observer.current.disconnect(); // Disconnect previous observer instance

        // Create a new observer only if there's potentially more data to load
        // and we're not currently loading
        if (hasMore && !loading) {
            const loadMoreDeliveries = (entries) => {
                const [entry] = entries;
                // Only load more if intersecting, not already loading, and there's more data
                if (entry.isIntersecting && !loading && hasMore) {
                    console.log("Intersection Observer: Element is intersecting, setting next page.");
                    setPage((prevPage) => prevPage + 1);
                }
            };

            observer.current = new IntersectionObserver(loadMoreDeliveries, { threshold: 1.0 });

            const lastDeliveryElement = document.querySelector('.delivery-list-end');
            if (lastDeliveryElement) {
                console.log("Intersection Observer: Observing .delivery-list-end");
                observer.current.observe(lastDeliveryElement);
            } else {
                console.log("Intersection Observer: .delivery-list-end element not found.");
            }
        } else {
            console.log(`Intersection Observer: Not observing. hasMore: ${hasMore}, loading: ${loading}`);
        }

        // Cleanup function: disconnect observer when component unmounts or dependencies change
        return () => {
            if (observer.current) {
                console.log("Intersection Observer: Disconnecting observer on cleanup.");
                observer.current.disconnect();
            }
        };
    }, [loading, hasMore]); // Dependencies: re-create observer if loading or hasMore changes


    // Re-sorts the displayed deliveries when sortOption changes
    useEffect(() => {
        if (deliveries.length > 0 && !loading) {
            // Create a shallow copy to ensure React detects a state change and re-renders
            setDeliveries((currentDeliveries) => handleSort([...currentDeliveries]));
        }
    }, [sortOption, loading, handleSort]); // Added loading as a dependency


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

    // --- Conditional Rendering for different states ---
    // Show spinner only if loading AND no deliveries fetched yet AND no search/filter applied
    if (loading && deliveries.length === 0 && !debouncedSearchTerm && !selectedClient && page === 0) {
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

    // No active deliveries found (after loading, with no search/filter)
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

    // No deliveries match search/filter criteria
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
                    setTotalFilteredDeliveries(0);
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

            <p>You have {totalFilteredDeliveries} active deliveries (showing unique workflows)</p>

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
