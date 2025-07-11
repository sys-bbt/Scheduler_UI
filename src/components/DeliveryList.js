// src/components/DeliveryList.js
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, ProgressBar, Form } from 'react-bootstrap';
import { FiClock, FiCheckCircle, FiFlag } from 'react-icons/fi';
import { FaSpinner } from 'react-icons/fa';
// REMOVED these imports as LoginComponent from UserContext will handle GoogleLogin
// import { GoogleLogin } from '@react-oauth/google';
// import { jwtDecode } from 'jwt-decode';
import { UserContext, LoginComponent } from './UserContext'; // <-- IMPORT LoginComponent here
import './DeliveryList.css';
import FilterDeliveryBasedOnClientSelected from './FilterDeliveryBasedOnClientSelected';
import SortDeliveriesByDate from './SortDeliveriesByDate';
import DeleteButton from './DeleteButton';

const ADMIN_EMAILS = [
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

const DeliveryList = () => {
    const { userEmail } = useContext(UserContext); // Only need userEmail here
    const [deliveries, setDeliveries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [selectedClient, setSelectedClient] = useState('');
    const [loading, setLoading] = useState(false);
    const observer = useRef(null);

    const [sortOption, setSortOption] = useState('earliest'); // Default: 'earliest'

    const isAdmin = ADMIN_EMAILS.includes(userEmail); // Determine admin status

    const handleSort = (deliveriesToSort) => {
        return deliveriesToSort.sort((a, b) => {
            const dateA = new Date(a.Initiated_Timestamp);
            const dateB = new Date(b.Initiated_Timestamp);

            if (sortOption === 'earliest') {
                return dateA - dateB;
            } else {
                return dateB - dateA;
            }
        });
    };

    const fetchDeliveries = useCallback(async (pageNumber, currentDeliveries = []) => {
        if (!userEmail) { // Crucial: Don't fetch if email isn't available
            console.warn("User email not available, skipping data fetch for DeliveryList.");
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pageNumber,
                limit: 10,
                email: userEmail, // Pass user email to backend
            });
            if (searchTerm) params.append('search', searchTerm);
            if (selectedClient) params.append('client', selectedClient);

            const response = await fetch(`https://server-ui-2.onrender.com/api/data?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Filter out duplicate deliveries (assuming DelCode_w_o__ is unique for top-level entries)
            // Ensure only Step_ID = 0 are added for new fetches, unless we are on subsequent pages
            const newUniqueDeliveries = data.filter(newItem => {
                if (pageNumber === 0) {
                    return newItem.Step_ID === 0 && !currentDeliveries.some(existingItem => existingItem.DelCode_w_o__ === newItem.DelCode_w_o__);
                }
                return !currentDeliveries.some(existingItem => existingItem.DelCode_w_o__ === newItem.DelCode_w_o__);
            });

            if (pageNumber === 0) {
                setDeliveries(handleSort(newUniqueDeliveries));
            } else {
                setDeliveries(prevDeliveries => handleSort([...prevDeliveries, ...newUniqueDeliveries]));
            }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching deliveries:', error);
            setLoading(false);
        }
    }, [searchTerm, selectedClient, userEmail, sortOption]);

    useEffect(() => {
        setDeliveries([]); // Clear existing deliveries
        setPage(0); // Reset page to 0 for new search/filter
    }, [searchTerm, selectedClient]);

    useEffect(() => {
        if (userEmail) { // Only fetch if userEmail is available
            fetchDeliveries(page);
        }
    }, [page, fetchDeliveries, userEmail]);

    // Infinite scroll logic
    const lastDeliveryElementRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading]);

    const handleDeleteDelivery = (deletedDeliveryCode) => {
        setDeliveries(prevDeliveries =>
            prevDeliveries.filter(delivery => delivery.DelCode_w_o__ !== deletedDeliveryCode)
        );
    };

    const uniqueClients = [...new Set(deliveries.map(delivery => delivery.Client))];

    if (!userEmail) {
        return (
            <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                {/* Render LoginComponent from UserContext when user is not logged in */}
                <LoginComponent /> {/* <-- RENDER LoginComponent here */}
            </Container>
        );
    }

    return (
        <Container className="delivery-list-container">
            <h1 className="my-4 text-center">Delivery Management</h1>

            <Form.Group className="mb-3">
                <Form.Control
                    type="text"
                    placeholder="Search by Task Details or Delivery Code"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </Form.Group>

            <FilterDeliveryBasedOnClientSelected
                clients={uniqueClients}
                selectedClient={selectedClient}
                setSelectedClient={setSelectedClient}
            />

            <SortDeliveriesByDate sortOption={sortOption} setSortOption={setSortOption} />

            {deliveries.length === 0 && !loading ? (
                <p className="text-center">No deliveries found.</p>
            ) : (
                <>
                    <Row>
                        {handleSort(deliveries).map((delivery, index) => {
                            const actualHours = parseFloat(delivery.Task_Duration_In_Minutes) || 0;
                            const plannedHours = parseFloat(delivery.Planned_Hours) || 1;
                            const progress = (actualHours / plannedHours) * 100;

                            const isLastDelivery = deliveries.length === index + 1;

                            return (
                                <Col md={6} lg={4} className="mb-4" key={delivery.Key} ref={isLastDelivery ? lastDeliveryElementRef : null}>
                                    <Link to={`/data/${delivery.DelCode_w_o__}`} style={{ textDecoration: 'none' }}>
                                        <Card className="h-100 delivery-card">
                                            <div className="shaded-bg" style={{ width: `${Math.min(100, progress)}%` }}></div>
                                            <Card.Body>
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <Card.Title className="mb-0">{delivery.Client}</Card.Title>
                                                    {isAdmin && (
                                                        <DeleteButton deliveryCode={delivery.DelCode_w_o__} onDelete={handleDeleteDelivery} isAdmin={isAdmin} />
                                                    )}
                                                </div>
                                                <Card.Subtitle className="mb-2 text-muted">{delivery.Project}</Card.Subtitle>
                                                <Card.Text>
                                                    <strong>Task:</strong> {delivery.Task_Details}
                                                </Card.Text>
                                                <ProgressBar now={progress} className="mb-2 progress-bar" />
                                                <div className="d-flex justify-content-between text-muted small">
                                                    <span>{Math.round(progress)}% Complete</span>
                                                    <span>{actualHours}/{plannedHours} Hrs</span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center mt-3">
                                                    <p className="mb-0 text-success">
                                                        <FiCheckCircle style={{ marginRight: '5px' }} /> {delivery.Status}
                                                    </p>
                                                    <p className="mb-0 text-primary">
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
                </>
            )}
        </Container>
    );
};

export default DeliveryList;
