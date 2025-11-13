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

// NOTE: The ESLint errors you saw (unused 'Button') were incorrect,
// as 'Button' is clearly used in the return block. No changes were needed here.

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

    useEffect(() => {
        if (task) {
            // FIX: Add logic to safely extract timestamp, checking if it's an object with a .value property
            const rawStartDate = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
                ? task.Planned_Start_Timestamp.value
                : task.Planned_Start_Timestamp;

            // FIX: Add logic to safely extract timestamp for Delivery Date
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
            });
            
        }
    }, [task]); // Dependencies: task only


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

    const handleStartDateChange = (e) => { // e.target.value is string 'YYYY-MM-DD'
        const dateString = e.target.value;
        const dateMoment = moment(dateString); // Convert string to moment object
        setFormData(prevData => {
            const updatedData = {
                ...prevData,
                Planned_Start_Timestamp: dateMoment.isValid() ? dateMoment : null // Store moment object directly
            };
            // Planned_Delivery_Timestamp (End Date) is not recalculated.
            return updatedData;
        });
    };

    const handlePersonSelect = (selectedOption) => {
        setFormData(prevData => ({
            ...prevData,
            Responsibility: selectedOption ? selectedOption.label : '',
            Emails: selectedOption ? selectedOption.value : '' // Assuming value is the email
        }));
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // Basic validation for required fields: Start Date and Responsibility
        if (!formData.Planned_Start_Timestamp || !formData.Planned_Start_Timestamp.isValid() || !formData.Responsibility) {
            setError("Please fill all required fields: Start Date and Person Responsible.");
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
                // Convert moment objects to ISO strings for backend
                Planned_Start_Timestamp: formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.toISOString() : null,
                // Planned_Delivery_Timestamp is sent back as loaded (the fixed end date)
                Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.toISOString() : null,
                Responsibility: formData.Responsibility,
                Current_Status: formData.Current_Status,
                Email: formData.Email,
                Emails: formData.Emails,
                Total_Tasks: formData.Total_Tasks,
                Completed_Tasks: formData.Completed_Tasks,
                Planned_Tasks: formData.Planned_Tasks,
                Percent_Tasks_Completed: formData.Percent_Tasks_Completed,
                Created_at: formData.Created_at || null, // Preserve existing or set null
                Updated_at: moment.utc().toISOString(), // Always update Updated_at
                Time_Left_For_Next_Task_dd_hh_mm_ss: formData.Time_Left_For_Next_Task_dd_hh_mm_ss,
                Card_Corner_Status: formData.Card_Corner_Status,
            };

            // Prepare data for Per_Key_Per_Day table (Simplified to a single entry based on new requirements)
            const perKeyPerDayRows = [];
            
            if (formData.Planned_Start_Timestamp && formData.Planned_Start_Timestamp.isValid()) {
                perKeyPerDayRows.push({
                    Key: mainTaskPayload.Key,
                    Day: formData.Planned_Start_Timestamp.format('YYYY-MM-DD'), // Key = task key, Day = Start date value
                    Duration: 0, // NEW REQUIREMENT: Duration = 0
                    Duration_Unit: 'min', // NEW REQUIREMENT: Duration_Unit = min
                    Planned_Delivery_Slot: null, // NEW REQUIREMENT: Planned_Delivery_Slot = null
                    Responsibility: mainTaskPayload.Responsibility, // Responsibility = if any in the DD.
                });
            }


            const payload = {
                mainTask: mainTaskPayload,
                perKeyPerDayRows: perKeyPerDayRows // Array with zero or one entry
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
            console.log('Task and schedule updated successfully:', result);
            onSubmit(formData); // Pass updated data back to parent
        } catch (err) {
            console.error('Error updating task:', err);
            setError(`Failed to update task: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };


    // Filter persons for dropdown based on admin status (Logic unchanged)
    const personsToDisplay = isAdmin
        ? persons.map(p => ({ value: p.Emp_Emails, label: p.Current_Employes }))
        : persons.filter(p => p.Emp_Emails === currentUserEmail)
                  .map(p => ({ value: p.Emp_Emails, label: p.Current_Employes }));

    const selectedPerson = personsToDisplay.find(p => p.value === formData.Emails);

    // Determine if fields should be disabled for non-admins (Logic unchanged)
    const isFieldDisabledForNonAdmin = !isAdmin && (formData.Emails !== currentUserEmail && formData.Emails !== "systems@brightbraintech.com");

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
                    disabled={true} // Disabled as requested
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Start Date<span className="text-danger">*</span></Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    // Format moment object for display
                    value={formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleStartDateChange}
                    disabled={isFieldDisabledForNonAdmin}
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Planned Delivery Date (End Date)</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    // Format moment object for display
                    value={formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : ''}
                    readOnly // This field is pre-filled from task data
                    disabled={true} // Disabled as requested
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
