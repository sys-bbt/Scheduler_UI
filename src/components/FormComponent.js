import React, { useState, useEffect, useContext, memo } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import Select from 'react-select';
import moment from 'moment';
import { UserContext } from './UserContext'; // Import UserContext

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

// Wrap the component in React.memo for performance optimization.
// It will only re-render if its props (onSubmit, task, etc.) change.
const FormComponent = memo(({ onSubmit, task, currentUserEmail }) => {
    const { userEmail } = useContext(UserContext); // Use userEmail from context
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

    const [formData, setFormData] = useState({
        Key: '',
        Delivery_code: '',
        DelCode_w_o__: '',
        Step_ID: 0,
        Task_Details: '',
        Frequency___Timeline: '',
        Client: '',
        Short_Description: '',
        // REQ 2: Use moment objects for date fields
        Planned_Start_Date: null, 
        Planned_Delivery_Timestamp: null,
        Responsibility: '',
    });

    const [persons, setPersons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingPersons, setLoadingPersons] = useState(false);
    const [error, setError] = useState('');
    
    // Derived state for the Select component
    const [selectedPerson, setSelectedPerson] = useState(null);

    // Populate form data when the task prop changes
    useEffect(() => {
        if (task) {
            console.log("Task data received in Form:", task);
            const startDate = task.Planned_Start_Date ? moment(task.Planned_Start_Date) : null;
            const deliveryDate = task.Planned_Delivery_Timestamp ? moment(task.Planned_Delivery_Timestamp) : null;

            setFormData({
                Key: task.Key,
                Delivery_code: task.Delivery_code,
                DelCode_w_o__: task.DelCode_w_o__,
                Step_ID: task.Step_ID,
                Task_Details: task.Task_Details || '',
                Frequency___Timeline: task.Frequency___Timeline || '',
                Client: task.Client || '',
                Short_Description: task.Short_Description || '',
                Planned_Start_Date: startDate,
                Planned_Delivery_Timestamp: deliveryDate,
                Responsibility: task.Responsibility || '',
            });

            // Set the selectedPerson state for the react-select component
            if (task.Responsibility) {
                setSelectedPerson({ label: task.Responsibility, value: task.Responsibility });
            } else {
                setSelectedPerson(null);
            }
        }
    }, [task]);

    // Fetch persons list
    useEffect(() => {
        setLoadingPersons(true);
        fetch(`${BACKEND_API_BASE_URL}/api/persons`)
            .then(res => res.json())
            .then(data => {
                setPersons(data);
                setLoadingPersons(false);
            })
            .catch(err => {
                console.error('Error fetching persons:', err);
                setError('Failed to load persons list.');
                setLoadingPersons(false);
            });
    }, []);

    // Memoize the options for the Select component
    const personsToDisplay = React.useMemo(() => {
        return persons.map(person => ({
            value: person.Email,
            label: person.Email,
        }));
    }, [persons]);

    // Handle standard input changes
    const handleChange = (e) => {
        const { name, value }_ = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    // Handle date changes
    const handleDateChange = (e) => {
        const { name, value } = e.target;
        // value is a string 'YYYY-MM-DD', convert to moment object
        setFormData(prev => ({
            ...prev,
            [name]: value ? moment(value) : null,
        }));
    };

    // Handle person selection from react-select
    const handlePersonSelect = (selectedOption) => {
        setSelectedPerson(selectedOption);
        setFormData(prev => ({
            ...prev,
            Responsibility: selectedOption ? selectedOption.value : '',
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
            // Format dates back to string for the API
            Planned_Start_Date: formData.Planned_Start_Date ? formData.Planned_Start_Date.format('YYYY-MM-DD') : null,
            Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : null,
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
            
            // Pass the updated task object (which includes moment objects) back to the parent
            onSubmit({
                ...updatedTask,
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
    const isFieldDisabledForNonAdmin = !isAdmin && task.Responsibility !== currentUserEmail;

    return (
        <Form onSubmit={handleSubmit} className="form-component">
            {error && <Alert variant="danger">{error}</Alert>}
            
            {/* REQ 2: Label changed to "Start Date" */}
            <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Start_Date"
                    // Format moment object for display
                    value={formData.Planned_Start_Date ? formData.Planned_Start_Date.format('YYYY-MM-DD') : ''}
                    onChange={handleDateChange}
                    disabled={isFieldDisabledForNonAdmin}
                />
            </Form.Group>

            {/* REQ 2: Label changed to "End Date" */}
            <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    // Format moment object for display
                    value={formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleDateChange} // Allow editing as per implication
                    disabled={isFieldDisabledForNonAdmin}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                <Select
                    name="Responsibility"
                    options={personsToDisplay}
                    value={selectedPerson}
                    onChange={handlePersonSelect}
                    // Only admins can change responsibility
                    isDisabled={!isAdmin || loadingPersons}
                    placeholder="Select Person"
                    isClearable
                    required
                />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || isFieldDisabledForNonAdmin}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
        </Form>
    );
});

export default FormComponent;
