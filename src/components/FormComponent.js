// src/components/FormComponent.js
import React, { useState, useEffect, useContext } from 'react';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import Select from 'react-select';
import moment from 'moment';
// 1. Import useUser hook (or UserContext if preferred)
import { UserContext, useUser } from './UserContext'; // Assuming useUser is exported from UserContext.js

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// 🛑 REMOVED: Deleted the hardcoded ADMIN_EMAILS_FRONTEND list

const FormComponent = ({ onSubmit, task, currentUserEmail }) => {
    // 2. Destructure the isAdmin status from the context
    const { userEmail, isAdmin } = useUser(); // Using the useUser hook for clean access

    // 🛑 REMOVED: Deleted the line const isAdmin = ADMIN_EMAILS_FRONTEND.includes(userEmail);

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
            // Simplified date extraction for robustness
            const extractDate = (dateField) => {
                if (!dateField) return null;
                // Handle BigQuery object format { value: 'timestamp' }
                const rawDate = typeof dateField === 'object' && dateField.value 
                    ? dateField.value 
                    : dateField;
                return moment(rawDate);
            };

            const initialStartDate = extractDate(task.Planned_Start_Timestamp);
            const initialDeliveryDate = extractDate(task.Planned_Delivery_Timestamp);

            setFormData({
                Key: String(task.Key || ''), 
                Delivery_code: task.Delivery_code || '',
                DelCode_w_o__: task.DelCode_w_o__ || '',
                Step_ID: task.Step_ID || 0,
                Task_Details: task.Task_Details || '',
                Frequency___Timeline: task.Frequency___Timeline || '',
                Client: task.Client || '',
                Short_Description: task.Short_Description || '',
                // Ensure moments are valid before setting
                Planned_Start_Timestamp: initialStartDate && initialStartDate.isValid() ? initialStartDate : null, 
                Planned_Delivery_Timestamp: initialDeliveryDate && initialDeliveryDate.isValid() ? initialDeliveryDate : null, 
                Responsibility: task.Responsibility || '',
                Email: task.Email || '',
                Emails: task.Emails || '', 
                Current_Status: task.Current_Status || '',
                Total_Tasks: task.Total_Tasks || 0,
                Completed_Tasks: task.Completed_Tasks || 0,
                Planned_Tasks: task.Planned_Tasks || 0,
                Percent_Tasks_Completed: task.Percent_Tasks_Completed || 0,
                Created_at: task.Created_at || null,
                Updated_at: null,
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
                    // Changed to response.text() for better generic error handling
                    const errorText = await response.text(); 
                    throw new Error(`Failed to fetch people mapping data. Server response: ${response.status} ${errorText}`);
                }
                const data = await response.json();
                setPersons(data);
            } catch (err) {
                console.error("Failed to load person data:", err);
                setPersonError(`Failed to load person data: ${err.message}.`);
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

        // Date restriction validation: Planned To Work On must be before the Delivery Deadline
        if (formData.Planned_Start_Timestamp && formData.Planned_Delivery_Timestamp && 
            formData.Planned_Start_Timestamp.isSameOrAfter(formData.Planned_Delivery_Timestamp, 'day')) {
            setError("Planned To Work On date must be before the Delivery Deadline.");
            setLoading(false);
            return;
        }

        const taskKey = String(formData.Key).trim(); 
        if (!taskKey || taskKey === '0') {
            setError("Cannot update task: Unique Task Key is missing or invalid.");
            setLoading(false);
            return;
        }

        if (!formData.Planned_Start_Timestamp || !formData.Planned_Start_Timestamp.isValid() || !formData.Responsibility) {
            setError("Please fill all required fields: Planned To Work On and Person Responsible.");
            setLoading(false);
            return;
        }

        try {
            const mainTaskPayload = {
                ...formData,
                Key: taskKey, 
                Planned_Start_Timestamp: formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.toISOString() : null,
                Planned_Delivery_Timestamp: formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.toISOString() : null,
                Updated_at: moment.utc().toISOString(), 
            };

            const perKeyPerDayRows = [];
             
            if (formData.Planned_Start_Timestamp && formData.Planned_Start_Timestamp.isValid()) {
                perKeyPerDayRows.push({
                    Key: taskKey, 
                    Day: formData.Planned_Start_Timestamp.format('YYYY-MM-DD'),
                    Duration: 0,
                    Duration_Unit: 'min',
                    Planned_Delivery_Slot: null,
                    Responsibility: mainTaskPayload.Responsibility,
                });
            }

            const payload = {
                mainTask: mainTaskPayload,
                perKeyPerDayRows: perKeyPerDayRows,
                requestingUserEmail: userEmail
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

    // Pre-populating the selected person logic
    let selectedPerson = personsToDisplay.find(p => p.value === formData.Emails);
      
    if (!selectedPerson && formData.Responsibility) {
        selectedPerson = { 
            value: formData.Responsibility, 
            label: formData.Responsibility 
        };
    }

    // Disabling logic for Person Responsible (Admin-only change)
    const isResponsibilityDisabled = !isAdmin;

    // Max selectable date (Planned To Work On must be before Delivery Deadline)
    const maxDate = formData.Planned_Delivery_Timestamp
        ? formData.Planned_Delivery_Timestamp.clone().subtract(1, 'day').format('YYYY-MM-DD') 
        : undefined;

    return (
        // Replaced Card with div and removed styling classes
        <div> 
            {/* Replaced Card.Header with div and removed styling classes */}
            <div> 
                <h6>Schedule Task: {task?.Short_Description || task?.Task_Details}</h6>
            </div>
            {/* Replaced Card.Body with div and removed styling classes */}
            <div> 
                <Form onSubmit={handleSubmit}>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {success && <Alert variant="success">{success}</Alert>}
                    {personError && <Alert variant="warning">{personError}</Alert>}

                    {/* Task Details - Always disabled and visible */}
                    <Form.Group className="mb-3">
                        <Form.Label>Task Details</Form.Label>
                        <Form.Control
                            type="text"
                            name="Task_Details"
                            value={formData.Task_Details}
                            disabled={true} 
                            required
                        />
                    </Form.Group>

                    {/* Dates - Replaced Row/Col with div for default styling */}
                    <div className="mb-3">
                        {/* Planned To Work On (Input) */}
                        <div style={{ marginBottom: '1rem' }}> 
                            <Form.Group>
                                <Form.Label>Planned To Work On<span className="text-danger">*</span></Form.Label> 
                                <Form.Control
                                    type="date"
                                    name="Planned_Start_Timestamp"
                                    value={formData.Planned_Start_Timestamp ? formData.Planned_Start_Timestamp.format('YYYY-MM-DD') : ''}
                                    onChange={handleStartDateChange}
                                    max={maxDate} 
                                    required
                                />
                            </Form.Group>
                        </div>
                        {/* Delivery Deadline (Static) */}
                        <div>
                            <Form.Group>
                                <Form.Label>Delivery Deadline</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="Planned_Delivery_Timestamp"
                                    value={formData.Planned_Delivery_Timestamp ? formData.Planned_Delivery_Timestamp.format('YYYY-MM-DD') : ''}
                                    readOnly
                                    disabled={true}
                                />
                            </Form.Group>
                        </div>
                    </div>
                     
                    {/* Person Responsible (Select) */}
                    <Form.Group className="mb-4">
                        <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                        <Select
                            name="Responsibility"
                            options={personsToDisplay}
                            value={selectedPerson} 
                            onChange={handlePersonSelect}
                            isDisabled={isResponsibilityDisabled || loadingPersons} 
                            placeholder="Select Person"
                            isClearable
                            required
                        />
                        {isResponsibilityDisabled && ( 
                            <Form.Text className="text-muted">
                                This task is already assigned and can only be changed by an Admin.
                            </Form.Text>
                        )}
                    </Form.Group>

                    <Button variant="primary" type="submit" disabled={loading}> 
                        {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> : 'Update Task'}
                    </Button>
                </Form>
            </div>
        </div>
    );
};

// Export both for completeness
export { FormComponent, useUser }; 
export default FormComponent;
