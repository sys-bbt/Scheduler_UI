import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import Select from 'react-select';
import moment from 'moment';
import { UserContext } from './UserContext'; // Import UserContext

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Define admin emails on the frontend, matching the backend
const ADMIN_EMAILS_FRONTEND = [
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

// Helper function to format total minutes into "Xh Ym" string
const formatMinutesToHoursMinutes = (totalMinutes) => {
    if (totalMinutes === 0) return '0m'; // Show 0m if total is 0
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let result = '';
    if (hours > 0) {
        result += `${hours}h`;
    }
    if (minutes > 0) {
        result += `${minutes}m`;
    }
    return result.trim();
};

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
        Planned_Start_Timestamp: null, // Now stores moment object or null
        Planned_Delivery_Timestamp: null, // Now stores moment object or null
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
        Number_of_Days: 0,
    });
    const [dailyHours, setDailyHours] = useState({}); // Stores hours for each day: { 'YYYY-MM-DD': totalMinutes }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [persons, setPersons] = useState([]);
    const [loadingPersons, setLoadingPersons] = useState(true);
    const [personError, setPersonError] = useState(null);

    // Function to calculate End Date
    const calculateEndDate = useCallback((startMoment, numDays) => {
        if (startMoment && startMoment.isValid() && numDays > 0) {
            // End date is 'numDays' *after* start date, inclusive. So add numDays - 1.
            return startMoment.clone().add(numDays - 1, 'days');
        }
        return null;
    }, []);

    // Function to generate daily sliders data based on start date and number of days
    const generateDailySliders = useCallback((startMoment, numDays) => {
        const newDailyHours = {};
        if (startMoment && startMoment.isValid() && numDays > 0) {
            for (let i = 0; i < numDays; i++) {
                const date = startMoment.clone().add(i, 'days').format('YYYY-MM-DD');
                // Preserve existing hours if available, otherwise default to 0
                newDailyHours[date] = dailyHours[date] !== undefined ? dailyHours[date] : 0;
            }
        }
        setDailyHours(newDailyHours);
    }, [dailyHours]); // Dependency on dailyHours to preserve existing values

    useEffect(() => {
        if (task) {
            const initialStartDate = task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null;
            const initialNumberOfDays = task.Number_of_Days || 0;
            const initialEndDate = calculateEndDate(initialStartDate, initialNumberOfDays);

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
                Planned_Delivery_Timestamp: initialEndDate, // Store as moment object
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
                Number_of_Days: initialNumberOfDays,
            });

            // Fetch existing daily hours for this task if available
            const fetchDailyHours = async () => {
                try {
                    const response = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day-by-key?key=${encodeURIComponent(task.Key)}`);
                    if (!response.ok) {
                        if (response.status === 404) {
                            console.log('No existing daily hours found for this key.');
                            return; // Not an error if no data found
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to fetch existing daily hours.');
                    }
                    const data = await response.json();
                    const existingDailyHours = {};
                    if (data && data.entries) {
                        data.entries.forEach(entry => {
                            // Convert hours from backend to minutes for frontend state
                            existingDailyHours[moment(entry.Day).format('YYYY-MM-DD')] = Math.round((entry.Duration || 0) * 60); // Round to nearest minute
                        });
                    }
                    setDailyHours(existingDailyHours);
                } catch (err) {
                    console.error("Error fetching existing daily hours:", err);
                    // Do not set a critical error, just log it
                }
            };
            if (task.Key) {
                fetchDailyHours();
            }
        }
    }, [task, calculateEndDate]); // Dependencies: task and calculateEndDate

    // Effect to regenerate daily sliders when start date or number of days changes
    useEffect(() => {
        generateDailySliders(formData.Planned_Start_Timestamp, formData.Number_of_Days);
        setFormData(prevData => ({
            ...prevData,
            Planned_Delivery_Timestamp: calculateEndDate(prevData.Planned_Start_Timestamp, prevData.Number_of_Days)
        }));
    }, [formData.Planned_Start_Timestamp, formData.Number_of_Days, generateDailySliders, calculateEndDate]);


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
            // Recalculate end date based on new start date and existing number of days
            updatedData.Planned_Delivery_Timestamp = calculateEndDate(updatedData.Planned_Start_Timestamp, updatedData.Number_of_Days);
            return updatedData;
        });
    };

    const handleNumberOfDaysChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setFormData(prevData => {
            const updatedData = {
                ...prevData,
                Number_of_Days: isNaN(value) || value < 0 ? 0 : value
            };
            // Recalculate end date based on existing start date and new number of days
            updatedData.Planned_Delivery_Timestamp = calculateEndDate(updatedData.Planned_Start_Timestamp, updatedData.Number_of_Days);
            return updatedData;
        });
    };

    const handleDailyHoursSliderChange = (date) => (e) => {
        const value = parseInt(e.target.value, 10); // Value from slider is in minutes
        setDailyHours(prevDailyHours => ({
            ...prevDailyHours,
            [date]: isNaN(value) ? 0 : value
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

        // Basic validation for required fields
        if (!formData.Planned_Start_Timestamp || !formData.Planned_Start_Timestamp.isValid() || formData.Number_of_Days <= 0 || !formData.Responsibility) {
            setError("Please fill all required fields: Start Date, Number of Days (must be > 0), and Person Responsible.");
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
                Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.toISOString() : null,
                Responsibility: formData.Responsibility,
                Current_Status: formData.Current_Status,
                Email: formData.Email, // This field is still in formData, but removed from backend query
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

            // Prepare data for Per_Key_Per_Day table from dailyHours state
            const perKeyPerDayRows = Object.keys(dailyHours).map(date => ({
                Key: mainTaskPayload.Key,
                Day: date,
                Duration: dailyHours[date], // Send minutes directly
                Duration_Unit: 'Minutes', // Explicitly set to 'Minutes'
                Planned_Delivery_Slot: null,
                Responsibility: mainTaskPayload.Responsibility,
            })).filter(row => row.Duration > 0); // Only send rows with planned hours > 0

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
    // const SYSTEM_EMAIL_FOR_GLOBAL_TASKS = "systems@brightbraintech.com"; // Already defined globally if needed

    // --- DIAGNOSTIC CONSOLE LOGS ---
    useEffect(() => {
        console.log('--- FormComponent Debug Info ---');
        console.log('userEmail (from context):', userEmail);
        console.log('isAdmin:', isAdmin);
        console.log('formData.Emails (task assigned email):', formData.Emails);
        console.log('currentUserEmail (prop):', currentUserEmail);
        console.log('isFieldDisabledForNonAdmin:', isFieldDisabledForNonAdmin);
        console.log('formData.Planned_Start_Timestamp:', formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : 'null');
        console.log('formData.Planned_Delivery_Timestamp:', formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : 'null');
        console.log('formData.Number_of_Days:', formData.Number_of_Days);
        console.log('dailyHours:', dailyHours);
        console.log('--------------------------------');
    }, [userEmail, isAdmin, formData.Emails, currentUserEmail, isFieldDisabledForNonAdmin, formData.Planned_Start_Timestamp, formData.Planned_Delivery_Timestamp, formData.Number_of_Days, dailyHours]);


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
                    disabled={true} // Disabled as requested
                    required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Start Date<span className="text-danger">*</span></Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    // Pass moment object to value, format for display
                    value={formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleStartDateChange}
                    disabled={isFieldDisabledForNonAdmin}
                    required // Made required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Number of Days<span className="text-danger">*</span></Form.Label>
                <Form.Control
                    type="number"
                    name="Number_of_Days"
                    value={formData.Number_of_Days}
                    onChange={handleNumberOfDaysChange}
                    min="0" // Ensure 0 or greater
                    disabled={isFieldDisabledForNonAdmin}
                    required // Made required
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    // Pass moment object to value, format for display
                    value={formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : ''}
                    readOnly // This field is calculated, not directly editable
                    disabled={true} // Disabled as requested
                />
            </Form.Group>

            {/* Dynamic Sliders for Daily Hours */}
            {Object.keys(dailyHours).sort().map(date => (
                <Form.Group className="mb-3" key={date}>
                    <Form.Label>Hours for {moment(date).format('YYYY-MM-DD')}</Form.Label>
                    <Form.Range
                        name={`hours-for-${date}`}
                        min="0"
                        max="480" // 8 hours * 60 minutes
                        step="1" // Each minute
                        value={dailyHours[date]}
                        onChange={handleDailyHoursSliderChange(date)}
                        disabled={isFieldDisabledForNonAdmin}
                    />
                    <div className="d-flex justify-content-between">
                        <span>0m</span>
                        <span>{formatMinutesToHoursMinutes(dailyHours[date])}</span> {/* Formatted display */}
                        <span>8h (480m)</span> {/* Max value display */}
                    </div>
                </Form.Group>
            ))}

            <Form.Group className="mb-3">
                <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                <Select
                    name="Responsibility"
                    options={personsToDisplay}
                    value={selectedPerson}
                    onChange={handlePersonSelect}
                    isDisabled={!isAdmin || loadingPersons || isFieldDisabledForNonAdmin}
                    placeholder="Select Person"
                    isClearable
                    required // Made required
                />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || isFieldDisabledForNonAdmin}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
        </Form>
    );
};

export default FormComponent;
