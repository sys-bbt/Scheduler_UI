import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { Container, Row, Col, Card, ProgressBar, Form, Button, Spinner, Alert, ListGroup } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import 'rc-dropdown/assets/index.css';

// --- Single File Constraint Fixes ---
// 1. Replaced react-icons/fa, react-icons/fi with Emojis/CSS Spinner
// 2. Replaced moment with native Date/Intl methods
// 3. Merged all components (Context, Filters, DeleteButton, FormComponent, DeliveryDetail, DeliveryList) into this single file.
// 4. Used conditional rendering instead of react-router-dom for single-page flow.

// Helper function to format date without moment
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Use Intl for better date formatting if needed, but simple slicing is often enough for YYYY-MM-DD
    const date = new Date(timestamp);
    if (isNaN(date)) return 'N/A';
    return date.toISOString().split('T')[0];
};

// --- CONSTANTS AND MOCK DATA/CONTEXT ---
const BACKEND_API_BASE_URL = 'http://localhost:3001'; // Mock URL
const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// 1. UserContext (Replacement for ./UserContext)
const UserContext = React.createContext({ userEmail: ADMIN_EMAILS_FRONTEND[0], userName: 'Admin User' }); // Mock default admin user

// Debounce utility function
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

// Placeholder for notification from antd (using console log/Alert instead)
const showNotification = (type, message, description) => {
    console.log(`Notification (${type}): ${message} - ${description}`);
    // In a real app, you'd use a UI component here. We'll use a simple Alert state.
};

// --- HELPER COMPONENTS (Merged from separate files) ---

// 2. DeleteButton (Replacement for ./DeleteButton)
const DeleteButton = ({ delivery, onDeleteSuccess }) => {
    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete delivery code ${delivery.DelCode_w_o__}?`)) {
            return;
        }

        try {
            console.log('Attempting to delete:', delivery.Delivery_Code);
            // Mock API call
            await new Promise(resolve => setTimeout(resolve, 500));

            onDeleteSuccess(delivery.Delivery_Code);
            showNotification('success', 'Delete Successful', `Delivery ${delivery.DelCode_w_o__} has been removed.`);
        } catch (error) {
            console.error('Delete failed:', error);
            showNotification('error', 'Delete Failed', `Could not delete delivery ${delivery.DelCode_w_o__}.`);
        }
    };

    return (
        <Button variant="danger" size="sm" onClick={handleDelete} className="ml-2">
            Delete
        </Button>
    );
};

// 3. FilterDeliveryBasedOnClientSelected (Replacement for ./FilterDeliveryBasedOnClientSelected)
const FilterDeliveryBasedOnClientSelected = ({ clients, selectedClient, onClientSelect, onClearFilter }) => (
    <Form.Group controlId="clientFilter" className="mb-3">
        <Form.Label>Filter by Client</Form.Label>
        <Form.Select value={selectedClient} onChange={(e) => onClientSelect(e.target.value)}>
            <option value="">All Clients</option>
            {clients.map(client => (
                <option key={client} value={client}>{client}</option>
            ))}
        </Form.Select>
        {selectedClient && (
            <Button variant="outline-secondary" size="sm" className="mt-2" onClick={onClearFilter}>
                Clear Filter
            </Button>
        )}
    </Form.Group>
);

// 4. SortDeliveriesByDate (Replacement for ./SortDeliveriesByDate)
const SortDeliveriesByDate = ({ sortType, onSortChange }) => (
    <Form.Group controlId="sortOrder" className="mb-3">
        <Form.Label>Sort Order</Form.Label>
        <Form.Select value={sortType} onChange={(e) => onSortChange(e.target.value)}>
            <option value="asc">Earliest Delivery First (ASC)</option>
            <option value="desc">Latest Delivery First (DESC)</option>
        </Form.Select>
    </Form.Group>
);

// 5. FormComponent (Replacement for ./FormComponent)
const FormComponent = ({ onSubmit, task, currentUserEmail }) => {
    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [formData, setFormData] = useState({
        Key: task?.Key || '',
        Planned_Delivery_Timestamp: new Date(task?.Planned_Delivery_Timestamp || Date.now()),
        Responsibility: task?.Responsibility || '',
        Schedule_Details: task?.Schedule_Details || '',
        // Initialize other fields based on the task structure, but keeping it minimal for the fix
    });
    const [loading, setLoading] = useState(false);
    const [personsToDisplay, setPersonsToDisplay] = useState([
        { value: 'user@example.com', label: 'User Example' },
        { value: 'systems@brightbraintech.com', label: 'Systems' }
    ]);

    const isFieldDisabledForNonAdmin = task?.Responsibility !== 'systems@brightbraintech.com' && task?.Responsibility !== '';
    const selectedPerson = personsToDisplay.find(p => p.value === formData.Responsibility) || null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePersonSelect = (selectedOption) => {
        setFormData(prev => ({ ...prev, Responsibility: selectedOption ? selectedOption.value : '' }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        // Mock submission logic
        setTimeout(() => {
            onSubmit(formData);
            setLoading(false);
        }, 1000);
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
                <Form.Label>Schedule Details (Optional)</Form.Label>
                <Form.Control
                    as="textarea"
                    rows={3}
                    name="Schedule_Details"
                    value={formData.Schedule_Details}
                    onChange={handleChange}
                    disabled={loading || isFieldDisabledForNonAdmin}
                    placeholder="Enter any specific scheduling details or notes."
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Planned Delivery Date</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    // Use native JS date formatting
                    value={formatDate(formData.Planned_Delivery_Timestamp)}
                    readOnly
                    disabled={true}
                />
            </Form.Group>

            {/* Using a standard select for the mock to avoid external react-select dependency */}
            <Form.Group className="mb-3">
                <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                <Form.Select
                    name="Responsibility"
                    value={formData.Responsibility}
                    onChange={handleChange}
                    disabled={!isAdmin || loading || isFieldDisabledForNonAdmin}
                    required
                >
                    <option value="">Select Person</option>
                    {personsToDisplay.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </Form.Select>
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || isFieldDisabledForNonAdmin}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
        </Form>
    );
};

// 6. DeliveryDetail Component (Replacement for delivery details.txt view)
const DeliveryDetail = ({ delivery, navigateToHome }) => {
    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [loading, setLoading] = useState(false);
    const [actionType, setActionType] = useState(null); // 'edit' or 'action'
    const [activeTaskKey, setActiveTaskKey] = useState(null);

    const handleActionClick = (key, type) => {
        setActiveTaskKey(key);
        setActionType(type);
    };

    const handleTaskAction = async (taskKey, action) => {
        console.log(`Task ${taskKey} action: ${action}`);
        // Mock API call for task action
        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            showNotification('info', 'Task Action', `${action} submitted for task ${taskKey}.`);
            // In a real app, you'd update the delivery state here
        } catch (error) {
            showNotification('error', 'Task Action Failed', 'Could not perform task action.');
        } finally {
            setLoading(false);
            setActiveTaskKey(null);
            setActionType(null);
        }
    };

    const handleFormSubmit = (formData) => {
        console.log('Form submitted with data:', formData);
        // Mock API call for form update
        handleTaskAction(formData.Key, 'Update Schedule');
    };

    const menu = (task) => (
        <Menu onClick={({ key }) => handleTaskAction(task.Key, key)}>
            <MenuItem key="Start" disabled={task.Status === 'InProgress'}>
                {/* ⏯️ or use simple text */}
                Start Task
            </MenuItem>
            <MenuItem key="Pause" disabled={task.Status === 'Paused' || task.Status === 'Completed'}>
                {/* ⏸️ */}
                Pause Task
            </MenuItem>
            <MenuItem key="Stop" disabled={task.Status === 'Completed'}>
                {/* ⏹️ */}
                Stop/Complete Task
            </MenuItem>
            {isAdmin && (
                <MenuItem key="edit" onClick={(e) => { e.domEvent.stopPropagation(); handleActionClick(task.Key, 'edit'); }}>
                    {/* ✏️ */}
                    Edit Schedule
                </MenuItem>
            )}
        </Menu>
    );

    const COMPLETED_TASK_STATUS = 'Completed';
    const filteredTasks = delivery.Tasks.filter(task => task.Status !== COMPLETED_TASK_STATUS);

    return (
        <Container className="my-5">
            <h2 className="text-xl font-bold mb-4">Delivery Details: {delivery.DelCode_w_o__}</h2>
            <p><strong>Client:</strong> {delivery.Client}</p>
            <p><strong>Planned Delivery:</strong> {formatDate(delivery.Planned_Delivery_Date)}</p>

            <Row className="mt-4">
                {filteredTasks.length > 0 ? (
                    filteredTasks.map((task, index) => {
                        const statusColor = task.Status === 'InProgress' ? 'border-primary' :
                            task.Status === 'Completed' ? 'border-success' : 'border-warning';

                        return (
                            <Col md={6} lg={4} key={task.Key} className="mb-4">
                                <Card className={`shadow-sm ${statusColor}`}>
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h5 className="text-lg font-semibold">{task.Task_Details}</h5>
                                            <span className={`badge ${task.Status === 'Completed' ? 'bg-success' : task.Status === 'InProgress' ? 'bg-primary' : 'bg-warning'}`}>
                                                {task.Status}
                                            </span>
                                        </div>
                                        <p className="text-sm mb-1">
                                            <strong>Person:</strong> {task.Responsibility}
                                        </p>
                                        <p className="text-sm mb-3">
                                            <strong>Planned:</strong> {formatDate(task.Planned_Delivery_Timestamp)}
                                        </p>

                                        <div className="d-flex justify-content-end">
                                            <Dropdown
                                                trigger={['click']}
                                                overlay={menu(task)}
                                                animation="slide-up"
                                                placement="bottomRight"
                                            >
                                                <Button variant="outline-secondary" size="sm">
                                                    {/* Using an emoji for the icon */}
                                                    ⋮
                                                </Button>
                                            </Dropdown>
                                        </div>

                                        {/* Display FormComponent ONLY if the task is the active one and the action is 'edit' */}
                                        {activeTaskKey === task.Key && actionType === 'edit' && (
                                            <div className="mt-3">
                                                <h6>Schedule Task: {task.Task_Details}</h6>
                                                <FormComponent
                                                    onSubmit={handleFormSubmit}
                                                    task={task}
                                                    currentUserEmail={userEmail}
                                                />
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })
                ) : (
                    <Col>
                        <ListGroup.Item>No active tasks available for this delivery.</ListGroup.Item>
                    </Col>
                )}
            </Row>

            <Button variant="primary" className="mt-4" onClick={navigateToHome}>
                Back to Deliveries
            </Button>
        </Container>
    );
};


// 7. DeliveryList Component (Replacement for Delivery list.txt view)
const DeliveryList = ({ onDeliverySelect, onDeliveryDataUpdate }) => {
    const { userEmail } = useContext(UserContext);
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState('');
    const [sortType, setSortType] = useState('asc'); // 'asc' or 'desc'
    const [clients, setClients] = useState([]);

    // Mock initial data fetching
    useEffect(() => {
        const mockFetch = async () => {
            setLoading(true);
            try {
                // Mock API call to fetch deliveries
                await new Promise(resolve => setTimeout(resolve, 1500));
                const mockData = [
                    { Delivery_Code: 'D123', DelCode_w_o__: '123', Client: 'Client A', Planned_Delivery_Date: new Date(Date.now() + 86400000).toISOString(), Progress: 50, Status: 'InProgress', Tasks: [{ Key: 'T1', Task_Details: 'Design', Responsibility: 'systems@brightbraintech.com', Status: 'InProgress', Planned_Delivery_Timestamp: new Date(Date.now() + 86400000).toISOString() }] },
                    { Delivery_Code: 'D456', DelCode_w_o__: '456', Client: 'Client B', Planned_Delivery_Date: new Date(Date.now() + 3 * 86400000).toISOString(), Progress: 10, Status: 'NotStarted', Tasks: [{ Key: 'T2', Task_Details: 'Testing', Responsibility: 'user@example.com', Status: 'Pending', Planned_Delivery_Timestamp: new Date(Date.now() + 3 * 86400000).toISOString() }] },
                    { Delivery_Code: 'D789', DelCode_w_o__: '789', Client: 'Client A', Planned_Delivery_Date: new Date(Date.now() - 86400000).toISOString(), Progress: 100, Status: 'Completed', Tasks: [{ Key: 'T3', Task_Details: 'Deploy', Responsibility: 'user@example.com', Status: 'Completed', Planned_Delivery_Timestamp: new Date(Date.now() - 86400000).toISOString() }] },
                ];
                setDeliveries(mockData);
                const uniqueClients = [...new Set(mockData.map(d => d.Client))].sort();
                setClients(uniqueClients);
                onDeliveryDataUpdate(mockData); // Update parent state with fetched data
            } catch (err) {
                setError('Failed to fetch deliveries.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        mockFetch();
    }, [onDeliveryDataUpdate]);

    // Handlers
    const handleSearchChange = useMemo(() => debounce(setSearchTerm, 300), []);
    const handleClientSelect = (client) => setSelectedClient(client);
    const handleClearFilter = () => setSelectedClient('');
    const handleSortChange = (sort) => setSortType(sort);

    const handleDeleteSuccess = useCallback((deletedCode) => {
        setDeliveries(prev => prev.filter(d => d.Delivery_Code !== deletedCode));
    }, []);

    // Filter and Sort Logic
    const filteredAndSortedDeliveries = useMemo(() => {
        let filtered = deliveries.filter(delivery => {
            const matchesSearch = delivery.DelCode_w_o__.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 delivery.Client.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClient = !selectedClient || delivery.Client === selectedClient;
            return matchesSearch && matchesClient;
        });

        filtered.sort((a, b) => {
            const dateA = new Date(a.Planned_Delivery_Date);
            const dateB = new Date(b.Planned_Delivery_Date);
            if (sortType === 'asc') {
                return dateA - dateB;
            } else {
                return dateB - dateA;
            }
        });

        return filtered;
    }, [deliveries, searchTerm, selectedClient, sortType]);

    // Icon helper function (using Emojis)
    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed':
                return <span role="img" aria-label="Completed" className="text-green-500">✅</span>; // CheckCircle
            case 'InProgress':
                return <span role="img" aria-label="In Progress" className="text-blue-500">🕒</span>; // Clock
            case 'NotStarted':
            default:
                return <span role="img" aria-label="Not Started" className="text-red-500">🚩</span>; // Flag
        }
    };

    return (
        <Container className="my-5">
            <h1 className="text-2xl font-bold mb-4">Delivery List ({deliveries.length})</h1>

            {error && <Alert variant="danger">{error}</Alert>}

            <Row className="mb-4 bg-gray-100 p-4 rounded-lg shadow-inner">
                <Col md={4} className="mb-3">
                    <Form.Group controlId="searchBar">
                        <Form.Label>Search Delivery Code/Client</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Type to search..."
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </Form.Group>
                </Col>
                <Col md={4} className="mb-3">
                    <FilterDeliveryBasedOnClientSelected
                        clients={clients}
                        selectedClient={selectedClient}
                        onClientSelect={handleClientSelect}
                        onClearFilter={handleClearFilter}
                    />
                </Col>
                <Col md={4} className="mb-3">
                    <SortDeliveriesByDate
                        sortType={sortType}
                        onSortChange={handleSortChange}
                    />
                </Col>
            </Row>

            {loading && deliveries.length === 0 && (
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </div>
            )}

            <Row>
                {filteredAndSortedDeliveries.length > 0 ? (
                    filteredAndSortedDeliveries.map(delivery => {
                        const progressVariant = delivery.Progress < 50 ? 'danger' : delivery.Progress < 100 ? 'warning' : 'success';

                        return (
                            <Col md={6} lg={4} key={delivery.Delivery_Code} className="mb-4">
                                {/* Use simple click handler instead of Link */}
                                <Card
                                    className="shadow-md hover:shadow-lg transition cursor-pointer h-full"
                                    onClick={() => onDeliverySelect(delivery)}
                                >
                                    <Card.Body>
                                        <div className="flex justify-between items-start mb-2">
                                            <h5 className="text-xl font-bold text-blue-700">
                                                {getStatusIcon(delivery.Status)} {delivery.Client}
                                            </h5>
                                            {isAdmin && (
                                                <DeleteButton delivery={delivery} onDeleteSuccess={handleDeleteSuccess} />
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-500 mb-1">
                                            Planned Date: <strong>{formatDate(delivery.Planned_Delivery_Date)}</strong>
                                        </p>

                                        <ProgressBar now={delivery.Progress} label={`${delivery.Progress}%`} variant={progressVariant} className="mb-3" />

                                        <div className="flex justify-between items-center mt-2">
                                            <p
                                                className="text-sm text-blue-600 font-medium hover:text-blue-800"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent card click
                                                    // Mock copy to clipboard functionality
                                                    navigator.clipboard.writeText(delivery.DelCode_w_o__).then(() => {
                                                        showNotification('info', 'Copied!', `Code ${delivery.DelCode_w_o__} copied to clipboard.`);
                                                    });
                                                }}
                                                style={{ cursor: "pointer", textDecoration: "underline" }}
                                                title="Click to copy"
                                            >
                                                Code: {delivery.DelCode_w_o__}
                                            </p>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })
                ) : (
                    <Col>
                        <p className="text-center">No deliveries found matching your criteria.</p>
                    </Col>
                )}
            </Row>

            {loading && deliveries.length > 0 && (
                <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
                    {/* Simple CSS Spinner as FaSpinner replacement */}
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}
        </Container>
    );
};


// 8. Main App Component to handle routing
const App = () => {
    const [view, setView] = useState('list'); // 'list' or 'detail'
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [allDeliveries, setAllDeliveries] = useState([]); // State to hold all delivery data

    const handleDeliverySelect = useCallback((delivery) => {
        setSelectedDelivery(delivery);
        setView('detail');
    }, []);

    const navigateToHome = useCallback(() => {
        setView('list');
        setSelectedDelivery(null);
    }, []);

    // Function to update the parent state with the fetched delivery data
    const handleDeliveryDataUpdate = useCallback((data) => {
        setAllDeliveries(data);
    }, []);

    return (
        <UserContext.Provider value={{ userEmail: ADMIN_EMAILS_FRONTEND[0], userName: 'Admin User' }}>
            <div className="App min-h-screen bg-gray-50">
                <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
                    <h1 className="text-3xl font-extrabold text-gray-900 text-center">Delivery Management System</h1>
                </header>
                <main className="pb-10">
                    {view === 'list' && (
                        <DeliveryList
                            onDeliverySelect={handleDeliverySelect}
                            onDeliveryDataUpdate={handleDeliveryDataUpdate}
                        />
                    )}
                    {view === 'detail' && selectedDelivery && (
                        <DeliveryDetail
                            delivery={selectedDelivery}
                            navigateToHome={navigateToHome}
                        />
                    )}
                </main>
                {/* Tailwind CSS spinner animation (for FaSpinner replacement) */}
                <style>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .animate-spin {
                        animation: spin 1s linear infinite;
                    }
                `}</style>
            </div>
        </UserContext.Provider>
    );
};

export default App;
