import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, ProgressBar, Form } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { UserContext, LoginComponent } from './UserContext'; // Import LoginComponent
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';

const DeliveryList = () => {
  const { userEmail, userName, loginUser, logoutUser } = useContext(UserContext); // Get all context values
  const [deliveries, setDeliveries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null); // Load authToken from localStorage
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // State for error messages
  
  const observer = useRef(null);

  const [sortOption, setSortOption] = useState('earliest'); // Default: 'earliest'

  const handleSort = (deliveriesToSort) => { // Renamed parameter to avoid confusion with component's 'deliveries' state
    return deliveriesToSort.sort((a, b) => {
      const dateA = new Date(a.Initiated_Timestamp);
      const dateB = new Date(b.Initiated_Timestamp);

      if (sortOption === 'earliest') {
        return dateA - dateB;
      } else { // 'latest'
        return dateB - dateA;
      }
    });
  };

  const fetchDeliveries = useCallback(async (pageNumber, currentDeliveries = []) => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
        const token = localStorage.getItem('authToken'); // Ensure token is up-to-date
        if (!token) {
            console.warn("No auth token found. User might not be logged in.");
            setLoading(false);
            return;
        }

        const response = await fetch(`https://server-ui-2.onrender.com/api/deliveries?page=${pageNumber}&search=${searchTerm}&client=${selectedClient}&email=${userEmail}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // 🚨 DEBUGGING LINE: Log the raw fetched data 🚨
        console.log("DEBUG: Fetched Deliveries Data:", JSON.stringify(data, null, 2));

        if (data.deliveries && Array.isArray(data.deliveries)) {
            setDeliveries(prevDeliveries => {
                const newDeliveries = data.deliveries.filter(
                    (newDel) => !prevDeliveries.some((existingDel) => existingDel.Key === newDel.Key)
                );
                return [...prevDeliveries, ...newDeliveries];
            });
            setPage(data.nextPage);
        } else {
            console.warn("Fetched data.deliveries is not an array:", data.deliveries);
        }
    } catch (error) {
        console.error("Error fetching deliveries:", error);
        setError(error.message);
    } finally {
        setLoading(false);
    }
  }, [searchTerm, selectedClient, userEmail]); // Depend on userEmail for re-fetch on login/logout

  // Effect to fetch initial deliveries and when filters/search change
  useEffect(() => {
    if (userEmail) { // Only fetch if user is logged in
        setDeliveries([]); // Clear deliveries on filter/search change
        setPage(0); // Reset page to 0
        fetchDeliveries(0); // Fetch first page
    }
  }, [searchTerm, selectedClient, userEmail, fetchDeliveries]);

  // Infinite scrolling effect
  useEffect(() => {
    const currentObserver = observer.current;
    if (currentObserver) {
      currentObserver.disconnect();
    }

    currentObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && page !== null) {
        fetchDeliveries(page);
      }
    }, { threshold: 1.0 });

    if (lastDeliveryElementRef.current) {
      currentObserver.observe(lastDeliveryElementRef.current);
    }

    observer.current = currentObserver; // Update the ref

    return () => {
      if (currentObserver) {
        currentObserver.disconnect();
      }
    };
  }, [loading, page, fetchDeliveries]);

  const lastDeliveryElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && page !== null) {
        fetchDeliveries(page);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, page, fetchDeliveries]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleClientChange = (e) => {
    setSelectedClient(e.target.value);
  };

  const handleDeliveryDelete = (deletedDeliveryCode) => {
    setDeliveries(prevDeliveries => prevDeliveries.filter(delivery => delivery.DelCode_w_o__ !== deletedDeliveryCode));
  };
  
  // Extract unique clients from current deliveries for the filter dropdown
  const clients = Array.from(new Set(deliveries.map(delivery => delivery.Client))).sort();


  if (error) {
    return (
      <Container className="mt-5 text-center">
        <h2>Error: {error}</h2>
        {error.includes("401") || error.includes("Unauthorized") ? (
            <p>Please log in again.</p>
        ) : (
            <p>An error occurred while fetching data. Please try again later.</p>
        )}
      </Container>
    );
  }

  // Show LoginComponent if user is not logged in
  if (!userEmail) {
    return (
      <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
          <LoginComponent />
      </Container>
    );
  }

  return (
    <Container className="mt-5">
      <h1 className="text-center mb-4">Delivery List for {userName || userEmail}</h1>
      <button onClick={logoutUser} className="btn btn-secondary mb-3">Logout</button> {/* Logout button */}

      <Form className="mb-4">
        <Form.Group controlId="searchBar">
          <Form.Control
            type="text"
            placeholder="Search by project, task, or client..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </Form.Group>
      </Form>

      <Row className="mb-4">
        <Col md={6}>
            <FilterDeliveryBasedOnClientSelected
                selectedClient={selectedClient}
                handleClientChange={handleClientChange}
                clients={clients} // Pass the dynamically generated clients
            />
        </Col>
        <Col md={6}>
            <SortDeliveriesByDate
                sortOption={sortOption}
                setSortOption={setSortOption}
            />
        </Col>
      </Row>

      {deliveries.length === 0 && !loading && !error ? (
        <p className="text-center">No deliveries found.</p>
      ) : (
        <>
          <Row>
            {handleSort(deliveries).map((delivery, index) => {
              const isLastDelivery = deliveries.length === index + 1;
              const actualHours = parseFloat(delivery.Actual_Hours || 0);
              const plannedHours = parseFloat(delivery.Planned_Hours || 0);
              const progress = plannedHours > 0 ? (actualHours / plannedHours) * 100 : 0;

              return (
                <Col md={6} lg={4} className="mb-4" key={delivery.Key} ref={isLastDelivery ? lastDeliveryElementRef : null}>
                  {/* 💡 DEBUGGING RENDER: START WITH A MINIMAL RENDER 💡 */}
                  {/* Uncomment lines one by one to find the problematic element */}
                  <div>
                      Delivery Code: {delivery.DelCode_w_o__}
                      {/* <br />Client: {delivery.Client} */}
                      {/* <br />Project: {delivery.Project} */}
                      {/* <br />Task Details: {delivery.Task_Details} */}
                      {/* <br />Status: {delivery.Status} */}
                      {/* <br />Initiated: {delivery.Initiated_Timestamp} */}
                      {/* <br />Planned Delivery: {delivery.Planned_Delivery_Timestamp} */}
                      {/* <br />Progress: {Math.round(progress)}% */}
                  </div>

                  {/* 🛑 TEMPORARILY COMMENT OUT THE ENTIRE LINK/CARD BLOCK 🛑 */}
                  {/*
                  <Link to={`/delivery/${delivery.DelCode_w_o__}`} style={{ textDecoration: 'none' }}>
                    <Card className="h-100 delivery-card">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <Card.Title className="mb-1">{delivery.Client}</Card.Title>
                            <Card.Subtitle className="mb-2 text-muted">{delivery.Project}</Card.Subtitle>
                            <Card.Text>
                              <strong>Task:</strong> {delivery.Task_Details}
                              <br />
                              <strong>Status:</strong> {delivery.Status}
                            </Card.Text>
                          </div>
                          {userEmail === 'admin@brightbraintech.com' && ( // Only show delete button if admin
                              <DeleteButton
                                  deliveryCode={delivery.DelCode_w_o__}
                                  onDelete={handleDeliveryDelete}
                              />
                          )}
                        </div>
                        <div className="mt-auto">
                          <ProgressBar now={progress} label={`${Math.round(progress)}%`} className="mb-2" />
                          <div className="d-flex justify-content-between text-muted small">
                            <p className="mb-0">
                              <FiClock style={{ marginRight: '5px' }} /> {delivery.Initiated_Timestamp}
                            </p>
                            <p className="mb-0 text-danger">
                              <FiFlag style={{ marginRight: '5px' }} /> {delivery.Planned_Delivery_Timestamp}
                            </p>
                            <p
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(delivery.DelCode_w_o__);
                              }}
                              style={{ cursor: "pointer", color: "blue", textDecoration: "underline" }}
                              title="Click to copy"
                            >
                              {delivery.DelCode_w_o__}
                            </p>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Link>
                  */}
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
        </>
      )}
    </Container>
  );
};

export default DeliveryList;
