import React, { useState, useEffect, useContext, useCallback } from 'react';
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

// Helper function to format total minutes into "Xh Ym" string
// This function is still useful for debugging or if the logic is re-enabled later
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
        // Planned_Start_Timestamp: null, // Commented out
        // Planned_Delivery_Timestamp: null, // Commented out
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
        // Number_of_Days: 0, // Commented out
    });
    // const [dailyHours, setDailyHours] = useState({}); // Commented out: Stores hours for each day: { 'YYYY-MM-DD': totalMinutes }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [persons, setPersons] = useState([]);
    const [loadingPersons, setLoadingPersons] = useState(true);
    const [personError, setPersonError] = useState(null);

    // Function to calculate End Date - COMMENTED OUT
    // const calculateEndDate = useCallback((startMoment, numDays) => {
    //     if (startMoment && startMoment.isValid() && numDays > 0) {
    //         // End date is 'numDays' *after* start date, inclusive. So add numDays - 1.
    //         return startMoment.clone().add(numDays - 1, 'days');
    //     }
    //     return null;
    // }, []);

    // Function to generate daily sliders data based on start date and number of days - COMMENTED OUT
    // const generateDailySliders = useCallback((startMoment, numDays) => {
    //     const newDailyHours = {};
    //     if (startMoment && startMoment.isValid() && numDays > 0) {
    //         for (let i = 0; i < numDays; i++) {
    //             const date = startMoment.clone().add(i, 'days').format('YYYY-MM-DD');
    //             // Preserve existing hours if available, otherwise default to 0
    //             newDailyHours[date] = dailyHours[date] !== undefined ? dailyHours[date] : 0;
    //         }
    //     }
    //     setDailyHours(newDailyHours);
    // }, [dailyHours]); // Dependency on dailyHours to preserve existing values

    useEffect(() => {
        if (task) {
            // const initialStartDate = task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null; // Commented out
            // const initialNumberOfDays = task.Number_of_Days || 0; // Commented out
            // const initialEndDate = calculateEndDate(initialStartDate, initialNumberOfDays); // Commented out

            setFormData(prevData => ({ // Use functional update to ensure moment is not called if task is null
                ...prevData,
                Key: task.Key || '',
                Delivery_code: task.Delivery_code || '',
                DelCode_w_o__: task.DelCode_w_o__ || '',
                Step_ID: task.Step_ID || 0,
                Task_Details: task.Task_Details || '',
                Frequency___Timeline: task.Frequency___Timeline || '',
                Client: task.Client || '',
                Short_Description: task.Short_Description || '',
                // Planned_Start_Timestamp: initialStartDate, // Commented out
                // Planned_Delivery_Timestamp: initialEndDate, // Commented out
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
                // Number_of_Days: initialNumberOfDays, // Commented out
            }));

            // Fetch existing daily hours for this task if available - COMMENTED OUT
            // const fetchDailyHours = async () => {
            //     // ... fetch logic commented out ...
            // };
            // if (task.Key) {
            //     // fetchDailyHours(); // Commented out
            // }
        }
    }, [task]); // Dependencies: task and calculateEndDate (removed)

    // Effect to regenerate daily sliders when start date or number of days changes - COMMENTED OUT
    // useEffect(() => {
    //     // ... logic commented out ...
    // }, [formData.Planned_Start_Timestamp, formData.Number_of_Days, generateDailySliders, calculateEndDate]);


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

    // Handler for Start Date change - COMMENTED OUT
    // const handleStartDateChange = (e) => { 
    //     // ... logic commented out ...
    // };

    // Handler for Number of Days change - COMMENTED OUT
    // const handleNumberOfDaysChange = (e) => {
    //     // ... logic commented out ...
    // };

    // Handler for Daily Hours slider change - COMMENTED OUT
    // const handleDailyHoursSliderChange = (date) => (e) => {
    //     // ... logic commented out ...
    // };

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

        // ✅ UPDATED VALIDATION: Only check for Responsibility
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
                // Planned_Start_Timestamp: formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.toISOString() : null, // Commented out
                // Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.toISOString() : null, // Commented out
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

            // Prepare data for Per_Key_Per_Day table from dailyHours state - COMMENTED OUT
            // The array is empty because the required inputs are removed.
            const perKeyPerDayRows = []; 


            const payload = {
                mainTask: mainTaskPayload,
                perKeyPerDayRows: perKeyPerDayRows, // Sending empty array
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

    // --- DIAGNOSTIC CONSOLE LOGS ---
    useEffect(() => {
        console.log('--- FormComponent Debug Info ---');
        console.log('userEmail (from context):', userEmail);
        console.log('isAdmin:', isAdmin);
        console.log('formData.Emails (task assigned email):', formData.Emails);
        console.log('currentUserEmail (prop):', currentUserEmail);
        console.log('isFieldDisabledForNonAdmin:', isFieldDisabledForNonAdmin);
        console.log('--------------------------------');
    }, [userEmail, isAdmin, formData.Emails, currentUserEmail, isFieldDisabledForNonAdmin]);


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

            {/* START DATE - COMMENTED OUT (Required attribute removed) */}
            {/*
            <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label> 
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    // Pass moment object to value, format for display
                    value={formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleStartDateChange}
                    disabled={isFieldDisabledForNonAdmin}
                    // required attribute REMOVED here
                />
            </Form.Group>
            */}

            {/* NUMBER OF DAYS - COMMENTED OUT (Required attribute removed) */}
            {/*
            <Form.Group className="mb-3">
                <Form.Label>Number of Days</Form.Label>
                <Form.Control
                    type="number"
                    name="Number_of_Days"
                    value={formData.Number_of_Days}
                    onChange={handleNumberOfDaysChange}
                    min="0" // Ensure 0 or greater
                    disabled={isFieldDisabledForNonAdmin}
                    // required attribute REMOVED here
                />
            </Form.Group>
            */}

            {/* END DATE - COMMENTED OUT */}
            {/*
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
            */}

            {/* Dynamic Sliders for Daily Hours - COMMENTED OUT */}
            {/*
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
                        <span>{formatMinutesToHoursMinutes(dailyHours[date])}</span> 
                        <span>8h (480m)</span> 
                    </div>
                </Form.Group>
            ))}
            */}

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
                    required // This is the only field still required
                />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || isFieldDisabledForNonAdmin}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
        </Form>
    );
};

export default FormComponent;
