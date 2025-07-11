import React, { useEffect, useState, useContext } from 'react';
import { UserContext } from './UserContext'; // Correct: From src/components/ to src/components/UserContext.js
import { Link } from 'react-router-dom';
import './DeliveryList.css';

function DeliveryList() {
    const { userEmail } = useContext(UserContext);
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const limit = 500; // Number of items to fetch per request
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState('');
    const [allClients, setAllClients] = useState([]);
    const [sortOrder, setSortOrder] = useState('Earliest Initiated'); // New state for sort order

    console.log('DeliveryList: Current User Email:', userEmail, ', Is Admin:', userEmail && ["neelam.p@brightbraintech.com", "meghna.j@brightbraintech.com", "zoya.a@brightbraintech.com", "shweta.g@brightbraintech.com", "hitesh.r@brightbraintech.com"].includes(userEmail));

    // Function to fetch clients
    const fetchClients = async () => {
        try {
            const baseUrl = process.env.NODE_ENV === 'production'
                ? 'https://server-ui-2.onrender.com'
                : 'http://localhost:3001';
            const response = await fetch(`${baseUrl}/api/persons`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setAllClients(['', ...data]); // Add empty option for 'All Clients'
        } catch (err) {
            console.error("Error fetching clients:", err);
            // Optionally set an error state for clients here if you want to display it
        }
    };

    // Refactored data fetching function
    const fetchData = async (currentOffset, newSearchTerm = searchTerm, newSelectedClient = selectedClient, append = false) => {
        if (!userEmail) {
            console.log('DeliveryList: userEmail not yet available for initial fetch.');
            setLoading(false);
            return;
        }

        const isAdmin = userEmail && ["neelam.p@brightbraintech.com", "meghna.j@brightbraintech.com", "zoya.a@brightbraintech.com", "shweta.g@brightbraintech.com", "hitesh.r@brightbraintech.com"].includes(userEmail);

        setLoading(true);
        setError(null);

        try {
            const baseUrl = process.env.NODE_ENV === 'production'
                ? 'https://server-ui-2.onrender.com'
                : 'http://localhost:3001';

            let url = `${baseUrl}/api/data?email=${encodeURIComponent(userEmail)}&offset=${currentOffset}&limit=${limit}&isAdmin=${isAdmin}`;

            if (newSearchTerm) {
                url += `&searchTerm=${encodeURIComponent(newSearchTerm)}`;
            }
            if (newSelectedClient) {
                url += `&selectedClient=${encodeURIComponent(newSelectedClient)}`;
            }

            console.log(`DeliveryList: Fetching data for page ${currentOffset / limit} with email: ${userEmail}, isAdmin: ${isAdmin}, Search: "${newSearchTerm}", Client: "${newSelectedClient}"`);
            const response = await fetch(url);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || response.statusText}`);
            }
            const data = await response.json();

            if (append) {
                setDeliveries(prevDeliveries => {
                    const newDeliveries = data.filter(newItem =>
                        !prevDeliveries.some(existingItem => existingItem.Key === newItem.Key)
                    );
                    return [...prevDeliveries, ...newDeliveries];
                });
            } else {
                setDeliveries(data);
            }

            setHasMore(data.length === limit); // If we get less than 'limit', there are no more pages
            console.log(`DeliveryList: Fetched ${data.length} deliveries.`);
            if (data.length === 0 && !append) {
                console.log('No new deliveries to load, stopping further fetch.');
            }
        } catch (err) {
            console.error("DeliveryList: Error fetching data:", err);
            setError('Failed to load deliveries. Please try again.');
            setHasMore(false); // Stop trying to load more on error
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch on component mount or userEmail change
    useEffect(() => {
        fetchClients(); // Fetch clients when component mounts
        setOffset(0); // Reset offset
        setDeliveries([]); // Clear existing deliveries
        fetchData(0, '', '', false); // Initial fetch, not appending
    }, [userEmail]); // Dependency on userEmail to re-fetch when user context changes

    // Handle load more
    const handleLoadMore = () => {
        if (!loading && hasMore) {
            const newOffset = offset + limit;
            setOffset(newOffset);
            fetchData(newOffset, searchTerm, selectedClient, true);
        }
    };

    // Handle search or filter change
    const handleSearchOrFilter = () => {
        setOffset(0); // Reset offset for new search/filter
        setDeliveries([]); // Clear current deliveries
        fetchData(0, searchTerm, selectedClient, false); // Fetch new data, not appending
    };

    // Filter deliveries based on Step_ID = 0 (Workflow)
    const workflowDeliveries = deliveries.filter(delivery => delivery.Step_ID === 0);
    
    // Sort logic
    const sortedDeliveries = [...workflowDeliveries].sort((a, b) => {
        // Assuming 'Created_at' or similar timestamp field exists for sorting
        // Adjust field names based on your BigQuery schema
        if (sortOrder === 'Earliest Initiated') {
            return new Date(a.Created_at) - new Date(b.Created_at);
        } else if (sortOrder === 'Latest Initiated') {
            return new Date(b.Created_at) - new Date(a.Created_at);
        }
        return 0; // No sort
    });

    return (
        <div className="delivery-list-container">
            <header className="delivery-list-header">
                <h1>List of Deliveries</h1>
                <div className="header-right">
                    <span className="logged-in-as">Logged in as: {userEmail}</span>
                    <button className="logout-button">Logout</button> {/* Add logout functionality */}
                </div>
            </header>

            <div className="controls-section">
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search for delivery code or client..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSearchOrFilter();
                        }}
                    />
                    <button onClick={handleSearchOrFilter} className="search-button">
                        🔍
                    </button>
                </div>

                <div className="filters-sort">
                    <div className="filter-client">
                        <label htmlFor="client-select">Filter by Client</label>
                        <select
                            id="client-select"
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                        >
                            {allClients.map((client, index) => (
                                <option key={index} value={client}>{client === '' ? 'All Clients' : client}</option>
                            ))}
                        </select>
                        <button onClick={handleSearchOrFilter} className="apply-filter-button">Apply</button>
                    </div>

                    <div className="sort-order">
                        <label htmlFor="sort-select">Sort by Date</label>
                        <select
                            id="sort-select"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option value="Earliest Initiated">Earliest Initiated</option>
                            <option value="Latest Initiated">Latest Initiated</option>
                        </select>
                    </div>
                </div>
            </div>

            <main className="deliveries-main">
                {loading && deliveries.length === 0 && <div className="loading-message">Loading deliveries...</div>}
                {error && <div className="error-message">Error: {error}</div>}

                {!loading && !error && sortedDeliveries.length === 0 && (
                    <div className="no-deliveries-message">No active deliveries (showing unique workflows).</div>
                )}

                {!loading && !error && sortedDeliveries.length > 0 && (
                    <p className="active-deliveries-count">
                        You have {sortedDeliveries.length} active deliveries (showing unique workflows)
                    </p>
                )}

                <div className="deliveries-grid">
                    {sortedDeliveries.map(delivery => (
                        // Use Link to navigate to the Tasklist page
                        <Link
                            key={delivery.Key} // Ensure Key is unique for each delivery
                            to={`/delivery/data/${encodeURIComponent(delivery.DelCode_w_o__)}`}
                            className="delivery-card"
                        >
                            <div className="status-indicator">
                                <span className="status-icon">✅</span>
                                <span className="status-text">of Planned</span>
                            </div>
                            <div className="delivery-info">
                                <h3 className="delivery-code">{delivery.Delivery_code}</h3>
                                <p className="short-description">{delivery.Short_Description}</p>
                                <p className="current-step">Current Step: {delivery.Step_Details || 'N/A'}</p>
                            </div>
                            <div className="delivery-meta">
                                <span className="no-start-time">
                                    <span className="icon">🕒</span> No start time
                                </span>
                                <span className="flag-icon">🚩</span>
                            </div>
                        </Link>
                    ))}
                </div>

                {hasMore && !loading && !error && (
                    <button onClick={handleLoadMore} className="load-more-button">Load More</button>
                )}
            </main>
        </div>
    );
}

export default DeliveryList;
