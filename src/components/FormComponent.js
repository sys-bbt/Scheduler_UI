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
    "Manish Hodlur", "Megha Vyas", "Meghna Jalali", "Nasir Ali  Shaikh", "Neelam Purohit", 
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
    const [numberOfDays, setNumberOfDays] = useState(0);
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
        const numericValue = value || 0; // Ensure it's a number, default to 0
        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480; // 8 hours * 60 minutes

        // Calculate minutes already scheduled for this person on this day
        const alreadyScheduledMinutes = existingSchedules[personResponsible]?.[currentDay] || 0;
        
        // Calculate remaining capacity for this person on this day
        // This is the max capacity MINUS the time already scheduled by OTHERS/PREVIOUS tasks on that day
        const remainingMinutes = maxAllowedMinutes - alreadyScheduledMinutes;
        
        // The value to set, capped at the remaining capacity
        let effectiveValue = numericValue;
        
        // Only apply cap if the slider is not for the current task's *existing* schedule
        // and if it exceeds the remaining minutes.
        if (effectiveValue > remainingMinutes) {
            effectiveValue = remainingMinutes; // Cap the value
            notification.warning({
                message: 'Time Limit Reached',
                description: `Cannot schedule more than ${maxAllowedMinutes - alreadyScheduledMinutes} minutes for ${personResponsible} on ${currentDay} due to existing tasks.`,
            });
        }
        
        // Update the state for the specific day
        setHours((prev) => ({ ...prev, [index]: effectiveValue }));
        
        // Return the capped value to update the slider/input visually
        return effectiveValue;
    }, [startDate, personResponsible, existingSchedules]);

    // Simplified input handler to call the core logic
    const handleInputChange = (index, value) => {
        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue) || numericValue < 0) {
            numericValue = 0;
        }
        // Use the core logic to update the state and handle validation
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
    }, [task, form, startDate, BACKEND_API_BASE_URL]);

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
            setNumberOfDays(daysDiff);
            setSliderCount(daysDiff);
        } else {
            setNumberOfDays(0);
            setSliderCount(0);
        }

    }, [task, currentUserEmail, isAdmin, getPersonNameFromEmail, form, startDate, endDate]);


    // --- HANDLERS ---

    const handleStartDateChange = (date) => {
        setStartDate(date);
        // Recalculate days and slider count based on new start date
        if (date && endDate && endDate.isSameOrAfter(date, 'day')) {
            const daysDiff = endDate.diff(date, 'days') + 1;
            setNumberOfDays(daysDiff);
            setSliderCount(daysDiff);
        } else {
            setNumberOfDays(0);
            setSliderCount(0);
        }
        setHours({}); // Clear hours on start date change to avoid misalignment
    };

    const handleEndDateChange = (date) => {
        setEndDate(date);
        // Recalculate days and slider count based on new end date
        if (date && startDate && date.isSameOrAfter(startDate, 'day')) {
            const daysDiff = date.diff(startDate, 'days') + 1;
            setNumberOfDays(daysDiff);
            setSliderCount(daysDiff);
        } else {
            setNumberOfDays(0);
            setSliderCount(0);
        }
    };

    const handleSubmit = () => {
        form.validateFields()
            .then(async (values) => {
                const totalTime = calculateTotalTime();
                if (totalTime <= 0) {
                    notification.error({
                        message: 'Missing Allocation',
                        description: 'Please allocate total time to days.',
                    });
                    return;
                }
                
                const plannedStartTimestamp = startDate ? moment(startDate).startOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC" : null;
                const plannedDeliveryTimestamp = endDate ? moment(endDate).endOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC" : null;

                const slidersData = Array.from({ length: sliderCount }).map((_, index) => {
                    const calculatedDay = moment(startDate).add(index, 'days');
                    const formattedDay = calculatedDay.isValid() ? calculatedDay.format('YYYY-MM-DD') : null;
                    return {
                        day: formattedDay,
                        duration: hours[index] || 0,
                        slot: "Null",
                        personResponsible: personResponsible,
                    };
                }).filter(data => data.duration > 0); // Only send days with allocated time

                const selectedPersonEmailData = PERSON_EMAIL_DATA_MAP[personResponsible];
                
                const scheduledData = {
                    Key: task.Key,
                    Delivery_code: task.Delivery_code,
                    DelCode_w_o__: task.DelCode_w_o__,
                    Step_ID: task.Step_ID,
                    Task_Details: values.name,
                    Frequency___Timeline: task.Frequency___Timeline,
                    Client: task.Client,
                    Short_Description: task.Short_Description,
                    Planned_Start_Timestamp: plannedStartTimestamp,
                    Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
                    Responsibility: personResponsible,
                    Current_Status: "Scheduled", // Assuming status changes to 'Scheduled'
                    Email: selectedPersonEmailData ? selectedPersonEmailData.primaryEmail : null,
                    Emails: selectedPersonEmailData ? selectedPersonEmailData.allEmails : null,
                    totalTime: totalTime,
                    schedule: slidersData,
                };
                
                // Pass the complete scheduledData to the parent's onSubmit handler
                await onSubmit(scheduledData); 

                // Reset form state after successful submission
                form.resetFields();
                setStartDate(null);
                setEndDate(null);
                setHours({});
                setPersonResponsible('');
                setSliderCount(0);

            })
            .catch((info) => {
                console.log('Validate Failed:', info);
                notification.error({
                    message: 'Validation Error',
                    description: 'Please complete all required fields and check your time allocations.',
                });
            });
    };

    const personsToDisplay = isAdmin 
        ? ALL_AVAILABLE_PERSONS_HARDCODED 
        : ALL_AVAILABLE_PERSONS_HARDCODED.filter(p => p === personResponsible || p === getPersonNameFromEmail(currentUserEmail));

    const disabledDate = (current) => {
        // Cannot select days before today
        return current && current < moment().startOf('day');
    };

    const disabledEndDate = (current) => {
        // Cannot select days before the start date
        return current && current < startDate;
    };


    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ name: task?.Task_Details || '' }}
        >
            <Form.Item
                label="Task Name"
                name="name"
                rules={[{ required: true, message: 'Please input the task name!' }]}
            >
                <Input disabled={!isAdmin} />
            </Form.Item>

            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item
                        label="Planned Start Date"
                        name="plannedStartDate"
                        rules={[{ required: true, message: 'Please select start date!' }]}
                        initialValue={startDate}
                    >
                        <DatePicker 
                            onChange={handleStartDateChange} 
                            disabledDate={disabledDate} 
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        label="Planned Delivery Date"
                        name="plannedDeliveryDate"
                        rules={[{ required: true, message: 'Please select delivery date!' }]}
                        initialValue={endDate}
                    >
                        <DatePicker 
                            onChange={handleEndDateChange} 
                            disabledDate={disabledEndDate} 
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            {/* Daily Time Allocation Sliders */}
            {Array.from({ length: sliderCount }).map((_, index) => (
                <Form.Item
                    key={index}
                    label={`Day ${index + 1}: ${moment(startDate).add(index, 'days').format('YYYY-MM-DD')}`}
                    required
                >
                    <Row gutter={8} align="middle">
                        <Col span={18}>
                            <Slider
                                min={0}
                                max={480} // Max 8 hours (480 minutes)
                                step={5}
                                value={hours[index] || 0}
                                onChange={(value) => handleSliderChange(index, value)}
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
                    // Disable if the user is not an admin, or if a person is already assigned and it's not the current user
                    disabled={!isAdmin && personResponsible !== getPersonNameFromEmail(currentUserEmail)}
                >
                    {personsToDisplay.map((person) => (
                        <Option key={person} value={person}>
                            {person}
                        </Option>
                    ))}
                </Select>
            </Form.Item>

            <Form.Item>
                <Button type="primary" htmlType="submit">
                    Submit
                </Button>
            </Form.Item>
        </Form>
    );
};

export default memo(FormComponent);
