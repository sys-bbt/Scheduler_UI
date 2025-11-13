import React, { useState, useEffect, useContext } from 'react';
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

const FormComponent = ({ onSubmit, task, currentUserEmail }) => {
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
        Planned_Start_Timestamp: null, // Stored as moment object
        Planned_Delivery_Timestamp: null, // Stored as moment object
        Responsibility: '',
        User_ID: '', // New field for the ID of the person responsible
    });

    const [loading, setLoading] = useState(false);
    const [loadingPersons, setLoadingPersons] = useState(false);
    const [personsToDisplay, setPersonsToDisplay] = useState([]);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [error, setError] = useState(null);

    // Determines if non-admin users can modify the task
    const isFieldDisabledForNonAdmin = 
        !isAdmin && 
        task.Responsibility && 
        task.Responsibility !== userEmail &&
        task.Responsibility !== 'systems@brightbraintech.com'; // Allow non-admins to claim tasks from System

    useEffect(() => {
        // Initialize form data from task prop
        if (task) {
            setFormData({
                Key: task.Key,
                Delivery_code: task.Delivery_code,
                DelCode_w_o__: task.DelCode_w_o__,
                Step_ID: task.Step_ID,
                Task_Details: task.Task_Details,
                Frequency___Timeline: task.Frequency___Timeline,
                Client: task.Client,
                Short_Description: task.Short_Description,
                // Convert timestamps to moment objects for easier handling
                Planned_Start_Timestamp: task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null,
                Planned_Delivery_Timestamp: task.Planned_Delivery_Timestamp ? moment(task.Planned_Delivery_Timestamp) : null,
                Responsibility: task.Responsibility || '',
                User_ID: task.User_ID || '',
            });

            // Set the selected person for the react-select component
            if (task.Responsibility) {
                setSelectedPerson({
                    value: task.Responsibility,
                    label: task.Responsibility,
                });
            } else {
                setSelectedPerson(null);
            }
        }
    }, [task]);

    // Fetch list of persons (users)
    useEffect(() => {
        const fetchPersons = async () => {
            setLoadingPersons(true);
            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/users`);
                if (!response.ok) {
                    throw new Error('Failed to fetch user list.');
                }
                const data = await response.json();
                
                // Map API data to react-select format { value: email, label: email }
                const options = data.map(person => ({
                    value: person.Email,
                    label: person.Email
                }));

                // Add "systems" option if not already present
                const systemOption = { value: "systems@brightbraintech.com", label: "System (Automation)" };
                if (!options.some(opt => opt.value === systemOption.value)) {
                    options.unshift(systemOption);
                }

                setPersonsToDisplay(options);
            } catch (err) {
                console.error("Error fetching persons:", err);
                setError("Could not load assignable persons.");
            } finally {
                setLoadingPersons(false);
            }
        };

        if (isAdmin || !task.Responsibility || task.Responsibility === 'systems@brightbraintech.com') {
            fetchPersons();
        }
    }, [isAdmin, task.Responsibility]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // For date inputs, moment() automatically handles the conversion from 'YYYY-MM-DD' string
        setFormData(prevData => ({
            ...prevData,
            [name]: name.endsWith('_Timestamp') && value ? moment(value) : value
        }));
    };

    const handlePersonSelect = (selectedOption) => {
        setSelectedPerson(selectedOption);
        setFormData(prevData => ({
            ...prevData,
            Responsibility: selectedOption ? selectedOption.value : '',
            // Note: User_ID logic is more complex and depends on backend; we default to email for now
            User_ID: selectedOption ? selectedOption.value : '', 
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // Basic validation
        if (!formData.Planned_Start_Timestamp || !formData.Planned_Delivery_Timestamp || !formData.Responsibility) {
            setError("Please fill out all required fields (Start Date, End Date, and Person Responsible).");
            setLoading(false);
            return;
        }

        // Pass the data (including moment objects) up to the parent component for API call
        onSubmit(formData)
            .finally(() => {
                setLoading(false);
            });
    };

    if (error && !loadingPersons) {
        return <Alert variant="danger" className="mt-3">{error}</Alert>;
    }

    return (
        <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
                {/* Updated Label */}
                <Form.Label>Start Date<span className="text-danger">*</span></Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    // Format moment object for display
                    value={formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleChange}
                    disabled={isFieldDisabledForNonAdmin}
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                {/* Updated Label */}
                <Form.Label>End Date<span className="text-danger">*</span></Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    // Format moment object for display
                    value={formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleChange}
                    disabled={isFieldDisabledForNonAdmin}
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                <Select
                    name="Responsibility"
                    options={personsToDisplay}
                    value={selectedPerson}
                    onChange={handlePersonSelect}
                    // Only admins can change responsibility (or if the task is currently unassigned/assigned to the system)
                    isDisabled={!isAdmin || loadingPersons || isFieldDisabledForNonAdmin}
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
};

export default FormComponent;
