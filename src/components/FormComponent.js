import React, { useState, useEffect, useContext, memo } from 'react';

// --- Inlined UserContext (replaces external file) ---
// Provides a default value so the app doesn't crash without a provider.
const UserContext = React.createContext({ 
    userEmail: 'default.user@example.com' 
});
// --- End UserContext ---

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Define admin emails on the frontend
const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// --- Helper function for date formatting (replaces moment) ---
const formatDateForInput = (dateValue) => {
    if (!dateValue) return '';
    
    // dateValue can be an ISO string or a Date object
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    
    // Check for validity
    if (isNaN(date)) return '';

    // Format to 'YYYY-MM-DD' string required by input type="date"
    // Using simple concatenation as toLocaleDateString might be locale-dependent
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

// Wrap the component in React.memo for performance optimization.
const FormComponent = memo(({ onSubmit, task, currentUserEmail }) => {
    const { userEmail } = useContext(UserContext); // Use userEmail from context
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [formData, setFormData] = useState({
        Key: '',
        Delivery_code: '',
        DelCode_w_o__: '',
        Step_ID: 0,
        Task_Details: '',
        Planned_Start_Date: null, 
        Planned_Delivery_Timestamp: null,
        Responsibility: '',
    });

    const [persons, setPersons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingPersons, setLoadingPersons] = useState(false);
    const [error, setError] = useState('');

    // Populate form data when the task prop changes
    useEffect(() => {
        if (task) {
            console.log("Task data received in Form:", task);
            // Convert string dates to Date objects for consistent internal state
            const startDate = task.Planned_Start_Date ? new Date(task.Planned_Start_Date) : null;
            const deliveryDate = task.Planned_Delivery_Timestamp ? new Date(task.Planned_Delivery_Timestamp) : null;

            setFormData({
                Key: task.Key,
                Delivery_code: task.Delivery_code,
                DelCode_w_o__: task.DelCode_w_o__,
                Step_ID: task.Step_ID,
                Task_Details: task.Task_Details || '',
                Planned_Start_Date: startDate,
                Planned_Delivery_Timestamp: deliveryDate,
                Responsibility: task.Responsibility || '',
            });
        }
    }, [task]);

    // Fetch persons list
    useEffect(() => {
        setLoadingPersons(true);
        fetch(`${BACKEND_API_BASE_URL}/api/persons`)
            .then(res => res.json())
            .then(data => {
                // Ensure data is an array of objects with an Email field
                if (Array.isArray(data)) {
                    setPersons(data.filter(p => p.Email));
                }
                setLoadingPersons(false);
            })
            .catch(err => {
                console.error('Error fetching persons:', err);
                setError('Failed to load persons list.');
                setLoadingPersons(false);
            });
    }, []);

    // Handle standard input changes (for date and Responsibility select)
    const handleChange = (e) => {
        const { name, value } = e.target;
        
        let newValue = value;
        // For date inputs, convert the 'YYYY-MM-DD' string back to a Date object
        if (name === 'Planned_Start_Date' || name === 'Planned_Delivery_Timestamp') {
            newValue = value ? new Date(value) : null;
        }

        setFormData(prev => ({
            ...prev,
            [name]: newValue,
        }));
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Prepare data to send
        const submitData = {
            ...formData,
            // Format dates back to string (YYYY-MM-DD) for the API
            Planned_Start_Date: formData.Planned_Start_Date ? formatDateForInput(formData.Planned_Start_Date) : null,
            Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formatDateForInput(formData.Planned_Delivery_Timestamp) : null,
            userEmail: currentUserEmail, // Include the user's email
        };

        console.log("Submitting task update:", submitData);

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/tasks/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submitData),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to update task.');
            }

            const updatedTask = await response.json();
            
            // Pass the updated task object back to the parent
            onSubmit({
                ...updatedTask,
                // Pass back Date objects for the parent state
                Planned_Start_Date: formData.Planned_Start_Date,
                Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp,
            });

        } catch (err) {
            console.error('Error updating task:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Determine if fields should be disabled
    // A non-admin user can only edit if they are the responsible person
    const isFieldDisabledForNonAdmin = !isAdmin && task.Responsibility !== currentUserEmail;

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
            {/* Error Alert (Tailwind implementation) */}
            {error && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    {error}
                </div>
            )}
            
            {/* Start Date Field */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                    type="date"
                    name="Planned_Start_Date"
                    // Format Date object for display
                    value={formatDateForInput(formData.Planned_Start_Date)}
                    onChange={handleChange}
                    disabled={isFieldDisabledForNonAdmin}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
                />
            </div>

            {/* End Date Field */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    // Format Date object for display
                    value={formatDateForInput(formData.Planned_Delivery_Timestamp)}
                    onChange={handleChange} 
                    disabled={isFieldDisabledForNonAdmin}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
                />
            </div>

            {/* Person Responsible Field (Native Select) */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Person Responsible<span className="text-red-500">*</span>
                </label>
                <select
                    name="Responsibility"
                    value={formData.Responsibility}
                    onChange={handleChange}
                    // Only admins can change responsibility (or if the task is currently unassigned/assigned to the system)
                    disabled={!isAdmin || loadingPersons || isFieldDisabledForNonAdmin}
                    required
                    className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
                >
                    <option value="">{loadingPersons ? 'Loading Persons...' : 'Select Person'}</option>
                    {persons.map(person => (
                        <option key={person.Email} value={person.Email}>
                            {person.Email}
                        </option>
                    ))}
                </select>
            </div>

            {/* Submit Button */}
            <button 
                type="submit" 
                disabled={loading || isFieldDisabledForNonAdmin}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
                {loading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : 'Update Task'}
            </button>
        </form>
    );
});

export default FormComponent;
