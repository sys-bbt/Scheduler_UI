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
  const { userEmail, userName, logoutUser } = useContext(UserContext);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [clients, setClients] = useState([]); // State to store unique clients
  const [sortOption, setSortOption] = useState('latest'); // 'earliest' or 'latest'
  const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

  const navigate = useNavigate();

  // Function to fetch deliveries based on current filters and search query
  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${BACKEND_API_BASE_URL}/api/data?email=${encodeURIComponent(userEmail)}`;

      if (searchQuery) {
        url += `&searchQuery=${encodeURIComponent(searchQuery)}`;
      }
      if (selectedClient) {
        url += `&clientFilter=${encodeURIComponent(selectedClient)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch deliveries.');
      }
      const data = await response.json();

      // Extract unique clients from the fetched data
      const uniqueClients = [...new Set(data.map(delivery => delivery.Client))].filter(Boolean);
      setClients(uniqueClients);

      // Sort the data based on Initiated_Timestamp or Key
      const sortedData = [...data].sort((a, b) => {
        if (sortOption === 'latest') {
            // Sort by Key in descending order for "latest"
            // Assuming Key can be directly compared (e.g., numeric or lexicographically ordered string)
            return String(b.Key).localeCompare(String(a.Key));
        } else { // 'earliest'
            // Sort by Initiated_Timestamp for "earliest"
            const dateA = moment(a.Initiated_Timestamp || a.Created_at);
            const dateB = moment(b.Initiated_Timestamp || b.Created_at);

            if (!dateA.isValid() || !dateB.isValid()) {
                console.warn("Invalid date found during sorting. Falling back to original order for affected items.", a, b);
                return 0;
            }
            return dateA.diff(dateB);
        }
      });

      setDeliveries(sortedData);
    } catch (err) {
      console.error("Error fetching deliveries:", err);
      setError(err.message);
      setDeliveries([]); // Clear deliveries on error
    } finally {
      setLoading(false);
    }
  }, [userEmail, searchQuery, selectedClient, sortOption]); // Dependencies for useCallback

  // Debounced version of fetchDeliveries
  const debouncedFetchDeliveries = useCallback(
    debounce(fetchDeliveries, 500),
    [fetchDeliveries]
  );

  useEffect(() => {
    debouncedFetchDeliveries();
  }, [debouncedFetchDeliveries]); // Trigger fetch when debounced function changes

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
  };

  const handleDeleteSuccess = (deletedDeliveryCode) => {
    notification.success({
      message: 'Delivery Deleted',
      description: `Delivery with code ${deletedDeliveryCode} has been successfully deleted.`,
    });
    fetchDeliveries(); // Re-fetch deliveries to update the list
  };

  if (loading && deliveries.length === 0) { // Show spinner only if no data is loaded yet
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <FaSpinner
          className="spinner-icon"
          style={{ fontSize: '3rem', color: '#007bff', animation: 'spin 1.5s linear infinite' }}
        />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5 text-center">
        <h2>Error Loading Deliveries</h2>
        <p className="text-danger">{error}</p>
        <Button onClick={fetchDeliveries}>Retry</Button>
      </Container>
    );
  }

  return (
    <Container className="delivery-list-container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Deliveries</h2>
        <div className="d-flex align-items-center">
          {userEmail && <span className="me-3">Logged in as: <strong>{userName} ({userEmail})</strong></span>}
          <Button variant="outline-secondary" onClick={logoutUser}>Logout</Button>
        </div>
      </div>

      <Row className="mb-4 align-items-end">
        <Col md={6}>
          <Form.Group controlId="searchQuery">
            <Form.Label>Search Deliveries</Form.Label>
            <Form.Control
              type="text"
              placeholder="Search by task details or delivery code..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <FilterDeliveryBasedOnClientSelected
            clients={clients}
            onClientSelect={handleClientSelect}
            selectedClient={selectedClient}
          />
        </Col>
        <Col md={3}>
          <SortDeliveriesByDate
            sortOption={sortOption}
            setSortOption={setSortOption}
          />
        </Col>
      </Row>

      <Row xs={1} md={1} lg={1} className="g-4"> {/* Changed Col sizing to display one card per row */}
        {deliveries.length > 0 ? (
          deliveries.map((delivery) => {
            // Calculate progress based on Scheduled Tasks vs Total Tasks
            // IMPORTANT: 'Planned_Tasks' is assumed to be a field from your BigQuery data (Step_ID = 0 entry).
            // If this field is not available or named differently, you will need to adjust this.
            // If 'Planned_Tasks' needs to be derived (e.g., counting tasks with Planned_Start_Timestamp),
            // this calculation should ideally happen in the backend's /api/data endpoint for accuracy.
            const scheduledTasks = delivery.Planned_Tasks !== undefined ? delivery.Planned_Tasks : delivery.Completed_Tasks; // Fallback to Completed_Tasks if Planned_Tasks isn't provided
            const totalTasks = delivery.Total_Tasks || 1; // Avoid division by zero

            const progress = (scheduledTasks / totalTasks) * 100;

            let progressBarVariant = "primary";
            if (progress === 100) {
                progressBarVariant = "success";
            } else if (progress >= 50) { // Half or more planned
                progressBarVariant = "warning";
            } else { // Less than half planned
                progressBarVariant = "danger";
            }

            return (
              <Col key={delivery.Key}>
                <Link to={`/delivery/data/${encodeURIComponent(delivery.DelCode_w_o__)}`} className="text-decoration-none">
                  <Card className={`delivery-card h-100`}> {/* Removed isCompleted class as variant handles color */}
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <Card.Title className="mb-1">{delivery.Task_Details}</Card.Title>
                          <Card.Subtitle className="mb-2 text-muted">
                            {delivery.Client} - {delivery.Delivery_code}
                          </Card.Subtitle>
                        </div>
                        {isAdmin && (
                          <DeleteButton
                            deliveryCode={delivery.DelCode_w_o__}
                            onDelete={handleDeleteSuccess}
                          />
                        )}
                      </div>
                      <ProgressBar
                        now={progress}
                        label={`${Math.round(progress)}% (${scheduledTasks} of ${totalTasks} planned)`}
                        className="my-3"
                        variant={progressBarVariant} // Dynamic variant
                      />
                      <div className="d-flex justify-content-between align-items-center">
                        <p className="mb-0 text-primary">
                          <FiClock style={{ marginRight: '5px' }} /> {delivery.Time_Left_For_Next_Task_dd_hh_mm_ss || 'N/A'}
                        </p>
                        <p className="mb-0 text-success">
                          <FiCheckCircle style={{ marginRight: '5px' }} /> {delivery.Current_Status}
                        </p>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-2">
                        {/* Display Deadline date */}
                        <p className="mb-0 text-danger">
                          <FiFlag style={{ marginRight: '5px' }} /> Deadline: {delivery.Planned_Delivery_Timestamp ? moment(delivery.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : 'N/A'}
                        </p>
                        <p
                          onClick={(e) => {
                            e.stopPropagation();
                            const el = document.createElement('textarea');
                            el.value = delivery.DelCode_w_o__;
                            document.body.appendChild(el);
                            el.select();
                            document.execCommand('copy');
                            document.body.removeChild(el);
                          }}
                          style={{ cursor: "pointer", color: "blue", textDecoration: "underline" }}
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

      <div className="delivery-list-end"></div>

      {loading && deliveries.length > 0 && ( // Show spinner when loading more, but preserve existing data
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
