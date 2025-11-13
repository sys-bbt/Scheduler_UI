import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// FIX: Removed unused imports 'Button' and 'FiCheckCircle'
import { Container, Row, Col, Card, ProgressBar, Form } from 'react-bootstrap';
import { FiClock, FiFlag } from 'react-icons/fi';
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); 
  const [authToken, setAuthToken] = useState(null);
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(true);
  const observer = useRef(null); 
  const [sortOption, setSortOption] = useState('earliest');
  const [totalFilteredDeliveries, setTotalFilteredDeliveries] = useState(0); 
  
  // Ref to hold the stable debounced function
  const updateSearchTerm = useRef(debounce((nextValue) => {
    setDebouncedSearchTerm(nextValue);
  }, 500));

  // --- RUNTIME FIX PREP: Calculate unique list of clients ---
  const uniqueClients = Array.from(
    new Set(deliveries.map(d => d.client).filter(client => client))
  ).sort();
  // --------------------------------------------------------

  const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

  // Memoize handleSort to ensure stable function reference
  const handleSort = useCallback((deliveriesToSort) => {
    return [...deliveriesToSort].sort((a, b) => { 
      const dateA = new Date(a.initiatedTimestampRaw?.value || a.initiatedTimestampRaw);
      const dateB = new Date(b.initiatedTimestampRaw?.value || b.initiatedTimestampRaw);
      
      const isValidDateA = !isNaN(dateA.getTime());
      const isValidDateB = !isNaN(dateB.getTime());

      if (!isValidDateA && !isValidDateB) return 0;
      if (!isValidDateA) return 1; // Put invalid date at end
      if (!isValidDateB) return -1; // Put invalid date at end

      return sortOption === 'earliest' ? dateA - dateB : dateB - dateA;
    });
  }, [sortOption]); 


  const handleClientSelect = (client) => {
    setSelectedClient(client);
    setDeliveries([]); 
    setPage(0); 
    setTotalFilteredDeliveries(0);
  };

  const calculateProgressVariant = (progress) => {
    if (progress === 100) return 'success';
    if (progress >= 75) return 'info';
    if (progress >= 50) return 'warning';
    return 'danger';
  };
  
  // Implemented function for deleting a delivery and updating state
  const handleDeliveryDelete = useCallback((deletedDelCode) => {
    setDeliveries((prevDeliveries) => 
        prevDeliveries.filter(d => d.delCode !== deletedDelCode)
    );
    notification.success({
      message: 'Deletion Successful',
      description: `Delivery ${deletedDelCode} has been removed.`,
    });
  }, []);

  // Modified fetchData to accept search and client parameters
  const fetchData = useCallback(
    async (currentPage, searchQuery, clientFilter, isInitialLoad = false) => {
      if (!authToken || !userEmail) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const queryParams = new URLSearchParams({
            email: userEmail,
            offset: currentPage * 500, 
            limit: 500, 
            isAdmin: isAdmin,
        });

        if (searchQuery) {
            queryParams.append('searchTerm', searchQuery);
        }
        if (clientFilter) {
            queryParams.append('selectedClient', clientFilter);
        }

        // FIX: Removed BACKEND_API_BASE_URL from dependencies
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/data?${queryParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 401) {
            logoutUser();
            navigate('/login'); 
          }
          throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
        }

        const { data, totalCount } = await response.json();
        
        const tasksArray = Object.values(data).flat();
        
        // Filter for the main delivery entries (Step_ID === 0)
        const deliveriesForList = tasksArray.filter((delivery) => delivery.Step_ID === 0);

        if (deliveriesForList.length === 0 && currentPage !== 0 && !isInitialLoad) {
          setLoading(false);
          return;
        }

        const enrichedDeliveries = deliveriesForList.map((delivery) => {
          // Find all tasks associated with this delivery code
          const associatedTasks = tasksArray.filter(task => task.Delivery_code === delivery.Delivery_code && task.Step_ID !== 0);
          
          const tasksTotal = associatedTasks.length;
          // Count tasks that have a planned delivery timestamp
          const tasksPlanned = associatedTasks.filter(task => 
            !!task.Planned_Delivery_Timestamp && 
            (typeof task.Planned_Delivery_Timestamp === 'string' ? task.Planned_Delivery_Timestamp !== "NULL" : task.Planned_Delivery_Timestamp.value !== null)
          ).length;

          // Calculate time remaining for deadline
          const deadlineTimestamp = delivery.Planned_Delivery_Timestamp?.value || delivery.Planned_Delivery_Timestamp;
          const deadlineText = deadlineTimestamp ? calculateTimeLeft(deadlineTimestamp) : 'No deadline';
          
          return {
            ...delivery,
            delCode: delivery.Delivery_code,
            client: delivery.Client,
            tasksTotal,
            tasksPlanned,
            progress: tasksTotal === 0 ? 0 : Math.round((tasksPlanned / tasksTotal) * 100),
            deadline: deadlineText,
            initiatedTimestampRaw: delivery.Initiated_Timestamp, // Use raw timestamp for sorting
          };
        });

        setTotalFilteredDeliveries(totalCount); // Update the total count from backend

        setDeliveries((prevDeliveries) => {
          // If it's page 0 or a new search/filter, replace the list. Otherwise, append.
          const newDeliveries = currentPage === 0 ? enrichedDeliveries : [...prevDeliveries, ...enrichedDeliveries];
          return handleSort(newDeliveries);
        });

      } catch (error) {
        console.error('Error fetching delivery data:', error);
        notification.error({
          message: 'Data Fetch Error',
          description: `Failed to load deliveries: ${error.message}`,
        });
      } finally {
        setLoading(false);
      }
    },
    // FIX: Removed BACKEND_API_BASE_URL from dependencies
    [userEmail, isAdmin, authToken, handleSort, logoutUser, navigate] 
  );

  // Helper function to calculate time left
  const calculateTimeLeft = (timestamp) => {
    const deadline = new Date(timestamp);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return 'Deadline passed';

    const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return `${daysLeft} days ${hoursLeft} hrs left`;
  };

  // Effect to load authToken from localStorage on component mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    if (token && email) {
      setAuthToken(token);
    } else {
      setLoading(false);
      if (!email) {
        navigate('/login');
      }
    }
  }, [navigate]);

  // Effect to trigger data fetch when userEmail, authToken, debouncedSearchTerm, or selectedClient changes
  useEffect(() => {
    if (userEmail && authToken) {
      setDeliveries([]);
      setPage(0);
      fetchData(0, debouncedSearchTerm, selectedClient, true);
    } else {
      setDeliveries([]);
      setLoading(false);
    }
  }, [fetchData, userEmail, authToken, debouncedSearchTerm, selectedClient]); 

  // NEW useEffect: Re-sorts the displayed deliveries when sortOption changes
  useEffect(() => {
    if (deliveries.length > 0 && !loading) {
      setDeliveries((currentDeliveries) => handleSort([...currentDeliveries]));
    }
  }, [sortOption, deliveries.length, loading, handleSort]); 

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    // Call the debounced function via its ref
    updateSearchTerm.current(value);
  };
  
  // Infinite scroll logic
  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    const loadMoreDeliveries = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !loading && deliveries.length > 0 && deliveries.length < totalFilteredDeliveries) {
        setPage((prevPage) => prevPage + 1);
      }
    };

    observer.current = new IntersectionObserver(loadMoreDeliveries, { threshold: 1.0 });
    const lastDeliveryElement = document.querySelector('.delivery-list-end');

    if (lastDeliveryElement) observer.current.observe(lastDeliveryElement);

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loading, deliveries.length, totalFilteredDeliveries]); 

  // Only fetch data when page changes (for infinite scroll)
  useEffect(() => {
    if (page > 0) {
      fetchData(page, debouncedSearchTerm, selectedClient, false);
    }
  }, [page, fetchData, debouncedSearchTerm, selectedClient]);


  return (
    <Container className="mt-4">
      <h1 className="mb-3">Active Deliveries</h1>

      <Row className="mb-4 align-items-end">
        <Col md={4} className="mb-3">
          <Form.Group controlId="searchBar">
            <Form.Label>Search Deliveries</Form.Label>
            <Form.Control
              type="text"
              placeholder="Search by client or code..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </Form.Group>
        </Col>

        <Col md={4} className="mb-3">
          <FilterDeliveryBasedOnClientSelected 
            selectedClient={selectedClient} 
            handleClientSelect={handleClientSelect} 
            currentUserEmail={userEmail}
            isAdmin={isAdmin}
            // PROP ADDED TO FIX RUNTIME ERROR
            allClients={uniqueClients} 
          />
        </Col>

        <Col md={4} className="mb-3">
          <SortDeliveriesByDate 
            sortOption={sortOption} 
            setSortOption={setSortOption} 
          />
        </Col>
      </Row>

      <p>You have {deliveries.length} active deliveries (Total: {totalFilteredDeliveries})</p>

      <Row>
        {deliveries.map((delivery) => {
          const progress = delivery.progress;
          const progressVariant = calculateProgressVariant(progress);

          return (
            <Col xs={12} key={delivery.delCode} className="card-wrapper">
              <Link 
                to={`/delivery/data/${delivery.delCode}`} 
                style={{ textDecoration: 'none' }}
              >
                <Card className="task-card">
                   {/* Shaded background for visual effect */}
                   <div 
                        className="shaded-bg" 
                        style={{ width: `${100 - progress}%`, right: 0 }}
                    ></div>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h5 className="mb-1">{delivery.Client}</h5>
                        <p className="client mb-2">Delivery Code: {delivery.delCode}</p>
                      </div>
                      
                      {isAdmin && (
                          <div onClick={(e) => e.preventDefault()}>
                            <DeleteButton 
                                deliveryCode={delivery.delCode} 
                                onDelete={handleDeliveryDelete} 
                            />
                          </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <ProgressBar 
                        now={progress} 
                        label={`${progress}%`} 
                        variant={progressVariant} 
                      />
                      <p className="text-muted mt-1 mb-2">
                        {delivery.tasksPlanned} of {delivery.tasksTotal} tasks planned
                      </p>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div>
                        <p className="mb-0 text-primary">
                          <FiClock style={{ marginRight: '5px' }} /> {delivery.Current_Status}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="mb-0 text-danger">
                          <FiFlag style={{ marginRight: '5px' }} /> {delivery.deadline}
                        </p>
                        <p
                          onClick={(e) => {
                            e.preventDefault(); // Prevent navigating to detail page on click
                            e.stopPropagation(); // Stop event from bubbling up to Link
                            const el = document.createElement('textarea');
                            el.value = delivery.delCode;
                            document.body.appendChild(el);
                            el.select();
                            document.execCommand('copy');
                            document.body.removeChild(el);
                            notification.info({
                              message: 'Copied!',
                              description: `Delivery Code ${delivery.delCode} copied to clipboard.`,
                            });
                          }}
                          style={{ cursor: "pointer", color: "blue", textDecoration: "underline", fontSize: '0.85em' }}
                          title="Click to copy"
                        >
                          Copy Code
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

      <div className="delivery-list-end" style={{ height: '1px' }}></div>

      {loading && (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
          <FaSpinner
            className="spinner-icon"
            style={{ fontSize: '2rem', color: '#007bff', animation: 'spin 2s linear infinite' }}
          />
        </div>
      )}
      {!loading && deliveries.length === totalFilteredDeliveries && totalFilteredDeliveries > 0 && (
         <p className="text-center text-muted mt-3">All deliveries loaded.</p>
      )}
    </Container>
  );
};

export default DeliveryList;
