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
import { notification } from 'antd'; // Import notification from antd

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Define admin emails on the frontend, matching the backend
const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
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
  const { userEmail, logoutUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // New state for debounced search term
  const [authToken, setAuthToken] = useState(null);
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(true);
  const observer = useRef(null);
  const [sortOption, setSortOption] = useState('earliest');
  const [totalFilteredDeliveries, setTotalFilteredDeliveries] = useState(0); // To store the total count from backend

  // Determine isAdmin status for the current user
  const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);
  console.log(`DeliveryList: Current User Email: ${userEmail}, Is Admin: ${isAdmin}`);


  // Memoize handleSort to ensure stable function reference
  const handleSort = useCallback((deliveriesToSort) => {
    return [...deliveriesToSort].sort((a, b) => { // Create a shallow copy to avoid direct mutation
      // Now using initiatedTimestampRaw for sorting
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
    setTotalFilteredDeliveries(0); // Reset count
  };

  // Modified fetchData to accept search and client parameters
  const fetchData = useCallback(
    async (currentPage, searchQuery, clientFilter, isInitialLoad = false) => {
      if (!authToken || !userEmail) {
        setLoading(false);
        console.log("DeliveryList: Skipping fetchData because userEmail or authToken is not available yet.");
        return;
      }

      try {
        setLoading(true);
        console.log(`DeliveryList: Fetching data for page ${currentPage} with email: ${userEmail}, isAdmin: ${isAdmin}, Search: "${searchQuery}", Client: "${clientFilter}"`);

        // Construct query parameters
        const queryParams = new URLSearchParams({
            email: userEmail,
            offset: currentPage * 500, // Assuming a limit of 500 for infinite scroll
            limit: 500, // Hardcoded limit for fetching data in chunks
            isAdmin: isAdmin,
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
        
        const tasksArray = Object.values(data).flat();
        
        const deliveriesForList = tasksArray.filter((delivery) => delivery.Step_ID === 0);

        if (deliveriesForList.length === 0 && currentPage !== 0 && !isInitialLoad) {
          console.log("No new deliveries to load, stopping further fetch.");
          setLoading(false); // Stop loading if no more data is available
          return;
        }

        const newDeliveries = deliveriesForList.map((delivery) => ({
          delCode: delivery.DelCode_w_o__,
          client: `${delivery.Client}`,
          // Populating 'initiated' for display
          initiated: formatTimestamp(delivery.Initiated_Timestamp), 
          // Storing raw initiated timestamp for sorting
          initiatedTimestampRaw: delivery.Initiated_Timestamp, 
          deadline: calculateDeadline(
            delivery.Planned_Delivery_Timestamp,
            delivery.Planned_Start_Timestamp
          ),
          tasksPlanned: delivery.Planned_Tasks || 0,
          tasksTotal: delivery.Total_Tasks || 0,
          createdAt: delivery.createdAt || delivery.Created_at,
        }));

        setDeliveries((prev) => {
          let combinedDeliveries;
          if (currentPage === 0) {
            combinedDeliveries = newDeliveries;
          } else {
            const newUniqueDeliveries = newDeliveries.filter(
              (newDel) => !prev.some((prevDel) => prevDel.delCode === newDel.delCode)
            );
            combinedDeliveries = [...prev, ...newUniqueDeliveries];
          }
          const sortedCombinedDeliveries = handleSort(combinedDeliveries);
          setTotalFilteredDeliveries(sortedCombinedDeliveries.length); // Update total count
          return sortedCombinedDeliveries;
        });
      } catch (error) {
        console.error('Error fetching data in DeliveryList:', error);
        notification.error({
            message: 'Data Fetch Error',
            description: `Failed to load deliveries: ${error.message}. Please try again.`,
        });
      } finally {
        setLoading(false);
      }
    },
    [userEmail, authToken, isAdmin, handleSort] // Use memoized handleSort here
  );

  const handleDelete = (deliveryCode) => {
    setDeliveries(prevDeliveries => prevDeliveries.filter(delivery => delivery.delCode !== deliveryCode));
  };

  useEffect(() => {
    console.log("DeliveryList: useEffect - attempting to load authToken from localStorage.");
    const storedAuthToken = localStorage.getItem('authToken');
    if (storedAuthToken) {
      setAuthToken(storedAuthToken);
      console.log("DeliveryList: authToken loaded from localStorage.");
    } else {
      console.log("DeliveryList: authToken not found in localStorage.");
    }
  }, []);

  // Effect to trigger data fetch when userEmail, authToken, debouncedSearchTerm, or selectedClient changes
  useEffect(() => {
    if (userEmail && authToken) {
      console.log("DeliveryList: Triggering fetchData with new search/filter criteria.");
      setDeliveries([]); // Clear previous deliveries
      setPage(0); // Reset page to 0 for a fresh fetch
      // Pass the current debouncedSearchTerm and selectedClient to fetchData
      fetchData(0, debouncedSearchTerm, selectedClient, true);
    } else {
      console.log("DeliveryList: userEmail or authToken not yet available for initial fetch.");
      setDeliveries([]);
      setLoading(false);
    }
  }, [fetchData, userEmail, authToken, debouncedSearchTerm, selectedClient]); // Dependencies added

  // NEW useEffect: Re-sorts the displayed deliveries when sortOption changes
  // This handles cases where data is already loaded and user just changes the sort order.
  useEffect(() => {
    if (deliveries.length > 0 && !loading) {
        // Create a shallow copy to ensure React detects a state change and re-renders
        setDeliveries((currentDeliveries) => handleSort([...currentDeliveries]));
    }
  }, [sortOption, deliveries.length, loading, handleSort]);


  // Debounce the searchTerm update
  const debouncedSetSearchTerm = useCallback(
    debounce((value) => {
      setDebouncedSearchTerm(value);
      setDeliveries([]); // Reset deliveries to fetch new search results
      setPage(0); // Reset page for new search
      setTotalFilteredDeliveries(0); // Reset count
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
    const date = new Date(timestamp?.value || timestamp);
    return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
  };

  const calculateDeadline = (deliveryTimestamp, startTimestamp) => {
    if (deliveryTimestamp && startTimestamp) {
      const deliveryTime = new Date(deliveryTimestamp?.value || deliveryTimestamp);
      const startTime = new Date(startTimestamp?.value || startTimestamp);
      if (isNaN(deliveryTime.getTime()) || isNaN(startTime.getTime())) return 'Invalid deadline';
      const timeDiff = deliveryTime - startTime;
      const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${daysLeft} days ${hoursLeft} hrs left`;
    }
    return 'No deadline';
  };

  useEffect(() => {
    if (observer.current) observer.current.disconnect();
    const loadMoreDeliveries = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !loading && deliveries.length > 0) {
        setPage((prevPage) => prevPage + 1);
      }
    };
    observer.current = new IntersectionObserver(loadMoreDeliveries, { threshold: 1.0 });
    const lastDeliveryElement = document.querySelector('.delivery-list-end');
    if (lastDeliveryElement) observer.current.observe(lastDeliveryElement);
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loading, deliveries.length]); 

  // Only fetch data when page changes (for infinite scroll)
  useEffect(() => {
    if (page > 0) {
      fetchData(page, debouncedSearchTerm, selectedClient);
    }
  }, [page, fetchData, debouncedSearchTerm, selectedClient]);

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
        <Button variant="outline-secondary" onClick={() => { setSearchTerm(''); setDebouncedSearchTerm(''); setSelectedClient(''); setDeliveries([]); setPage(0); setTotalFilteredDeliveries(0);}}>
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

      <p>You have {deliveries.length} active deliveries</p>

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
                        <div className="mb-2">
                          <ProgressBar
                            now={progress}
                            variant={progress > 50 ? 'success' : progress > 20 ? 'warning' : 'danger'}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="mb-1 text-muted">
                          <FiClock style={{ marginRight: '5px' }} /> {formatTimestamp(delivery.initiatedTimestampRaw)} {/* Displaying initiated timestamp */}
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

      {loading && (
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
