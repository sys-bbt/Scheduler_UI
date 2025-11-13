import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Spinner, Alert, Row, Col } from 'react-bootstrap'; 
import Select from 'react-select'; 
import moment from 'moment';

const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const ADMIN_EMAILS_FRONTEND = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "divya.s@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "altaf.s@brightbraintech.com",
    "arvanbir.s@brightbraintech.com"
];

// PERSON DATA MAP: This list should be fetched from the backend but is kept here for front-end mapping
const PERSON_EMAIL_DATA_MAP = {
    // You MUST ensure this map is comprehensive and up-to-date with your actual users/roles.
    "Neelam Purohit": { primaryEmail: "neelam.p@brightbraintech.com", allEmails: "neelam.p@brightbraintech.com" },
    "Meghna Jalali": { primaryEmail: "meghna.j@brightbraintech.com", allEmails: "meghna.j@brightbraintech.com" },
    "Zoya Ansari": { primaryEmail: "zoya.a@brightbraintech.com", allEmails: "zoya.a@brightbraintech.com" },
    // ADD ALL OTHER PERSONS HERE
};

// Simplified Person List for Display in Select
const ALL_AVAILABLE_PERSONS_HARDCODED = [
    "Neelam Purohit", "Meghna Jalali", "Zoya Ansari", "System", "Divya Sharma", "Manish Hodlur",
    // ADD ALL OTHER PERSONS HERE
];

const FormComponent = ({ onSubmit, task, currentUserEmail, actionType }) => {
    const isAdmin = ADMIN_EMAILS_FRONTEND.includes(currentUserEmail);

    const [selectedPerson, setSelectedPerson] = useState(() => {
        const responsibility = task?.Responsibility;
        if (responsibility) {
            return { value: responsibility, label: responsibility };
        }
        return null;
    });

    const [loading, setLoading] = useState(false);
    const [taskDetails, setTaskDetails] = useState(task?.Task_Details || '');
    
    // Non-admins can only see the form when it's opened for 'Reassign' but cannot submit
    const isFieldDisabledForNonAdmin = !isAdmin && (actionType !== 'Reassign');

    const handlePersonSelect = (option) => {
        setSelectedPerson(option);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedPerson || !selectedPerson.value) {
            alert("Please select a person responsible.");
            return;
        }

        const personName = selectedPerson.value;
        const personEmailData = PERSON_EMAIL_DATA_MAP[personName] || {};
        
        if (!personEmailData.primaryEmail) {
            alert(`Could not find email data for person: ${personName}. Cannot proceed.`);
            return;
        }

        const initiatedTimestamp = task.Initiated_Timestamp?.value || task.Initiated_Timestamp;
        
        if (!initiatedTimestamp) {
            alert("Cannot submit: Workflow initiated timestamp is missing for End Date calculation.");
            return;
        }
        
        // Use the Initiated Timestamp for a single-day placeholder schedule
        const singleDay = moment(initiatedTimestamp).format('YYYY-MM-DD');

        setLoading(true);

        // Payload constructed to satisfy both Responsibility update and BQ Per_Key_per_Day requirements
        const payload = {
            taskKey: task.Key,
            taskDetails: taskDetails, 
            personResponsible: personName,
            personEmail: personEmailData.primaryEmail,
            personAllEmails: personEmailData.allEmails,
            userEmail: currentUserEmail,
            
            // PLACEHOLDER BQ FIELDS - Requirement: Use initiated time for end date, duration is 0
            plannedStartDate: initiatedTimestamp, 
            plannedEndDate: initiatedTimestamp, 
            noOfDays: 1, // Single day schedule
            dailyHours: { 
                [singleDay]: 0 // 0 minutes allocated for the single day
            },
            durationUnit: 'minutes', 
            totalTime: 0, 
            plannedDeliverySlot: null, 
            isReassignmentOnly: true, // Flag for backend clarity
        };

        try {
            // Call the onSubmit prop passed from DeliveryDetail.js (which uses /api/schedule-task)
            await onSubmit(payload); 
        } catch (error) {
            console.error("Submission failed:", error);
            alert(`Failed to update task: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Prepare options for react-select
    const personsToDisplay = ALL_AVAILABLE_PERSONS_HARDCODED.filter(person => 
        PERSON_EMAIL_DATA_MAP[person] || person === task?.Responsibility
    ).map(person => ({
        value: person,
        label: person
    })).sort((a, b) => a.label.localeCompare(b.label));

    return (
        <Form onSubmit={handleFormSubmit} className="schedule-form">
            
            {/* Task Details (Read-Only) */}
            <Form.Group className="mb-3">
                <Form.Label>Task Name</Form.Label>
                <Form.Control
                    type="text"
                    value={taskDetails}
                    disabled
                />
            </Form.Group>
            
            {/* Person Responsible */}
            <Form.Group className="mb-3">
                <Form.Label>Person Responsible<span className="text-danger">*</span></Form.Label>
                <Select
                    name="Responsibility"
                    options={personsToDisplay}
                    value={selectedPerson}
                    onChange={handlePersonSelect}
                    isDisabled={!isAdmin} // Only Admins can reassign
                    placeholder="Select Person"
                    isClearable
                    required
                />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={loading || !isAdmin}>
                {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : 'Update Responsibility'}
            </Button>
            
            {!isAdmin && (
                <Alert variant="warning" className="mt-2">Only Administrators can update the task responsibility.</Alert>
            )}
        </Form>
    );
};

export default FormComponent;
