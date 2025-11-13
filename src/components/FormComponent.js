import React, { useState, useEffect, memo, useCallback } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

// Define the emails of users who can see and edit the full list
const ADMIN_EMAILS = [
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

// Comprehensive map for person name to their primary email and full emails string (for BigQuery's 'Emails' column in main task table)
const PERSON_EMAIL_DATA_MAP = {
    "Neelam Purohit": { primaryEmail: "neelam.p@brightbraintech.com", allEmails: "neelam.p@brightbraintech.com" },
    "Meghna Jalali": { primaryEmail: "meghna.j@brightbraintech.com", allEmails: "meghna.j@brightbraintech.com" },
    "Zoya Ansari": { primaryEmail: "zoya.a@brightbraintech.com", allEmails: "zoya.a@brightbraintech.com" },
    "Shweta Gaikwad": { primaryEmail: "shweta.g@brightbraintech.com", allEmails: "shweta.g@brightbraintech.com" },
    "Hitesh Rattesar": { primaryEmail: "hitesh.r@brightbraintech.com", allEmails: "hitesh.r@brightbraintech.com" },
    "System": { primaryEmail: "systems@brightbraintech.com", allEmails: "systems@brightbraintech.com" },
    "Divya Sharma": { primaryEmail: "divya.s@brightbraintech.com", allEmails: "divya.s@brightbraintech.com"},
    "Manish Hodlur": { primaryEmail: "manish.h@brightbraintech.com", allEmails: "manish.h@brightbraintech.com"}
    // Add other people as needed
};

// HARDCODED LIST OF PERSONS - Ensure this list is comprehensive
const ALL_AVAILABLE_PERSONS_HARDCODED = [
    "Abhinav Verma", "Aishwarya Mulay", "Akanksha Bhande", "Aniruddh Pachupate", "Arvanbir Sandhu", 
    "Divya Sharma", "Divyanshi Agarwal", "Hitesh Rattesar", "HR", "Jairaj Shetty", "Josika Bhattacharjee", 
    "Manish Hodlur", "Megha Vyas", "Meghna Jalali", "Nasir Ali Shaikh", "Neelam Purohit", 
    "Neha Saraogi", "Nikhil Surve", "Nirali Shah", "Pooja Rane", "Prashant Shaharkar", 
    "Pratham Kotian", "Ranjeet Bubber", "Sarthak Chauhan", "Shameen Bajaj", "Shayesha Lobo", 
    "Shumael Nawaz", "Shweta Gaikwad", "Suhail Bajaj", "System", "Viraj Chindarkar", "Zoya Ansari"
];

// Define the base URL for your backend API
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const FormComponent = ({ onSubmit, task, currentUserEmail }) => {
    const [form] = Form.useForm();
    const [sliderCount, setSliderCount] = useState(0);
    const [hours, setHours] = useState({});
    const [startDate, setStartDate] = useState(() =>
        task?.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null
    );

    const [endDate, setEndDate] = useState(() =>
        task?.Planned_Delivery_Timestamp ? moment(task.Planned_Delivery_Timestamp) : null
    );

    const [personResponsible, setPersonResponsible] = useState('');
    // FIX: Removed unused state variable 'numberOfDays'
    const [existingSchedules, setExistingSchedules] = useState({});

    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

    const getPersonNameFromEmail = useCallback((email) => {
        const entry = Object.entries(PERSON_EMAIL_DATA_MAP).find(([, value]) => 
            value.primaryEmail === email || value.allEmails.includes(email)
        );
        return entry ? entry[0] : null;
    }, []);

    const calculateTotalTime = () => {
        return Object.values(hours).reduce((total, minutes) => total + minutes, 0);
    };
    
    // Logic for handling daily time allocation and checking against max capacity
    const handleSliderChange = useCallback((index, value) => {
        const numericValue = value || 0; 
        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480; 

        const alreadyScheduledMinutes = existingSchedules[personResponsible]?.[currentDay] || 0;
        
        const remainingMinutes = maxAllowedMinutes - alreadyScheduledMinutes;
        
        let effectiveValue = numericValue;
        
        if (effectiveValue > remainingMinutes) {
            effectiveValue = remainingMinutes; 
            notification.warning({
                message: 'Time Limit Reached',
                description: `Cannot schedule more than ${maxAllowedMinutes - alreadyScheduledMinutes} minutes for ${personResponsible} on ${currentDay} due to existing tasks.`,
            });
        }
        
        setHours((prev) => ({ ...prev, [index]: effectiveValue }));
        
        return effectiveValue;
    }, [startDate, personResponsible, existingSchedules]);

    // Simplified input handler to call the core logic
    const handleInputChange = (index, value) => {
        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue) || numericValue < 0) {
            numericValue = 0;
        }
        handleSliderChange(index, numericValue);
    };

    // --- EFFECT HOOK 1: FETCH TASK DATA AND EXISTING SCHEDULES ---
    useEffect(() => {
        const fetchTaskAndScheduleData = async () => {
            try {
                if (!task) return;

                form.setFieldsValue({
                    name: task.Task_Details || '',
                });

                // 1. Fetch task-specific duration data
                // BACKEND_API_BASE_URL is a constant, safe to use inside without being a dependency.
                const taskResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                if (!taskResponse.ok) throw new Error(`HTTP error! status: ${taskResponse.status}`);
                const taskData = await taskResponse.json();
                
                // Set initial hours based on fetched data, relative to startDate
                const taskEntries = taskData[task.Key]?.entries;
                const initialHours = {};

                if (taskEntries && taskEntries.length > 0 && startDate) {
                    taskEntries.forEach((entry) => {
                        if (entry.Duration !== undefined && entry.Day !== undefined) {
                            const dayMoment = moment(entry.Day.value);
                            // Only consider schedules that fall on or after the planned start date
                            if (dayMoment.isValid() && dayMoment.isSameOrAfter(startDate, 'day')) {
                                const dayIndex = dayMoment.diff(startDate, 'days');
                                initialHours[dayIndex] = entry.Duration;
                            }
                        }
                    });
                }
                setHours(initialHours);

                // 2. Fetch person-specific daily schedules (for validation)
                const perPersonResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-person-per-day`);
                if (!perPersonResponse.ok) throw new Error(`HTTP error! status: ${perPersonResponse.status}`);
                const perPersonData = await perPersonResponse.json();
                
                const schedules = {};
                perPersonData.forEach((entry) => {
                    const { Responsibility, Day, Duration_In_Minutes } = entry;
                    const date = Day.value;
                    if (!schedules[Responsibility]) {
                        schedules[Responsibility] = {};
                    }
                    schedules[Responsibility][date] = Duration_In_Minutes;
                });
                setExistingSchedules(schedules);

            } catch (error) {
                console.error("Error fetching task data or schedules:", error);
                notification.error({ 
                    message: 'Error', 
                    description: `Failed to load task data or existing schedules: ${error.message}.` 
                });
            }
        };

        fetchTaskAndScheduleData();
    }, [task, form, startDate]); // FIX: Removed BACKEND_API_BASE_URL

    // --- EFFECT HOOK 2: SET INITIAL DATES AND PERSON RESPONSIBLE ---
    useEffect(() => {
        const initialResponsibilityFromTask = task?.Responsibility || '';
        const userPersonName = getPersonNameFromEmail(currentUserEmail);

        let initialPerson = '';
        if (isAdmin && initialResponsibilityFromTask) {
            // Admin: use the person already assigned to the task
            initialPerson = initialResponsibilityFromTask;
        } else if (userPersonName && ALL_AVAILABLE_PERSONS_HARDCODED.includes(userPersonName)) {
            // Non-Admin: use the current user's name if they are in the list
            initialPerson = userPersonName;
        }

        // Set form fields and local state
        if (initialPerson) {
            form.setFieldsValue({ personResponsible: initialPerson });
            setPersonResponsible(initialPerson);
        }

        // Calculate initial days difference if both dates are valid
        if (startDate && endDate && endDate.isSameOrAfter(startDate, 'day')) {
            const daysDiff = endDate.diff(startDate, 'days') + 1;
            setSliderCount(daysDiff);
        } else {
            setSliderCount(0);
        }

    }, [task, currentUserEmail, isAdmin, getPersonNameFromEmail, form, startDate, endDate]);


    // --- HANDLERS ---

    const handleStartDateChange = (date) => {
        setStartDate(date);
        // Recalculate days and slider count based on new start date
        if (date && endDate && endDate.isSameOrAfter(date, 'day')) {
            const daysDiff = endDate.diff(date, 'days') + 1;
            setSliderCount(daysDiff);
        } else {
            setSliderCount(0);
        }
        setHours({}); // Clear hours on start date change to avoid misalignment
    };

    const handleEndDateChange = (date) => {
        setEndDate(date);
        // Recalculate days and slider count based on new end date
        if (date && startDate && date.isSameOrAfter(startDate, 'day')) {
            const daysDiff = date.diff(startDate, 'days') + 1;
            setSliderCount(daysDiff);
        } else {
            setSliderCount(0);
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            const totalTimeMinutes = calculateTotalTime();
            if (totalTimeMinutes <= 0) {
                notification.error({
                    message: 'Validation Error',
                    description: 'Total time allocated must be greater than zero.',
                });
                return;
            }

            const formattedHours = Object.keys(hours).map((index) => ({
                Day: moment(startDate).add(parseInt(index, 10), 'days').format('YYYY-MM-DD'),
                Duration: hours[index],
            }));
            
            const personName = values.personResponsible;
            const personEmailData = PERSON_EMAIL_DATA_MAP[personName];

            if (!personEmailData) {
                 notification.error({
                    message: 'Validation Error',
                    description: `Could not find email data for person: ${personName}.`,
                });
                return;
            }

            const payload = {
                taskKey: task.Key,
                taskDetails: values.name,
                startDate: startDate.format('YYYY-MM-DD HH:mm:ss'),
                endDate: endDate.format('YYYY-MM-DD HH:mm:ss'),
                totalTime: totalTimeMinutes,
                dailyAllocations: formattedHours,
                personResponsible: personName,
                personEmail: personEmailData.primaryEmail,
                personAllEmails: personEmailData.allEmails,
                userEmail: currentUserEmail,
            };

            onSubmit(payload);
        } catch (error) {
            console.error('Validation Failed:', error);
            if (error.errorFields) {
                notification.error({
                    message: 'Validation Error',
                    description: 'Please correct the highlighted fields.',
                });
            } else {
                 notification.error({
                    message: 'Submission Error',
                    description: 'An unexpected error occurred during form submission.',
                });
            }
        }
    };
    
    // Filter persons to display based on whether they are in the hardcoded list
    const personsToDisplay = ALL_AVAILABLE_PERSONS_HARDCODED.filter(person => 
        // Only show persons with email data (for safety), or the currently assigned person if not in the map
        PERSON_EMAIL_DATA_MAP[person] || person === task?.Responsibility
    ).sort();

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ 
                name: task?.Task_Details || '',
                // Set initial date/time fields to moment objects if they exist
                startDate: startDate,
                endDate: endDate,
                personResponsible: personResponsible
            }}
            className="schedule-form"
        >
            <Form.Item label="Task Name (Read Only)" name="name">
                <Input disabled />
            </Form.Item>

            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item
                        label="Start Date & Time"
                        name="startDate"
                        rules={[{ required: true, message: 'Please select a start date!' }]}
                    >
                        <DatePicker
                            showTime
                            format="YYYY-MM-DD HH:mm:ss"
                            style={{ width: '100%' }}
                            onChange={handleStartDateChange}
                            disabledDate={(current) => current && current < moment().startOf('day')}
                        />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        label="End Date & Time"
                        name="endDate"
                        rules={[{ required: true, message: 'Please select an end date!' }]}
                    >
                        <DatePicker
                            showTime
                            format="YYYY-MM-DD HH:mm:ss"
                            style={{ width: '100%' }}
                            onChange={handleEndDateChange}
                            disabledDate={(current) => current && current < moment(startDate).startOf('day')}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <h6 className="mt-3">Daily Time Allocation (Total: {Math.round(calculateTotalTime() / 60)}h {calculateTotalTime() % 60}m)</h6>
            
            {[...Array(sliderCount)].map((_, index) => (
                <Form.Item
                    key={index}
                    label={`Day ${index + 1} (${moment(startDate).add(index, 'days').format('ddd, MMM DD')})`}
                    className="slider-item"
                >
                    <Row gutter={16} align="middle">
                        <Col span={18}>
                            <Slider
                                min={0}
                                max={480} // 8 hours in minutes
                                step={15} // 15-minute increments
                                onChange={(value) => handleSliderChange(index, value)}
                                value={hours[index] || 0}
                                tooltip={{ formatter: (value) => `${value} min` }}
                            />
                        </Col>
                        <Col span={6}>
                            <Input
                                value={hours[index] || 0}
                                onChange={(e) => handleInputChange(index, e.target.value)}
                                addonAfter="min"
                            />
                        </Col>
                    </Row>
                </Form.Item>
            ))}

            <Form.Item
                label="Person Responsible"
                name="personResponsible"
                rules={[{ required: true, message: 'Please select the person responsible!' }]}
            >
                <Select
                    placeholder="Select a person"
                    onChange={setPersonResponsible}
                    value={personResponsible || undefined}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    // Disable if the user is not an admin
                    disabled={!isAdmin}
                >
                    {personsToDisplay.map((person) => (
                        <Option key={person} value={person}>
                            {person}
                        </Option>
                    ))}
                </Select>
            </Form.Item>

            <Form.Item>
                <Button type="primary" htmlType="submit" onClick={handleSubmit}>
                    Submit
                </Button>
            </Form.Item>
        </Form>
    );
};

export default memo(FormComponent);
