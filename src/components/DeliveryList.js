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


  const handleSort = (deliveriesToSort) => {
    return deliveriesToSort.sort((a, b) => {
      const dateA = new Date(a.plannedStartTimestampRaw?.value || a.plannedStartTimestampRaw);
      const dateB = new Date(b.plannedStartTimestampRaw?.value || b.plannedStartTimestampRaw);
      
      const isValidDateA = !isNaN(dateA.getTime());
      const isValidDateB = !isNaN(dateB.getTime());

      if (!isValidDateA && !isValidDateB) return 0;
      if (!isValidDateA) return 1;
      if (!isValidDateB) return -1;

      return sortOption === 'earliest' ? dateA - dateB : dateB - dateA;
    });
  };

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
        
        // Count total relevant deliveries based on the current search/filter,
        // without considering pagination for the total count display
        // This requires an additional endpoint or a modification to current one to return count
        // For now, let's assume the backend will only return *relevant* results
        // and we will update totalFilteredDeliveries based on actual fetched items.
        // A more robust solution for count would be a separate /api/count endpoint.

        const deliveriesForList = tasksArray.filter((delivery) => delivery.Step_ID === 0);

        if (deliveriesForList.length === 0 && currentPage !== 0 && !isInitialLoad) {
          console.log("No new deliveries to load, stopping further fetch.");
          setLoading(false); // Stop loading if no more data is available
          return;
        }

        const newDeliveries = deliveriesForList.map((delivery) => ({
          delCode: delivery.DelCode_w_o__,
          client: `${delivery.Client}`,
          initiated: formatTimestamp(delivery.Planned_Start_Timestamp),
          plannedStartTimestampRaw: delivery.Planned_Start_Timestamp,
          deadline: calculateDeadline(
            delivery.Planned_Delivery_Timestamp,
            delivery.Planned_Start_Timestamp
          ),
          tasksPlanned: delivery.Planned_Tasks || 0,
          tasksTotal: delivery.Total_Tasks || 0,
          createdAt: delivery.createdAt || delivery.Created_at,
        }));

        setDeliveries((prev) => {
          // If it's a new search/filter, replace existing deliveries
          if (currentPage === 0) {
            // Sort only the newly fetched batch for the first page
            const sortedNewDeliveries = handleSort(newDeliveries);
            setTotalFilteredDeliveries(sortedNewDeliveries.length); // Update total count for current filter
            return sortedNewDeliveries;
          } else {
            const newUniqueDeliveries = newDeliveries.filter(
              (newDel) => !prev.some((prevDel) => prevDel.delCode === newDel.delCode)
            );
            const combinedDeliveries = [...prev, ...newUniqueDeliveries];
            // Only sort the entire list when new data is added for infinite scroll
            const sortedCombinedDeliveries = handleSort(combinedDeliveries);
            setTotalFilteredDeliveries(sortedCombinedDeliveries.length); // Update total count
            return sortedCombinedDeliveries;
          }
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
    [userEmail, authToken, isAdmin, sortOption] // Added sortOption to dependency array
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

  // No more client-side filtering needed here, as backend returns filtered data
  // const filteredDeliveries = handleSort(deliveries.filter(...)); 

  useEffect(() => {
    if (observer.current) observer.current.disconnect();
    const loadMoreDeliveries = (entries) => {
      const [entry] = entries;
      // Only load more if at the end, not currently loading, and no active search/filter terms (for infinite scroll to load all)
      // OR if search/filter is active and there's more data to load for that specific filter.
      // This logic is tricky. Let's simplify: only load more if no search/filter.
      // For filtered results, user might manually trigger "load more" or we rely on initial fetch.
      // Let's adjust this: if there's a search term or selected client, we assume the initial fetch loaded *all*
      // relevant results, unless the backend supports paginating filtered results.
      // Given current backend, it supports pagination for filtered results, so we can allow infinite scroll
      // but ensure `totalFilteredDeliveries` (if backend provides it) or `deliveries.length` vs `limit` helps.

      // Simplified infinite scroll trigger: only if at end and not loading.
      // The `fetchData` itself handles passing the current search/filter terms.
      if (entry.isIntersecting && !loading && deliveries.length > 0) {
        // If there's a search term or selected client, we assume backend handles pagination for it.
        // We increment page and fetchData will use the existing searchTerm/selectedClient.
        setPage((prevPage) => prevPage + 1);
      }
    };
    observer.current = new IntersectionObserver(loadMoreDeliveries, { threshold: 1.0 });
    const lastDeliveryElement = document.querySelector('.delivery-list-end');
    if (lastDeliveryElement) observer.current.observe(lastDeliveryElement);
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loading, deliveries.length]); // Dependencies adjusted

  // Only fetch data when page changes (for infinite scroll)
  useEffect(() => {
    if (page > 0) { // Only fetch if page is incremented from 0 (i.e., not initial load due to search/filter change)
      fetchData(page, debouncedSearchTerm, selectedClient);
    }
  }, [page, fetchData, debouncedSearchTerm, selectedClient]); // Added dependencies

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
  // 1. Initial loading state (before any data is fetched)
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

  // 2. No deliveries fetched at all (after loading, and no search/filter is active)
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

  // 3. Deliveries are loaded, but current search/filter yields no results
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
            value={searchTerm} // Controlled by instant searchTerm
            onChange={handleSearchChange} // Triggers debounced update
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

      <p>You have {deliveries.length} active deliveries</p> {/* Now displays the count of *currently loaded* filtered deliveries */}

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
