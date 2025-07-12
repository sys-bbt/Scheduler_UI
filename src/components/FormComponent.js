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
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
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
        Planned_Start_Timestamp: null,
        Planned_Delivery_Timestamp: null,
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
        Number_of_Days: 0, // Number of days for task duration
        Daily_Hours_Planned: 0 // Hours planned per day for this task
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [persons, setPersons] = useState([]); // State for people mapping
    const [loadingPersons, setLoadingPersons] = useState(true);
    const [personError, setPersonError] = useState(null);

    useEffect(() => {
        if (task) {
            setFormData({
                Key: task.Key || '',
                Delivery_code: task.Delivery_code || '',
                DelCode_w_o__: task.DelCode_w_o__ || '',
                Step_ID: task.Step_ID || 0,
                Task_Details: task.Task_Details || '',
                Frequency___Timeline: task.Frequency___Timeline || '',
                Client: task.Client || '',
                Short_Description: task.Short_Description || '',
                // Ensure timestamps are moment objects for date pickers if needed, or null
                Planned_Start_Timestamp: task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp).format('YYYY-MM-DD') : '',
                Planned_Delivery_Timestamp: task.Planned_Delivery_Timestamp ? moment(task.Planned_Delivery_Timestamp).format('YYYY-MM-DD') : '',
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
                Number_of_Days: task.Number_of_Days || 0,
                Daily_Hours_Planned: task.Daily_Hours_Planned || 0 // Renamed field
            });
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

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => {
            const updatedData = {
                ...prevData,
                [name]: value
            };

            // If Planned_Start_Timestamp changes, recalculate Planned_Delivery_Timestamp
            if (name === 'Planned_Start_Timestamp' && updatedData.Number_of_Days > 0) {
                const startDate = moment(value); // Use the new start date value
                if (startDate.isValid()) {
                    const endDate = startDate.add(updatedData.Number_of_Days, 'days');
                    updatedData.Planned_Delivery_Timestamp = endDate.format('YYYY-MM-DD');
                } else {
                    updatedData.Planned_Delivery_Timestamp = ''; // Clear if start date is invalid
                }
            }
            return updatedData;
        });
    };

    const handleNumberOfDaysChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setFormData(prevData => {
            const updatedData = {
                ...prevData,
                Number_of_Days: isNaN(value) ? 0 : value
            };

            // Recalculate Planned_Delivery_Timestamp if Planned_Start_Timestamp exists
            if (updatedData.Planned_Start_Timestamp) {
                const startDate = moment(updatedData.Planned_Start_Timestamp);
                if (startDate.isValid()) {
                    const endDate = startDate.add(updatedData.Number_of_Days, 'days');
                    updatedData.Planned_Delivery_Timestamp = endDate.format('YYYY-MM-DD');
                } else {
                    updatedData.Planned_Delivery_Timestamp = '';
                }
            }
            return updatedData;
        });
    };

    const handleDailyHoursChange = (e) => { // Renamed handler
        const value = parseInt(e.target.value, 10);
        setFormData(prevData => ({
            ...prevData,
            Daily_Hours_Planned: isNaN(value) ? 0 : value
        }));
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
                Planned_Start_Timestamp: formData.Planned_Start_Timestamp ? moment(formData.Planned_Start_Timestamp).toISOString() : null,
                Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? moment(formData.Planned_Delivery_Timestamp).toISOString() : null,
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

            // Prepare data for Per_Key_Per_Day table
            const perKeyPerDayRows = [];
            if (formData.Planned_Start_Timestamp && formData.Number_of_Days > 0 && formData.Daily_Hours_Planned > 0) {
                let currentDay = moment(formData.Planned_Start_Timestamp);
                for (let i = 0; i < formData.Number_of_Days; i++) {
                    perKeyPerDayRows.push({
                        Key: formData.Key,
                        Day: currentDay.format('YYYY-MM-DD'), // Format as 'YYYY-MM-DD' for DATE type
                        Duration: formData.Daily_Hours_Planned,
                        Duration_Unit: 'Hours', // Assuming fixed unit
                        Planned_Delivery_Slot: null, // As per schema, this can be nullable or derived
                        Responsibility: formData.Responsibility,
                    });
                    currentDay.add(1, 'days');
                }
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
            console.log('Task and schedule updated successfully:', result);
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

    const selectedPerson = personsToDisplay.find(p => p.value === formData.Emails);

    // Determine if fields should be disabled for non-admins
    const isFieldDisabledForNonAdmin = !isAdmin && (formData.Emails !== currentUserEmail && formData.Emails !== "systems@brightbraintech.com");
    // The "System" email for tasks that should be globally visible to non-admins
    const SYSTEM_EMAIL_FOR_GLOBAL_TASKS = "systems@brightbraintech.com";

    return (
        <Form onSubmit={handleSubmit} className="p-3 border rounded shadow-sm bg-light">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            {personError && <Alert variant="warning">{personError}</Alert>} {/* Display person data loading error */}

            <Form.Group className="mb-3">
                <Form.Label>Task Name</Form.Label>
                <Form.Control
                    type="text"
                    name="Task_Details"
                    value={formData.Task_Details}
                    onChange={handleChange}
                    disabled={isFieldDisabledForNonAdmin} // Disable for non-admins if not assigned
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    value={formData.Planned_Start_Timestamp}
                    onChange={handleDateChange}
                    disabled={isFieldDisabledForNonAdmin}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Number of Days</Form.Label>
                <Form.Control
                    type="number"
                    name="Number_of_Days"
                    value={formData.Number_of_Days}
                    onChange={handleNumberOfDaysChange}
                    disabled={isFieldDisabledForNonAdmin}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    value={formData.Planned_Delivery_Timestamp}
                    readOnly // This field is calculated, not directly editable
                    disabled={isFieldDisabledForNonAdmin}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Daily Hours Planned</Form.Label> {/* Renamed label */}
                <Form.Range
                    name="Daily_Hours_Planned" // Renamed field
                    min="0"
                    max="8"
                    step="1"
                    value={formData.Daily_Hours_Planned}
                    onChange={handleDailyHoursChange} // Renamed handler
                    disabled={isFieldDisabledForNonAdmin}
                />
                <div className="d-flex justify-content-between">
                    <span>0h</span>
                    <span>{formData.Daily_Hours_Planned}h</span>
                    <span>8h</span>
                </div>
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Person Responsible</Form.Label>
                <Select
                    name="Responsibility"
                    options={personsToDisplay}
                    value={selectedPerson}
                    onChange={handlePersonSelect}
                    isDisabled={!isAdmin || loadingPersons || isFieldDisabledForNonAdmin} // Disable if not admin or loading or not assigned
                    placeholder="Select Person"
                    isClearable
                />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || isFieldDisabledForNonAdmin}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
        </Form>
    );
};

export default FormComponent;
