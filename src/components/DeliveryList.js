import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, ProgressBar, Form } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
// Removed GoogleLogin and jwtDecode as they are no longer needed here
// import { GoogleLogin } from '@react-oauth/google';
// import { jwtDecode } from 'jwt-decode';
import { UserContext } from './UserContext'; // Ensure UserContext is correctly imported
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';

// --- NEW: Define the base URL for your backend API, consistent with other components ---
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('DeliveryList: Using Backend API URL:', BACKEND_API_BASE_URL);


const DeliveryList = () => {
  const { userEmail } = useContext(UserContext); // Only consume userEmail, setUserEmail is handled by UserContext's loginUser
  const [deliveries, setDeliveries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  // authToken is now retrieved directly within fetchData or useEffect if needed for the first fetch
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(false);
  const observer = useRef(null);

  const [sortOption, setSortOption] = useState('earliest'); // Default: 'earliest'

  const handleSort = (deliveriesToSort) => { // Renamed parameter to avoid confusion with component's 'deliveries' state
    return deliveriesToSort.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.Created_at);
      const dateB = new Date(b.createdAt || b.Created_at);

      if (isNaN(dateA) || isNaN(dateB)) return 0;

      return sortOption === 'earliest' ? dateA - dateB : dateB - dateA;
    });
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
  };

  // Removed onLoginSuccess and onLoginFailure as GoogleLogin is no longer here

  const fetchData = useCallback(
    async (currentPage) => {
      // Retrieve authToken from sessionStorage directly for the fetch call
      const currentAuthToken = sessionStorage.getItem('authToken');

      // Ensure both userEmail and authToken are available before fetching
      if (!currentAuthToken || !userEmail) {
        setLoading(false);
        console.log("DeliveryList: Skipping fetchData, userEmail or authToken not available.");
        return;
      }

      try {
        setLoading(true);

        const response = await fetch(`${BACKEND_API_BASE_URL}/api/data?email=${userEmail}&page=${currentPage}`, {
          headers: {
            Authorization: `Bearer ${currentAuthToken}`, // Use the retrieved authToken
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text(); // Get detailed error
          throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const tasksArray = Object.values(data).flat();

        const filteredDeliveries = tasksArray.filter((delivery) => delivery.Step_ID === 0);

        if (filteredDeliveries.length === 0 && currentPage !== 0) {
          console.log("No new deliveries to load, stopping further fetch.");
          return;
        }

        const newDeliveries = filteredDeliveries.map((delivery) => ({
          delCode: delivery.DelCode_w_o__,
          client: `${delivery.Client}`,
          initiated: formatTimestamp(delivery.Planned_Start_Timestamp),
          deadline: calculateDeadline(
            delivery.Planned_Delivery_Timestamp,
            delivery.Planned_Start_Timestamp
          ),
          tasksPlanned: delivery.Planned_Tasks || 0,
          tasksTotal: delivery.Total_Tasks || 0,
          // Assuming createdAt or Created_at is available for sorting
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
      } finally {
        setLoading(false);
      }
    },
    [userEmail] // fetchData now only depends on userEmail and implicitly on sessionStorage for authToken
  );

  const handleDelete = (deliveryCode) => {
    // Update the state to remove the deleted delivery
    setDeliveries(prevDeliveries => prevDeliveries.filter(delivery => delivery.delCode !== deliveryCode));
  };

  // This useEffect ensures userEmail is available from sessionStorage for the initial fetch
  useEffect(() => {
    const storedUserEmail = sessionStorage.getItem('userEmail');
    // const storedAuthToken = sessionStorage.getItem('authToken'); // Auth token is now retrieved in fetchData directly

    if (storedUserEmail) { // Only set userEmail if found
      // setUserEmail from UserContext is already called by LoginComponent
      // This part might be redundant if App.js ensures userEmail is in context
      // before rendering DeliveryList. But keeping it for robustness if user navigates directly.
      if (userEmail !== storedUserEmail) { // Prevent unnecessary state updates
         // setUserEmail(storedUserEmail); // UserContext's responsibility now
         // The `UserProvider` already initializes `userEmail` from localStorage.
         // `sessionStorage` might be cleared on tab close, whereas `localStorage` persists.
         // It's generally better to rely on `UserContext` as the single source of truth for `userEmail`.
         // If `userEmail` isn't set via context, `fetchData` will bail out early.
      }
    }
  }, [userEmail]); // Depend on userEmail to potentially trigger re-fetch if it changes from other means

  // This useEffect triggers the data fetch once userEmail becomes available
  useEffect(() => {
    if (userEmail) { // Only fetch if userEmail is valid
      fetchData(0);
    } else {
      setDeliveries([]); // Clear deliveries if user logs out
    }
  }, [fetchData, userEmail]);

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

  const filteredDeliveries = handleSort(
    deliveries.filter((delivery) => {
      const matchesSearch = delivery.client.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = selectedClient ? delivery.client === selectedClient : true;
      return matchesSearch && matchesClient;
    })
  );

  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    const loadMoreDeliveries = (entries) => {
      const [entry] = entries;
      // Only load more if intersecting, not loading, and there are actually deliveries to observe
      if (entry.isIntersecting && !loading && filteredDeliveries.length > 0) {
        setPage((prevPage) => prevPage + 1);
      }
    };

    observer.current = new IntersectionObserver(loadMoreDeliveries, { threshold: 1.0 });

    const lastDeliveryElement = document.querySelector('.delivery-list-end');
    if (lastDeliveryElement) observer.current.observe(lastDeliveryElement);

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loading, filteredDeliveries]); // Added filteredDeliveries to dependencies

  useEffect(() => {
    if (page > 0) { // Only fetch if page is greater than 0 (i.e., not the initial load)
      fetchData(page);
    }
  }, [page, fetchData]);

  // Derive unique clients from the 'deliveries' state
  const uniqueClients = [...new Set(deliveries.map((delivery) => delivery.client))].sort(); // Sort alphabetically

  // Removed the conditional rendering for GoogleLogin as App.js now handles redirection
  return (
    <Container>
      <h1 className="my-4">List of Deliveries</h1>
      <Row className="mb-4">
        <Col xs={10}>
          <Form.Control
            type="text"
            placeholder="Search for deliveries..."
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
            clients={uniqueClients} // Pass the derived uniqueClients
            onClientSelect={handleClientSelect}
            selectedClient={selectedClient}
          />
        </Col>
        <Col xs={12}>
          <SortDeliveriesByDate sortOption={sortOption} setSortOption={setSortOption} />
        </Col>
      </Row>

      <p>You have {filteredDeliveries.length} active deliveries</p>

      <Row>
        {filteredDeliveries.map((delivery) => {
          const progress =
            delivery.tasksTotal === 0 ? 0 : (delivery.tasksPlanned / delivery.tasksTotal) * 100;

          return (
            <Col xs={12} key={delivery.delCode} className="mb-3">
              <Link to={`/delivery/data/${delivery.delCode}`} className="card-link-wrapper"> {/* Ensured correct path with /data/ */}
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
                          {/* Ensure handleDelete is correctly implemented in DeleteButton */}
                          <DeleteButton deliveryCode={delivery.delCode} onDelete={handleDelete} />
                        </div>
                        {/* Add the client name here */}
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
                            // Use document.execCommand('copy') for better iframe compatibility
                            const el = document.createElement('textarea');
                            el.value = delivery.delCode;
                            document.body.appendChild(el);
                            el.select();
                            document.execCommand('copy');
                            document.body.removeChild(el);
                            // Optional: add a notification for copying
                            // notification.success({
                            //   message: 'Copied!',
                            //   description: `Delivery code ${delivery.delCode} copied to clipboard.`,
                            //   placement: 'bottomRight',
                            //   duration: 2
                            // });
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
