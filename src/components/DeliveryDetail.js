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

const DeliveryList = () => {
  const { userEmail, logoutUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(true);
  const observer = useRef(null);
  const [sortOption, setSortOption] = useState('earliest');
  const [hasMore, setHasMore] = useState(true); // New state to track if there's more data

  // Determine isAdmin status for the current user
  const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);
  console.log(`DeliveryList: Current User Email: ${userEmail}, Is Admin: ${isAdmin}`);


  const handleSort = (deliveriesToSort) => {
    return deliveriesToSort.sort((a, b) => {
      // Use plannedStartTimestampRaw for sorting
      const dateA = new Date(a.plannedStartTimestampRaw?.value || a.plannedStartTimestampRaw);
      const dateB = new Date(b.plannedStartTimestampRaw?.value || b.plannedStartTimestampRaw);
      
      // Handle cases where date might be invalid or null
      const isValidDateA = !isNaN(dateA.getTime());
      const isValidDateB = !isNaN(dateB.getTime());

      if (!isValidDateA && !isValidDateB) return 0; // Both invalid, treat as equal
      if (!isValidDateA) return 1; // A is invalid, B comes first
      if (!isValidDateB) return -1; // B is invalid, A comes first

      return sortOption === 'earliest' ? dateA - dateB : dateB - dateA;
    });
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
  };

  const fetchData = useCallback(
    async (currentPage) => {
      if (!authToken || !userEmail) {
        setLoading(false);
        console.log("DeliveryList: Skipping fetchData because userEmail or authToken is not available yet.");
        return;
      }
      if (!hasMore && currentPage > 0) { // Prevent fetching if no more data and not initial load
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log(`DeliveryList: Fetching data for page ${currentPage} with email: ${userEmail}, isAdmin: ${isAdmin}, searchTerm: "${searchTerm}", selectedClient: "${selectedClient}"`);

        const response = await fetch(`${BACKEND_API_BASE_URL}/api/data?email=${userEmail}&page=${currentPage}&isAdmin=${isAdmin}&searchTerm=${searchTerm}&selectedClient=${selectedClient}`, {
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

        // Determine if there's more data to load for infinite scroll
        // Assuming your backend returns a limited number of results per page,
        // if the number of results is less than the expected limit, it means no more data.
        // (This assumes the backend's default limit is 500, as per your server.js)
        if (deliveriesForList.length === 0 && currentPage !== 0) {
            setHasMore(false); // No more data to load
            console.log("No new deliveries to load, stopping further fetch.");
            setLoading(false); // Ensure loading is set to false
            return;
        } else if (deliveriesForList.length < 500) { // Assuming 500 is the default limit
            setHasMore(false); // Less than a full page, so likely no more data
        } else {
            setHasMore(true); // Might have more data
        }


        const newDeliveries = deliveriesForList.map((delivery) => ({
          delCode: delivery.DelCode_w_o__,
          client: `${delivery.Client}`,
          initiated: formatTimestamp(delivery.Planned_Start_Timestamp), // Formatted string for display
          plannedStartTimestampRaw: delivery.Planned_Start_Timestamp, // Store raw timestamp for sorting
          deadline: calculateDeadline(
            delivery.Planned_Delivery_Timestamp,
            delivery.Planned_Start_Timestamp
          ),
          tasksPlanned: delivery.Planned_Tasks || 0,
          tasksTotal: delivery.Total_Tasks || 0,
          createdAt: delivery.createdAt || delivery.Created_at,
        }));

        setDeliveries((prev) => {
          const newUniqueDeliveries = newDeliveries.filter(
            (newDel) => !prev.some((prevDel) => prevDel.delCode === newDel.delCode)
          );
          if (newUniqueDeliveries.length === 0 && currentPage !== 0) {
            console.log('No new unique deliveries to add.');
            return prev;
          }
          return [...prev, ...newUniqueDeliveries];
        });
      } catch (error) {
        console.error('Error fetching data in DeliveryList:', error);
        setHasMore(false); // On error, assume no more data to prevent infinite loops
      } finally {
        setLoading(false);
      }
    },
    [userEmail, authToken, isAdmin, searchTerm, selectedClient, hasMore] // Added hasMore to dependencies
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

  useEffect(() => {
    if (userEmail && authToken) {
      console.log("DeliveryList: userEmail and authToken are available, triggering fetchData(0).");
      // Reset deliveries when user/auth changes or on initial fetch to prevent stale data
      setDeliveries([]); 
      setPage(0); // Reset page to 0 for a fresh fetch
      setHasMore(true); // Reset hasMore when starting a new fetch
      fetchData(0);
    } else {
      console.log("DeliveryList: userEmail or authToken not yet available for initial fetch.");
      setDeliveries([]);
      setLoading(false);
      setHasMore(false); // No user, no more data
    }
  }, [fetchData, userEmail, authToken]);

  // NEW useEffect to trigger a fresh fetch when search/filter terms change
  useEffect(() => {
    // Only trigger a new fetch if searchTerm or selectedClient actually changed
    // and userEmail and authToken are already available.
    if (userEmail && authToken) {
        setDeliveries([]); // Clear existing deliveries for a fresh search/filter
        setPage(0); // Reset page to 0
        setHasMore(true); // Reset hasMore for new search/filter
        fetchData(0); // Fetch data with new search/filter criteria
    }
  }, [searchTerm, selectedClient, userEmail, authToken, fetchData]); // Added fetchData as a dependency


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

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // The backend now handles filtering, so this is just for sorting the already filtered data
  const sortedAndFilteredDeliveries = handleSort(deliveries);

  useEffect(() => {
    if (observer.current) observer.current.disconnect();
    const loadMoreDeliveries = (entries) => {
      const [entry] = entries;
      // Trigger load more if the sentinel is intersecting, not currently loading, and there's potentially more data
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
  }, [loading, hasMore]); // Dependencies simplified, as fetchData handles search/filter changes

  useEffect(() => {
    if (page > 0) {
      fetchData(page);
    }
  }, [page, fetchData]);

  const uniqueClients = [...new Set(deliveries.map((delivery) => delivery.client))]
    .filter(client => client) // Filter out null/undefined clients before mapping and sorting
    .map(client => client.toLowerCase())
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort()
    .map(client => client.charAt(0).toUpperCase() + client.slice(1));


  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  // --- Conditional Rendering for different states ---
  // 1. Initial loading state (before any data is fetched)
  if (loading && deliveries.length === 0 && !searchTerm && !selectedClient) {
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

  // 2. No deliveries fetched at all (after loading, and no search/filter is active)
  // This means the user genuinely has no deliveries assigned or the DB is empty for them
  if (!loading && sortedAndFilteredDeliveries.length === 0 && !searchTerm && !selectedClient) {
    return (
      <Container className="text-center my-5">
        <p>No active deliveries found for your account.</p>
        <Button variant="outline-primary" onClick={handleLogout}>
          Logout
        </Button>
      </Container>
    );
  }

  // 3. Deliveries are loaded, but current search/filter yields no results
  // This is where we show the "Clear Search/Filters" button
  if (!loading && sortedAndFilteredDeliveries.length === 0 && (searchTerm || selectedClient)) {
    return (
      <Container className="text-center my-5">
        <p>No deliveries match your current search/filter criteria.</p>
        <Button variant="outline-secondary" onClick={() => { setSearchTerm(''); setSelectedClient(''); setPage(0); setDeliveries([]); setHasMore(true); }}>
          Clear Search/Filters
        </Button>
        <Button variant="outline-danger" onClick={handleLogout} className="ml-2">
            Logout
        </Button>
      </Container>
    );
  }

  // If none of the above, render the main list
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

      <p>You have {sortedAndFilteredDeliveries.length} active deliveries</p>

      <Row>
        {/* THIS IS THE CRITICAL LINE THAT NEEDS TO USE sortedAndFilteredDeliveries */}
        {sortedAndFilteredDeliveries.map((delivery) => {
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
                          {/* Render DeleteButton only if isAdmin is true */}
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
                          <FiClock style={{ marginRight: '5px' }} /> {delivery.initiated}
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

      {loading && hasMore && ( // Show spinner only when loading and there's potentially more data
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
          <FaSpinner
            className="spinner-icon"
            style={{ fontSize: '2rem', color: '#007bff', animation: 'spin 10s linear infinite' }}
          />
        </div>
      )}
      {!hasMore && sortedAndFilteredDeliveries.length > 0 && (
        <div className="text-center my-3 text-muted">
            End of results.
        </div>
      )}
    </Container>
  );
};

export default DeliveryList;
