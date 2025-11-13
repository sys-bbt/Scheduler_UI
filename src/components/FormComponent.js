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
    // Note: 'currentUserEmail' passed via prop is already available in context via 'userEmail'.
    const { userEmail } = useContext(UserContext); 
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
        Planned_Start_Timestamp: null, // Stores moment object or null
        Planned_Delivery_Timestamp: null, // Stores pre-filled moment object (End Date)
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

    // 1. Initialize formData from the task prop
    useEffect(() => {
        if (task) {
            
            const rawStartDate = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
                ? task.Planned_Start_Timestamp.value
                : task.Planned_Start_Timestamp;

            const rawDeliveryDate = task.Planned_Delivery_Timestamp && typeof task.Planned_Delivery_Timestamp === 'object' && task.Planned_Delivery_Timestamp.value
                ? task.Planned_Delivery_Timestamp.value
                : task.Planned_Delivery_Timestamp;

            const initialStartDate = rawStartDate ? moment(rawStartDate) : null;
            const initialDeliveryDate = rawDeliveryDate ? moment(rawDeliveryDate) : null;

            setFormData({
                Key: task.Key || '',
                Delivery_code: task.Delivery_code || '',
                DelCode_w_o__: task.DelCode_w_o__ || '',
                Step_ID: task.Step_ID || 0,
                Task_Details: task.Task_Details || '',
                Frequency___Timeline: task.Frequency___Timeline || '',
                Client: task.Client || '',
                Short_Description: task.Short_Description || '',
                Planned_Start_Timestamp: initialStartDate, // Store as moment object
                Planned_Delivery_Timestamp: initialDeliveryDate, // Store as moment object (End Date)
                // 🟢 Ensure Responsibility and Emails are pre-populated
                Responsibility: task.Responsibility || '',
                Email: task.Email || '',
                Emails: task.Emails || '', // Emails is usually the assigned user's email/ID
                Current_Status: task.Current_Status || '',
                Total_Tasks: task.Total_Tasks || 0,
                Completed_Tasks: task.Completed_Tasks || 0,
                Planned_Tasks: task.Planned_Tasks || 0,
                Percent_Tasks_Completed: task.Percent_Tasks_Completed || 0,
                Created_at: task.Created_at || null,
                Updated_at: task.Updated_at || null,
                Time_Left_For_Next_Task_dd_hh_mm_ss: task.Time_Left_For_Next_Task_dd_hh_mm_ss || '',
                Card_Corner_Status: task.Card_Corner_Status || '',
            });
            
        }
    }, [task]); 


    // 2. Fetch people mapping data
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

    const handleStartDateChange = (e) => {
        const dateString = e.target.value;
        const dateMoment = moment(dateString);
        setFormData(prevData => {
            const updatedData = {
                ...prevData,
                Planned_Start_Timestamp: dateMoment.isValid() ? dateMoment : null 
            };
            return updatedData;
        });
    };

    const handlePersonSelect = (selectedOption) => {
        setFormData(prevData => ({
            ...prevData,
            // Responsibility is the name/label
            Responsibility: selectedOption ? selectedOption.label : '', 
            // Emails is the email/ID, used for database storage and disabling logic
            Emails: selectedOption ? selectedOption.value : '' 
        }));
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        if (!formData.Planned_Start_Timestamp || !formData.Planned_Start_Timestamp.isValid() || !formData.Responsibility) {
            setError("Please fill all required fields: Start Date and Person Responsible.");
            setLoading(false);
            return;
        }

        try {
            const mainTaskPayload = {
                // ... (all other formData fields)
                ...formData, // Spread all fields to be sent
                Planned_Start_Timestamp: formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.toISOString() : null,
                Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.toISOString() : null,
                Updated_at: moment.utc().toISOString(), 
            };

            const perKeyPerDayRows = [];
            
            if (formData.Planned_Start_Timestamp && formData.Planned_Start_Timestamp.isValid()) {
                perKeyPerDayRows.push({
                    Key: mainTaskPayload.Key,
                    Day: formData.Planned_Start_Timestamp.format('YYYY-MM-DD'),
                    Duration: 0,
                    Duration_Unit: 'min',
                    Planned_Delivery_Slot: null,
                    Responsibility: mainTaskPayload.Responsibility,
                });
            }

            const payload = {
                mainTask: mainTaskPayload,
                perKeyPerDayRows: perKeyPerDayRows
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
            setSuccess('Task and schedule updated successfully!');
            onSubmit(formData); // Pass updated data back to parent
        } catch (err) {
            console.error('Error updating task:', err);
            setError(`Failed to update task: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };


    // 🟢 Filter persons for dropdown based on admin status
    const personsToDisplay = persons.map(p => ({ 
        value: p.Emp_Emails, 
        label: p.Current_Employes 
    }));

    // 🟢 Find the selected person based on the email/ID stored in formData.Emails
    const selectedPerson = personsToDisplay.find(p => p.value === formData.Emails);
    
    // 🟢 NEW DISABLING LOGIC for Non-Admins:
    // 1. Task is considered assigned if formData.Emails has a value (and it's not the system account).
    const isAssigned = !!formData.Emails && formData.Emails !== "systems@brightbraintech.com";

    // 2. The field should be disabled if:
    //    - The user is NOT an admin AND the task is already assigned.
    const isFieldDisabled = !isAdmin && isAssigned;


    return (
        <Form onSubmit={handleSubmit} className="p-3 border rounded shadow-sm bg-light">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            {personError && <Alert variant="warning">{personError}</Alert>}

            <Form.Group className="mb-3">
                <Form.Label>Task Details</Form.Label>
                <Form.Control
                    type="text"
                    name="Task_Details"
                    value={formData.Task_Details}
                    onChange={handleChange}
                    disabled={true} 
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Start Date<span className="text-danger">*</span></Form.Label> 
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    value={formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleStartDateChange}
                    // 🟢 Start Date is disabled if the Person Responsible is disabled
                    disabled={isFieldDisabled} 
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    value={formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : ''}
                    readOnly
                    disabled={true}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                <Select
                    name="Responsibility"
                    options={personsToDisplay}
                    value={selectedPerson} // 🟢 Uses the `selectedPerson` derived from pre-populated email/ID
                    onChange={handlePersonSelect}
                    // 🟢 Field is disabled if the user is not an admin AND the task is assigned
                    isDisabled={isFieldDisabled || loadingPersons} 
                    placeholder="Select Person"
                    isClearable
                    required
                />
                {isFieldDisabled && (
                    <Form.Text className="text-muted">
                        This task is already assigned and can only be changed by an Admin.
                    </Form.Text>
                )}
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || isFieldDisabled}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
        </Form>
    );
};

export default FormComponent;
