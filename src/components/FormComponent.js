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

// Define the base URL for your backend API
// Ensure REACT_APP_BACKEND_URL is set in your frontend's .env file (e.g., .env.development, .env.production)
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
console.log('Using Backend API URL:', BACKEND_API_BASE_URL);

// FormComponent now expects 'task', 'onSubmit', 'peopleMapping', and 'currentUserEmail' as props
const FormComponent = ({ onSubmit, task, peopleMapping, currentUserEmail }) => {
    const [form] = Form.useForm();
    const [sliderCount, setSliderCount] = useState(0);
    const [hours, setHours] = useState({}); // Stores hours per day for the current task's schedule
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [deliverySlot, setDeliverySlot] = useState(null);
    const [personResponsible, setPersonResponsible] = useState(''); // Stores the NAME of the person
    const [numberOfDays, setNumberOfDays] = useState(0);
    // existingSchedules will store aggregated per-person-per-day data (Responsibility -> Day -> TotalMinutes)
    const [existingSchedules, setExistingSchedules] = useState({});

    // Determine if the current user is an admin
    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);
    console.log('FormComponent: currentUserEmail received:', currentUserEmail);
    console.log('FormComponent: isAdmin calculated as:', isAdmin);

    // Memoize the mapping logic to get email data from person's name using peopleMapping prop
    const getPersonEmailData = useCallback((personName) => {
        if (!peopleMapping || !personName) return null;
        const person = peopleMapping.find(p => p.Name === personName);
        if (person) {
            // Assuming your Google Sheet has 'Email_ID' and potentially an 'All_Emails' column
            return {
                primaryEmail: person.Email_ID,
                allEmails: person.All_Emails || person.Email_ID // Fallback to primary if All_Emails not present
            };
        }
        return null;
    }, [peopleMapping]);

    // Memoize the mapping logic to get person name from email
    const getPersonNameFromEmail = useCallback((email) => {
        if (!peopleMapping || !email) return null;
        const person = peopleMapping.find(p => p.Email_ID === email);
        return person ? person.Name : null;
    }, [peopleMapping]);


    // --- EFFECT HOOK 1: FETCH TASK DATA AND EXISTING SCHEDULES ---
    useEffect(() => {
        const fetchTaskAndScheduleData = async () => {
            try {
                if (task && task.Key) {
                    // Set initial form values from the task prop
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                        deliverySlot: task.Delivery_Slot || null, // Assuming Delivery_Slot exists in task
                        status: task.Status || 'Scheduled', // Assuming Status exists in task
                    });
                    setDeliverySlot(task.Delivery_Slot || null);

                    // Set initial person responsible based on task data
                    const initialResponsibilityFromTask = task.Responsibility || '';
                    if (initialResponsibilityFromTask) {
                        setPersonResponsible(initialResponsibilityFromTask);
                        form.setFieldsValue({ personResponsible: initialResponsibilityFromTask });
                    }

                    // 1. Fetch data per key per day for this specific task
                    const perKeyResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day?key=${task.Key}`);
                    if (!perKeyResponse.ok) {
                        const errorText = await perKeyResponse.text();
                        throw new Error(`HTTP error! status: ${perKeyResponse.status}, message: ${errorText}`);
                    }
                    const perKeyData = await perKeyResponse.json(); // This will be an array of objects

                    const newHours = {};
                    let currentStartDate = null;
                    let currentEndDate = null;

                    if (perKeyData.length > 0) {
                        // Sort data by Day to correctly determine start/end dates and map to slider index
                        perKeyData.sort((a, b) => moment(a.Day).diff(moment(b.Day)));
                        currentStartDate = moment(perKeyData[0].Day);
                        currentEndDate = moment(perKeyData[perKeyData.length - 1].Day);

                        perKeyData.forEach((entry) => {
                            const dayMoment = moment(entry.Day);
                            const dayIndex = dayMoment.diff(currentStartDate, 'days');
                            if (dayIndex >= 0) { // Ensure dayIndex is valid
                                newHours[dayIndex] = entry.Duration_In_Minutes;
                            }
                        });

                        setStartDate(currentStartDate);
                        setEndDate(currentEndDate);
                        const daysDiff = currentEndDate.diff(currentStartDate, 'days') + 1;
                        setNumberOfDays(daysDiff);
                        setSliderCount(daysDiff); // Set slider count based on fetched days
                    } else {
                        // If no per-key data, initialize with planned dates from main task, if available
                        if (task.Planned_Start_Timestamp) {
                            const plannedStart = moment(task.Planned_Start_Timestamp);
                            setStartDate(plannedStart);
                            if (task.Planned_Delivery_Timestamp) {
                                const plannedEnd = moment(task.Planned_Delivery_Timestamp);
                                setEndDate(plannedEnd);
                                const days = plannedEnd.diff(plannedStart, 'days') + 1;
                                setNumberOfDays(days);
                                setSliderCount(days);
                            }
                        }
                    }
                    setHours(newHours); // Set the hours state with fetched data


                    // 2. Fetch data per person per day (for max allowed minutes calculation)
                    // NOTE: The backend /api/per-person-per-day currently fetches ALL data.
                    // For large datasets, this could be inefficient. Ideally, this endpoint
                    // should be extended to filter by person and/or date.
                    const perPersonResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-person-per-day`);
                    if (!perPersonResponse.ok) {
                        const errorText = await perPersonResponse.text();
                        throw new Error(`HTTP error! status: ${perPersonResponse.status}, message: ${errorText}`);
                    }
                    const perPersonRawData = await perPersonResponse.json();

                    // Aggregate the raw data into a more usable structure:
                    // { 'person@example.com': { 'YYYY-MM-DD': totalMinutesForThatDay, ... }, ... }
                    const aggregatedPerPersonSchedules = {};
                    perPersonRawData.forEach((entry) => {
                        const { Responsibility: resp, Day, Duration_In_Minutes } = entry;
                        // Use moment(Day).format('YYYY-MM-DD') to ensure consistent date string format for keys
                        const date = moment(Day).format('YYYY-MM-DD');
                        if (!aggregatedPerPersonSchedules[resp]) {
                            aggregatedPerPersonSchedules[resp] = {};
                        }
                        // Initialize if not exists, then add. BigQuery's MERGE handles summing on backend.
                        // Here we just represent the current state from the fetch.
                        if (!aggregatedPerPersonSchedules[resp][date]) {
                            aggregatedPerPersonSchedules[resp][date] = 0;
                        }
                        aggregatedPerPersonSchedules[resp][date] += Duration_In_Minutes;
                    });
                    setExistingSchedules(aggregatedPerPersonSchedules);

                } else {
                    // Reset states if task or task.Key is not available (e.g., when opening for a new task)
                    form.resetFields();
                    setSliderCount(0);
                    setHours({});
                    setStartDate(null);
                    setEndDate(null);
                    setDeliverySlot(null);
                    setPersonResponsible('');
                    setNumberOfDays(0);
                    setExistingSchedules({});
                }
            } catch (error) {
                console.error("Error fetching task data or schedules:", error);
                notification.error({
                    message: 'Error',
                    description: `Failed to load task details and schedules: ${error.message}. Please check network and server logs.`,
                });
                // Reset states on error to prevent displaying partial/incorrect data
                form.resetFields();
                setSliderCount(0);
                setHours({});
                setStartDate(null);
                setEndDate(null);
                setDeliverySlot(null);
                setPersonResponsible('');
                setNumberOfDays(0);
                setExistingSchedules({});
            }
        };

        fetchTaskAndScheduleData();
    }, [task, form]); // Dependencies: run effect when 'task' prop or 'form' instance changes


    // --- EFFECT HOOK 2: SET INITIAL PERSON RESPONSIBLE AND CONTROL EDITABILITY ---
    useEffect(() => {
        const initialResponsibilityFromTask = task?.Responsibility || '';
        const userPersonName = getPersonNameFromEmail(currentUserEmail);

        if (isAdmin) {
            // Admin user: Can see full list, try to pre-fill from task.
            if (initialResponsibilityFromTask) {
                setPersonResponsible(initialResponsibilityFromTask);
                form.setFieldsValue({ personResponsible: initialResponsibilityFromTask });
            } else {
                setPersonResponsible('');
                form.setFieldsValue({ personResponsible: undefined });
            }
        } else {
            // Non-admin user: Only allowed to see their mapped name.
            if (userPersonName) {
                setPersonResponsible(userPersonName);
                form.setFieldsValue({ personResponsible: userPersonName });
            } else {
                // If current user's email doesn't map to a known person,
                // set to empty/undefined and disable.
                setPersonResponsible('');
                form.setFieldsValue({ personResponsible: undefined });
                notification.warning({
                    message: 'Access Restricted',
                    description: 'Your email is not mapped to a person. Please contact an admin.',
                });
            }
        }
    }, [task, currentUserEmail, form, getPersonNameFromEmail, isAdmin]);


    const handleStartDateChange = (date) => {
        setStartDate(date);
        if (numberOfDays && date) {
            calculateEndDate(date, numberOfDays);
        } else {
            setEndDate(null);
            setSliderCount(0);
            setHours({}); // Clear hours if start date is null or invalid
        }
    };


    const handleNumberOfDaysChange = (e) => {
        const days = e.target.value;
        const numericDays = parseInt(days, 10);
        if (isNaN(numericDays) || numericDays < 0) {
            setNumberOfDays(0);
            setSliderCount(0);
            setEndDate(null);
            setHours({}); // Clear hours if days become invalid/zero
            return;
        }

        setNumberOfDays(numericDays);
        setSliderCount(numericDays); // Update slider count immediately
        if (startDate && numericDays > 0) {
            calculateEndDate(startDate, numericDays);
        } else {
            setEndDate(null);
            setHours({}); // Clear hours if start date is not set or days are zero
        }
    };

    const calculateEndDate = (start, days) => {
        if (start && days > 0) {
            const calculatedEndDate = moment(start).add(days - 1, 'days');
            setEndDate(calculatedEndDate);
        } else {
            setEndDate(null);
        }
    };

    const calculateTotalTime = () => {
        return Object.values(hours).reduce((acc, curr) => {
            return acc + (typeof curr === 'number' ? curr : 0);
        }, 0);
    };


    const handleSubmit = () => {
        form
            .validateFields() // Trigger Ant Design form validation
            .then((values) => {
                const slotTimes = {
                    "1pm": { hour: 13, minute: 0 },
                    "4pm": { hour: 16, minute: 0 },
                    "7pm": { hour: 19, minute: 0 },
                };

                const selectedSlot = values.deliverySlot ? slotTimes[values.deliverySlot] : null;

                // Format timestamps for BigQuery
                const plannedStartTimestamp = startDate && selectedSlot
                    ? moment(startDate)
                          .hour(selectedSlot.hour)
                          .minute(selectedSlot.minute)
                          .utc() // Ensure UTC timezone
                          .format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                const plannedDeliveryTimestamp = endDate && selectedSlot
                    ? moment(endDate)
                          .hour(selectedSlot.hour)
                          .minute(selectedSlot.minute)
                          .utc() // Ensure UTC timezone
                          .format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                // Calculate total actual hours from all sliders for the main task record
                const actualHours = calculateTotalTime();

                // Prepare newSchedules array for Per_Key_Per_Day and Per_Person_Per_Day updates
                const newSchedules = Array.from({ length: numberOfDays }).map((_, index) => {
                    const calculatedDay = moment(startDate).add(index, 'days');
                    const formattedDay = calculatedDay.isValid() ? calculatedDay.format('YYYY-MM-DD') : null;
                    return {
                        date: formattedDay,
                        duration: hours[index] || 0, // Get the value for this specific day
                    };
                }).filter(s => s.date !== null); // Filter out any entries without valid dates

                const selectedPersonEmailData = getPersonEmailData(values.personResponsible);
                const primaryEmail = selectedPersonEmailData ? selectedPersonEmailData.primaryEmail : null;
                const allEmails = selectedPersonEmailData ? selectedPersonEmailData.allEmails : null;

                // Payload matches backend's /api/update-task-status expected body
                const payload = {
                    key: task.Key,
                    taskName: values.name,
                    startDate: plannedStartTimestamp,
                    endDate: plannedDeliveryTimestamp,
                    assignTo: values.personResponsible, // Send the person's NAME
                    status: values.status,
                    actualHours: actualHours, // Total minutes for the main task record
                    newSchedules: newSchedules, // Array of { date, duration } for BigQuery upserts
                    // These are not directly used by the backend's update-task-status Joi schema,
                    // but might be useful for other backend logic or future extensions.
                    // If your backend actually updates 'Email' and 'Emails' columns in the main table
                    // via this endpoint, you'd need to add them to the Joi schema and SQL query.
                    // For now, they are part of the payload but might be ignored by current backend.
                    primaryEmail: primaryEmail,
                    allEmails: allEmails
                };

                console.log('Update Payload:', payload);

                fetch(`${BACKEND_API_BASE_URL}/api/update-task-status`, { // Corrected endpoint
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                })
                    .then((response) => {
                        if (!response.ok) {
                            // Attempt to read error message from response body
                            return response.json().then(err => {
                                throw new Error(err.error || `Server responded with status ${response.status}`);
                            });
                        }
                        return response.json();
                    })
                    .then(() => {
                        notification.success({
                            message: 'Task Updated',
                            description: 'Your task has been successfully updated!',
                        });
                        // Call onSubmit prop to update parent component/list
                        onSubmit({
                            personResponsible: values.personResponsible, // Pass back the NAME
                            totalTime: actualHours,
                            Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
                            status: values.status,
                            Email: primaryEmail, // Pass back primary email
                            Emails: allEmails // Pass back all emails string
                        });
                    })
                    .catch((error) => {
                        notification.error({
                            message: 'Error',
                            description: error.message || 'An error occurred while updating the task.',
                        });
                    });
            })
            .catch((info) => {
                // Validation failed on the frontend
                console.error('Validate Failed:', info);
                notification.error({
                    message: 'Validation Error',
                    description: 'Please fill in all required fields and check for validation errors.',
                });
            });
    };

    // Handles changes to the slider. Capping value between 0 and 480 minutes (8 hours)
    const handleSliderChange = (index, value) => {
        let numericValue = value;
        if (isNaN(numericValue) || numericValue < 0) { // Allow 0 minutes
            numericValue = 0;
        }
        if (numericValue > 480) {
            numericValue = 480;
        }

        const currentDay = startDate ? moment(startDate).add(index, 'days').format('YYYY-MM-DD') : null;
        let effectiveValue = numericValue;

        // Apply max allowed minutes based on existing schedules for the selected person
        if (currentDay && personResponsible && existingSchedules[personResponsible]?.[currentDay] !== undefined) {
            const alreadyScheduledMinutes = existingSchedules[personResponsible][currentDay];
            // The value from the slider is the *new* value for this task.
            // We need to calculate how much *this task* is contributing to the total for the day.
            // This logic is tricky if you're editing an existing task's duration.
            // For simplicity here, we'll cap the *current task's* input to ensure it doesn't exceed 8 hours
            // *if combined with the existing total for that person/day*.
            // A more robust solution might involve:
            // 1. Fetching the *current task's* existing duration for that day.
            // 2. Subtracting that from the 'alreadyScheduledMinutes' to get other tasks' contributions.
            // 3. Then calculating remaining capacity.
            // For now, this simply caps the *new total* for this task on that day.
            // If the backend handles total aggregation, this frontend check is a UX helper.
            const totalForDayIfThisTaskIsValue = alreadyScheduledMinutes - (hours[index] || 0) + numericValue; // Calculate potential new total
            if (totalForDayIfThisTaskIsValue > 480) {
                effectiveValue = numericValue - (totalForDayIfThisTaskIsValue - 480); // Adjust down to fit
                notification.warning({
                    message: 'Time Limit Reached',
                    description: `Scheduling ${numericValue} minutes would exceed the 8-hour limit for ${personResponsible} on ${currentDay}. Adjusted to ${effectiveValue} minutes.`,
                });
            }
        }
        setHours((prev) => ({ ...prev, [index]: effectiveValue }));
    };

    // Handles changes to the input field next to the slider. Capping value between 0 and 480 minutes.
    const handleInputChange = (index, value) => {
        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue) || numericValue < 0) {
            numericValue = 0;
        }
        if (numericValue > 480) {
            numericValue = 480;
        }

        const currentDay = startDate ? moment(startDate).add(index, 'days').format('YYYY-MM-DD') : null;
        let effectiveValue = numericValue;

        if (currentDay && personResponsible && existingSchedules[personResponsible]?.[currentDay] !== undefined) {
            const alreadyScheduledMinutes = existingSchedules[personResponsible][currentDay];
            const totalForDayIfThisTaskIsValue = alreadyScheduledMinutes - (hours[index] || 0) + numericValue;
            if (totalForDayIfThisTaskIsValue > 480) {
                effectiveValue = numericValue - (totalForDayIfThisTaskIsValue - 480);
                notification.warning({
                    message: 'Time Limit Reached',
                    description: `Scheduling ${numericValue} minutes would exceed the 8-hour limit for ${personResponsible} on ${currentDay}. Adjusted to ${effectiveValue} minutes.`,
                });
            }
        }

        setHours((prev) => ({
            ...prev,
            [index]: effectiveValue,
        }));
    };

    // Custom marks for the slider for better visual representation
    const customMarks = {
        0: '0 m',
        60: '1 h',
        120: '2 h',
        180: '3 h',
        240: '4 h',
        300: '5 h',
        360: '6 h',
        420: '7 h',
        480: '8 h',
    };

    // Filter persons to display in the dropdown based on admin status
    const personsToDisplay = isAdmin
        ? peopleMapping.map(p => p.Name) // Admins see all names
        : (getPersonNameFromEmail(currentUserEmail) ? [getPersonNameFromEmail(currentUserEmail)] : []); // Non-admins see only their name


    return (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
                name="name"
                label="Task Name"
                rules={[{ required: true, message: 'Please input the task name!' }]}
            >
                <Input readOnly={true} />
            </Form.Item>

            <Row gutter={[8, 16]}>
                <Col xs={24} sm={8}>
                    <Form.Item label="Start Date" name="startDate">
                        <DatePicker
                            format="YYYY-MM-DD"
                            onChange={handleStartDateChange}
                            value={startDate}
                            placeholder="Select start date"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item label="Number of Days" name="numberOfDays">
                        <Input
                            type="number"
                            value={numberOfDays}
                            onChange={handleNumberOfDaysChange}
                            min={0}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item label="End Date" name="endDate">
                        <DatePicker
                            format="YYYY-MM-DD"
                            value={endDate}
                            disabled // End date is calculated and disabled
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            {/* Render sliders for each day if numberOfDays > 0 */}
            {numberOfDays > 0 && Array.from({ length: numberOfDays }).map((_, index) => (
                <Form.Item
                    key={index}
                    label={`Hours for Day ${index + 1} (${startDate ? moment(startDate).add(index, 'days').format('YYYY-MM-DD') : 'N/A'})`}
                >
                    <Row gutter={20}>
                        <Col xs={20}>
                            <Slider
                                marks={customMarks}
                                min={0}
                                max={480}
                                step={1}
                                onChange={(value) => handleSliderChange(index, value)}
                                value={hours[index] || 0}
                                tooltip={{ formatter: (value) => `${value} minutes` }}
                            />
                        </Col>
                        <Col xs={4}>
                            <Input
                                type="number"
                                min={0}
                                max={480}
                                value={hours[index] || 0}
                                onChange={(e) => handleInputChange(index, e.target.value)}
                                addonAfter="min"
                            />
                        </Col>
                    </Row>
                </Form.Item>
            ))}

            <Form.Item
                name="deliverySlot"
                label="Delivery Slot"
                rules={[{ required: true, message: 'Please select a delivery slot!' }]}
            >
                <Select
                    placeholder="Select a delivery slot"
                    onChange={setDeliverySlot}
                    value={deliverySlot}
                >
                    <Option value="1pm">1pm</Option>
                    <Option value="4pm">4pm</Option>
                    <Option value="7pm">7pm</Option>
                </Select>
            </Form.Item>

            <Form.Item
                label="Person Responsible"
                name="personResponsible"
                rules={[{ required: true, message: 'Please select the person responsible!' }]}
            >
                <Select
                    placeholder="Select a person"
                    onChange={setPersonResponsible}
                    value={personResponsible || undefined} // Use undefined for Ant Design placeholder behavior
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={!isAdmin && personsToDisplay.length === 1} // Disable if not admin and only one option
                >
                    {personsToDisplay.map((personName) => (
                        <Option key={personName} value={personName}>
                            {personName}
                        </Option>
                    ))}
                </Select>
            </Form.Item>

            <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select a status!' }]}
            >
                <Select placeholder="Select status">
                    <Option value="Scheduled">Scheduled</Option>
                    <Option value="In Progress">In Progress</Option>
                    <Option value="Paused">Paused</Option>
                    <Option value="Completed">Completed</Option>
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
