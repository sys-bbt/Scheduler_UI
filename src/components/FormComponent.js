import React, { useState, useEffect, useContext } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import Select from 'react-select';
import moment from 'moment';
import { UserContext } from './UserContext'; 

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const ADMIN_EMAILS_FRONTEND = [
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

const FormComponent = ({ onSubmit, task, currentUserEmail }) => {
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
            // DEBUG LINE
            console.log("Task Key received by FormComponent:", task.Key, "for Step ID:", task.Step_ID); 
            
            const rawStartDate = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
                ? task.Planned_Start_Timestamp.value
                : task.Planned_Start_Timestamp;

            const rawDeliveryDate = task.Planned_Delivery_Timestamp && typeof task.Planned_Delivery_Timestamp === 'object' && task.Planned_Delivery_Timestamp.value
                ? task.Planned_Delivery_Timestamp.value
                : task.Planned_Delivery_Timestamp;

            const initialStartDate = rawStartDate ? moment(rawStartDate) : null;
            const initialDeliveryDate = rawDeliveryDate ? moment(rawDeliveryDate) : null;

            setFormData({
                // 🟢 FIX: Ensure Key is treated as a string, which should now contain a value from the updated backend
                Key: String(task.Key || ''), 
                Delivery_code: task.Delivery_code || '',
                DelCode_w_o__: task.DelCode_w_o__ || '',
                Step_ID: task.Step_ID || 0,
                Task_Details: task.Task_Details || '',
                Frequency___Timeline: task.Frequency___Timeline || '',
                Client: task.Client || '',
                Short_Description: task.Short_Description || '',
                Planned_Start_Timestamp: initialStartDate, 
                Planned_Delivery_Timestamp: initialDeliveryDate, 
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
    }, [task]); 


    // 2. Fetch people mapping data
    useEffect(() => {
        // Only fetch person data if the user is an admin or if the user needs to select an assignee
        // Given that non-admins cannot see the dropdown, fetching is less critical for them,
        // but we'll fetch anyway to ensure current assigned person data is available.
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
            Responsibility: selectedOption ? selectedOption.label : '', 
            Emails: selectedOption ? selectedOption.value : '' 
        }));
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // 🟢 CRITICAL VALIDATION: Check if Key is valid (now receiving it from the backend fix)
        // Convert to string and trim for robustness
        const taskKey = String(formData.Key).trim(); 
        if (!taskKey || taskKey === '0') {
             setError("Cannot update task: Unique Task Key is missing or invalid. Please check backend data.");
             setLoading(false);
             return;
        }

        // NOTE: Non-admins cannot see or change the Responsible person, but they must be assigned to update the date.
        // Admins must fill Responsible and Start Date.
        if (isAdmin && (!formData.Planned_Start_Timestamp || !formData.Planned_Start_Timestamp.isValid() || !formData.Responsibility)) {
            setError("Please fill all required fields: Start Date and Person Responsible.");
            setLoading(false);
            return;
        }
        
        // Non-admin logic: they can only submit if they are the assigned person, regardless of whether the fields are disabled
        if (!isAdmin && formData.Responsibility !== userEmail) {
            setError("You can only update the details of tasks assigned to you.");
            setLoading(false);
            return;
        }


        try {
            const mainTaskPayload = {
                ...formData,
                Key: taskKey, // Use the validated key string
                Planned_Start_Timestamp: formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.toISOString() : null,
                Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.toISOString() : null,
                Updated_at: moment.utc().toISOString(), 
            };
            
            // Only update Responsibility/Emails if the user is an admin
            if (!isAdmin) {
                // Non-admins should not submit changes to these fields,
                // so ensure we send the original values back to prevent accidental overwrite.
                mainTaskPayload.Responsibility = task.Responsibility || '';
                mainTaskPayload.Emails = task.Emails || '';
            }


            const perKeyPerDayRows = [];
            
            if (formData.Planned_Start_Timestamp && formData.Planned_Start_Timestamp.isValid()) {
                perKeyPerDayRows.push({
                    Key: taskKey, // Use the validated key string
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

            await response.json(); 
            
            setSuccess('Task and schedule updated successfully!');
            onSubmit(formData); 
        } catch (err) {
            console.error('Error updating task:', err);
            setError(`Failed to update task: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };


    // Filter persons for dropdown
    const personsToDisplay = persons.map(p => ({ 
        value: p.Emp_Emails, 
        label: p.Current_Employes 
    }));

    // Logic for pre-populating the selected person
    let selectedPerson = personsToDisplay.find(p => p.value === formData.Emails);
    
    if (!selectedPerson && formData.Responsibility) {
        selectedPerson = { 
            value: formData.Responsibility, 
            label: formData.Responsibility 
        };
    }

    // Disabling logic for non-admins
    const isAssignedToSomeone = !!formData.Responsibility && formData.Responsibility !== "System";
    const isAssignedToCurrentUser = formData.Emails === userEmail; 

    // Date/Time fields can only be edited by Admins OR the person assigned to the task
    const isPlannedStartDisabled = !isAdmin && !isAssignedToCurrentUser;


    // Button should be disabled if loading OR if it's a non-admin and the task isn't assigned to them
    const isSubmitDisabled = loading || (!isAdmin && !isAssignedToCurrentUser); 
    
    // Admin checks only for loading
    const isSelectDisabled = loadingPersons; 


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
            
            {/* Planned To Work On - Disabled for non-admins if they aren't assigned */}
            <Form.Group className="mb-3">
                <Form.Label>Planned To Work On<span className="text-danger">*</span></Form.Label> 
                <Form.Control
                    type="date"
                    name="Planned_Start_Timestamp"
                    value={formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : ''}
                    onChange={handleStartDateChange}
                    disabled={isPlannedStartDisabled} 
                    required
                />
                {isPlannedStartDisabled && (
                    <Form.Text className="text-danger">
                        Only Admins or the assigned person can set the start date.
                    </Form.Text>
                )}
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Delivery Deadline</Form.Label>
                <Form.Control
                    type="date"
                    name="Planned_Delivery_Timestamp"
                    value={formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : ''}
                    readOnly
                    disabled={true}
                />
            </Form.Group>

            {/* Person Responsible - ONLY VISIBLE TO ADMINS */}
            {isAdmin && (
                <Form.Group className="mb-3">
                    <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                    <Select
                        name="Responsibility"
                        options={personsToDisplay}
                        value={selectedPerson} 
                        onChange={handlePersonSelect}
                        // Admins can always edit, only disable if loading the list
                        isDisabled={isSelectDisabled} 
                        placeholder="Select Person"
                        isClearable
                        required
                    />
                    {isAssignedToSomeone && (
                        <Form.Text className="text-muted">
                            This task is currently assigned to: {formData.Responsibility}.
                        </Form.Text>
                    )}
                </Form.Group>
            )}
            
            {/* Show Read-Only Responsible Field for Non-Admins */}
            {!isAdmin && isAssignedToSomeone && (
                 <Form.Group className="mb-3">
                    <Form.Label>Person Responsible</Form.Label>
                    <Form.Control
                        type="text"
                        value={formData.Responsibility}
                        disabled={true}
                    />
                    {isAssignedToCurrentUser && (
                        <Form.Text className="text-success">
                            This task is assigned to you. You can update the start date.
                        </Form.Text>
                    )}
                 </Form.Group>
            )}
            
            {/* Show Read-Only Field if Unassigned and not Admin */}
            {!isAdmin && !isAssignedToSomeone && (
                <Form.Group className="mb-3">
                    <Form.Label>Person Responsible</Form.Label>
                    <Form.Control
                        type="text"
                        value="Unassigned (Only Admin can assign)"
                        disabled={true}
                    />
                </Form.Group>
            )}

            <Button variant="primary" type="submit" disabled={isSubmitDisabled}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Task'}
            </Button>
            
            {/* Warning for non-admins not assigned to the task */}
            {!isAdmin && !isAssignedToCurrentUser && (
                <Form.Text className="text-danger ms-3">
                    You can only update tasks that are assigned to you.
                </Form.Text>
            )}
        </Form>
    );
};

export default FormComponent;
