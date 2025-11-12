import React, { useState, useEffect, createContext, useContext } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';

// Mock UserContext since the real file is causing a resolution error.
// Assuming the necessary data (userEmail) is now passed via props or a mock value.
const UserContext = createContext({ userEmail: 'mock-user@brightbraintech.com' }); 

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
    // Removed unused 'userEmail' from destructuring to fix ESLint error.
    // The context is still required, but we are ignoring its return value here.
    useContext(UserContext); 
    
    // We'll use currentUserEmail for the isAdmin check as it is provided by the parent component
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(currentUserEmail);

    const [formData, setFormData] = useState({
        Key: '',
        Delivery_code: '',
        DelCode_w_o__: '',
        Step_ID: 0,
        Task_Details: '',
        Frequency___Timeline: '',
        Client: '',
        Short_Description: '',
        Responsibility: '',
        Current_Status: '',
        Email: '',
        Emails: '',
        Total_Tasks: 0,
        Completed_Tasks: 0,
        Planned_Tasks: 0,
        Percent_Tasks_Completed: 0,
        Created_at: null,
        Updated_at: null,
        Time_Left_For_Next_Task_dd_hh_mm_ss: '',
        Card_Corner_Status: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [persons, setPersons] = useState([]);
    const [loadingPersons, setLoadingPersons] = useState(true);
    const [personError, setPersonError] = useState(null);


    useEffect(() => {
        if (task) {
            setFormData(prevData => ({ 
                ...prevData,
                Key: task.Key || '',
                Delivery_code: task.Delivery_code || '',
                DelCode_w_o__: task.DelCode_w_o__ || '',
                Step_ID: task.Step_ID || 0,
                Task_Details: task.Task_Details || '',
                Frequency___Timeline: task.Frequency___Timeline || '',
                Client: task.Client || '',
                Short_Description: task.Short_Description || '',
                Responsibility: task.Responsibility || '',
                Email: task.Email || '',
                Emails: task.Emails || '',
                Current_Status: task.Current_Status || '',
                Total_Tasks: task.Total_Tasks || 0,
                Completed_Tasks: task.Completed_Tasks || 0,
                Planned_Tasks: task.Planned_Tasks || 0,
                Percent_Tasks_Completed: task.Percent_Tasks_Completed || 0,
                Created_at: task.Created_at || null,
                Updated_at: task.Updated_at || null,
                Time_Left_For_Next_Task_dd_hh_mm_ss: task.Time_Left_For_Next_Task_dd_hh_mm_ss || '',
                Card_Corner_Status: task.Card_Corner_Status || '',
            }));
        }
    }, [task]); 


    // Fetch people mapping data
    useEffect(() => {
        const fetchPeopleMapping = async () => {
            setLoadingPersons(true);
            setPersonError(null);
            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/api/people-mapping`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch people mapping data.');
                }
                const data = await response.json();
                setPersons(data);
            } catch (err) {
                console.error("Failed to load person data:", err);
                setPersonError(`Failed to load person data: ${err.message}. Please ensure the backend endpoint /api/people-mapping is correctly configured.`);
            } finally {
                setLoadingPersons(false);
            }
        };
        fetchPeopleMapping();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    // Updated handler for standard select dropdown
    const handlePersonSelect = (e) => {
        const selectedEmail = e.target.value;
        const selectedPerson = personsToDisplay.find(p => p.value === selectedEmail);

        setFormData(prevData => ({
            ...prevData,
            Responsibility: selectedPerson ? selectedPerson.label : '',
            Emails: selectedEmail || '' 
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // ✅ VALIDATION: Only check for Responsibility
        if (!formData.Responsibility) {
            setError("Please fill all required fields: Person Responsible.");
            setLoading(false);
            return;
        }

        try {
            // Prepare data for the main task table update
            const mainTaskPayload = {
                Key: formData.Key,
                Delivery_code: formData.Delivery_code,
                DelCode_w_o__: formData.DelCode_w_o__,
                Step_ID: formData.Step_ID,
                Task_Details: formData.Task_Details,
                Frequency___Timeline: formData.Frequency___Timeline,
                Client: formData.Client,
                Short_Description: formData.Short_Description,
                Responsibility: formData.Responsibility,
                Current_Status: formData.Current_Status,
                Email: formData.Email,
                Emails: formData.Emails,
                Total_Tasks: formData.Total_Tasks,
                Completed_Tasks: formData.Completed_Tasks,
                Planned_Tasks: formData.Planned_Tasks,
                Percent_Tasks_Completed: formData.Percent_Tasks_Completed,
                Created_at: formData.Created_at || null, // Preserve existing or set null
                Updated_at: new Date().toISOString(), // Use standard JS Date 
                Time_Left_For_Next_Task_dd_hh_mm_ss: formData.Time_Left_For_Next_Task_dd_hh_mm_ss,
                Card_Corner_Status: formData.Card_Corner_Status,
            };

            // The array is empty as requested
            const perKeyPerDayRows = []; 


            const payload = {
                mainTask: mainTaskPayload,
                perKeyPerDayRows: perKeyPerDayRows, 
            };

            const response = await fetch(`${BACKEND_API_BASE_URL}/api/post`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            setSuccess('Task updated successfully!'); 
            console.log('Task updated successfully:', result);
            onSubmit(formData); // Pass updated data back to parent
        } catch (err) {
            console.error('Error updating task:', err);
            setError(`Failed to update task: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Filter persons for dropdown based on admin status
    const personsToDisplay = isAdmin
        ? persons.map(p => ({ value: p.Emp_Emails, label: p.Current_Employes }))
        : persons.filter(p => p.Emp_Emails === currentUserEmail)
             .map(p => ({ value: p.Emp_Emails, label: p.Current_Employes }));

    // Determine if fields should be disabled for non-admins
    const isFieldDisabledForNonAdmin = !isAdmin && (formData.Emails !== currentUserEmail && formData.Emails !== "systems@brightbraintech.com");

    return (
        <Form onSubmit={handleSubmit} className="p-3 border rounded shadow-sm bg-light">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            {personError && <Alert variant="warning">{personError}</Alert>} 

            <Form.Group className="mb-3">
                <Form.Label>Task Name</Form.Label>
                <Form.Control
                    type="text"
                    name="Task_Details"
                    value={formData.Task_Details}
                    onChange={handleChange}
                    disabled={true} 
                    required
                />
            </Form.Group>

            {/* START DATE - COMMENTED OUT */}
            {/*
            <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label> 
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    value={formData.Planned_Start_Timestamp || ''}
                    onChange={handleStartDateChange}
                    disabled={isFieldDisabledForNonAdmin}
                />
            </Form.Group>
            */}

            {/* NUMBER OF DAYS - COMMENTED OUT */}
            {/*
            <Form.Group className="mb-3">
                <Form.Label>Number of Days</Form.Label>
                <Form.Control
                    type="number"
                    name="Number_of_Days"
                    value={formData.Number_of_Days}
                    onChange={handleNumberOfDaysChange}
                    min="0" 
                    disabled={isFieldDisabledForNonAdmin}
                />
            </Form.Group>
            */}

            <Form.Group className="mb-3">
                <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                {/* Replaced react-select with standard Form.Control as="select" */}
                <Form.Control 
                    as="select"
                    name="Emails"
                    value={formData.Emails}
                    onChange={handlePersonSelect}
                    disabled={!isAdmin || loadingPersons || isFieldDisabledForNonAdmin}
                    required 
                >
                    <option value="" disabled>Select Person</option>
                    {personsToDisplay.map(person => (
                        <option key={person.value} value={person.value}>{person.label}</option>
                    ))}
                </Form.Control>
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || isFieldDisabledForNonAdmin}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
        </Form>
    );
};

export default FormComponent;
