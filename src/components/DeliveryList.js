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
  const { userEmail, logoutUser } = useContext(UserContext);
  const navigate = useNavigate(); 
  const [deliveries, setDeliveries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); 
  const [authToken, setAuthToken] = useState(null);
  const [page, setPage] = useState(0); // Current page for infinite scroll
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(true);
  const observer = useRef(null); 
  const [sortOption, setSortOption] = useState('earliest');
  const [totalFilteredDeliveries, setTotalFilteredDeliveries] = useState(0); 
  const [allClients, setAllClients] = useState([]); // State to hold all unique clients
  
  const updateSearchTerm = useRef(debounce((nextValue) => {
    setDebouncedSearchTerm(nextValue);
  }, 500));

  const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

  const handleSort = useCallback((deliveriesToSort) => {
    return [...deliveriesToSort].sort((a, b) => { 
      // Use DelCode_w_o__ or Delivery_code for key lookup
      const dateA = new Date(a.Initiated_Timestamp?.value || a.Initiated_Timestamp);
      const dateB = new Date(b.Initiated_Timestamp?.value || b.Initiated_Timestamp);
      
      const isValidDateA = !isNaN(dateA.getTime());
      const isValidDateB = !isNaN(dateB.getTime());

      if (!isValidDateA && !isValidDateB) return 0;
      if (!isValidDateA) return 1; 
      if (!isValidDateB) return -1; 

      return sortOption === 'earliest' ? dateA - dateB : dateB - dateA;
    });
  }, [sortOption]); 


  // Renamed to onClientSelect to match the FilterDeliveryBasedOnClientSelected.js component prop
  const onClientSelect = (client) => {
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
  
  const handleDeliveryDelete = useCallback((deletedDelCode) => {
    setDeliveries((prevDeliveries) => 
        prevDeliveries.filter(d => d.DelCode_w_o__ !== deletedDelCode)
    );
    setTotalFilteredDeliveries(prev => prev > 0 ? prev - 1 : 0);
    notification.success({
      message: 'Deletion Successful',
      description: `Delivery ${deletedDelCode} has been removed.`,
    });
  }, []);


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
            offset: currentPage * 500, // Offset based on page number
            limit: 500, // Fixed limit for infinite scroll batch
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
          if (response.status === 401) {
            logoutUser();
            navigate('/login'); 
          }
          throw new Error(`Network response was not ok: ${response.status} - ${errorText}`);
        }

        const { data, totalCount, allClients: fetchedClients } = await response.json();
        
        const tasksArray = Object.values(data).flat();
        
        // Filter for the main delivery entries (Step_ID === 0)
        const deliveriesForList = tasksArray.filter((delivery) => delivery.Step_ID === 0);

        if (isInitialLoad && fetchedClients) {
            // Update the full list of clients only on the initial load
            setAllClients(fetchedClients.sort());
        }

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
            delCode: delivery.Delivery_code, // Main code with underscores
            client: delivery.Client,
            tasksTotal,
            tasksPlanned,
            progress: tasksTotal === 0 ? 0 : Math.round((tasksPlanned / tasksTotal) * 100),
            deadline: deadlineText,
            initiatedTimestampRaw: delivery.Initiated_Timestamp,
          };
        });

        setTotalFilteredDeliveries(totalCount); // Update the total count from backend

        setDeliveries((prevDeliveries) => {
          // If it's page 0 or a new search/filter, replace the list. Otherwise, append.
          const newDeliveries = currentPage === 0 ? enrichedDeliveries : [...prevDeliveries, ...enrichedDeliveries];
          // Ensure new deliveries are sorted every time
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
    [userEmail, isAdmin, authToken, handleSort, logoutUser, navigate] 
  );

  const calculateTimeLeft = (timestamp) => {
    const deadline = moment(timestamp);
    const now = moment();
    const diff = deadline.diff(now);

    if (diff <= 0) return 'Deadline passed';

    const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return `${daysLeft} days ${hoursLeft} hrs left`;
  };

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

  // Effect to trigger data fetch when dependencies change (Initial/New Filter/Search)
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

  // Re-sorts the displayed deliveries when sortOption changes
  useEffect(() => {
    if (deliveries.length > 0 && !loading) {
      setDeliveries((currentDeliveries) => handleSort([...currentDeliveries]));
    }
  }, [sortOption, loading, handleSort]); 

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    updateSearchTerm.current(value);
  };
  
  // Lazy Load / Infinite Scroll Logic
  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    const loadMoreDeliveries = (entries) => {
      const [entry] = entries;
      // Trigger load more if intersecting, not currently loading, deliveries exist, and not all total deliveries have been loaded
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

  // Fetch next page of data when page state changes (for infinite scroll)
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
            // Matching the component's expected props
            onClientSelect={onClientSelect} 
            clients={allClients} 
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
        {deliveries.length > 0 ? (
          deliveries.map((delivery) => {
            const progress = delivery.progress;
            const progressVariant = calculateProgressVariant(progress);

            return (
              <Col xs={12} key={delivery.DelCode_w_o__} className="card-wrapper">
                <Link 
                  to={`/delivery/data/${delivery.DelCode_w_o__}`} 
                  style={{ textDecoration: 'none' }}
                >
                  <Card className="task-card">
                     <div 
                          className="shaded-bg" 
                          style={{ width: `${100 - progress}%`, right: 0 }}
                      ></div>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h5 className="mb-1">{delivery.Client}</h5>
                          <p className="client mb-2">Delivery Code: {delivery.DelCode_w_o__}</p>
                        </div>
                        
                        {isAdmin && (
                            <div onClick={(e) => e.preventDefault()}>
                              <DeleteButton 
                                  deliveryCode={delivery.DelCode_w_o__} 
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
                              e.preventDefault(); 
                              e.stopPropagation(); 
                              const el = document.createElement('textarea');
                              el.value = delivery.DelCode_w_o__;
                              document.body.appendChild(el);
                              el.select();
                              document.execCommand('copy');
                              document.body.removeChild(el);
                              notification.info({
                                message: 'Copied!',
                                description: `Delivery Code ${delivery.DelCode_w_o__} copied to clipboard.`,
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
          })
        ) : (
          <Col>
            <p className="text-center">No deliveries found matching your criteria.</p>
          </Col>
        )}
      </Row>

      {/* This element is observed by IntersectionObserver for infinite scrolling */}
      <div className="delivery-list-end" style={{ height: '1px' }}></div> 

      {loading && deliveries.length > 0 && ( 
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
