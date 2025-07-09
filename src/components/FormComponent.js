import React, { useState, useEffect, memo } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

// FormComponent now expects 'peopleMapping' as a prop
const FormComponent = ({ onSubmit, task, peopleMapping }) => {
    const [form] = Form.useForm();
    const [sliderCount, setSliderCount] = useState(0);
    const [hours, setHours] = useState({}); // Stores hours per day for the current task's schedule
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    const [deliverySlot, setDeliverySlot] = useState(null);
    const [personResponsible, setPersonResponsible] = useState('');
    const [numberOfDays, setNumberOfDays] = useState(0);
    // existingSchedules will store aggregated per-person-per-day data (Responsibility -> Day -> TotalMinutes)
    const [existingSchedules, setExistingSchedules] = useState({});


    useEffect(() => {
        const fetchTaskData = async () => {
            try {
                if (task && task.Key) {
                    // Set initial form values from the task prop
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                        deliverySlot: task.Delivery_Slot || null, // Assuming Delivery_Slot exists in task
                        status: task.Status || 'Scheduled', // Assuming Status exists in task
                    });
                    setPersonResponsible(task.Responsibility || '');
                    setDeliverySlot(task.Delivery_Slot || null);

                    // 1. Fetch data per key per day for this specific task
                    const perKeyResponse = await fetch(`https://server-ui-2.onrender.com/api/per-key-per-day?key=${task.Key}`);
                    if (!perKeyResponse.ok) {
                        throw new Error(`HTTP error! status: ${perKeyResponse.status}`);
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
                    const perPersonResponse = await fetch(`https://server-ui-2.onrender.com/api/per-person-per-day`);
                    if (!perPersonResponse.ok) {
                        throw new Error(`HTTP error! status: ${perPersonResponse.status}`);
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
                console.error("Error fetching task data:", error);
                notification.error({
                    message: 'Error',
                    description: 'Failed to load task details and schedules. ' + error.message,
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

        fetchTaskData();
    }, [task, form]); // Dependencies: run effect when 'task' prop or 'form' instance changes


    // Handles changes to the Start Date input field
    const handleStartDateChange = (e) => {
        const inputDate = e.target.value;
        const parsedDate = moment(inputDate, 'YYYY-MM-DD', true); // `true` for strict parsing

        if (parsedDate.isValid()) {
            setStartDate(parsedDate);
            if (numberOfDays) {
                calculateEndDate(parsedDate, numberOfDays);
            }
        } else {
            console.error("Invalid start date format. Please use 'YYYY-MM-DD'");
            setStartDate(null); // Clear start date if invalid
            setEndDate(null);
            setNumberOfDays(0);
            setSliderCount(0);
        }
    };

    // Handles changes to the Number of Days input field
    const handleNumberOfDaysChange = (days) => {
        const numericDays = parseInt(days, 10);
        if (isNaN(numericDays) || numericDays < 0) { // Ensure non-negative days
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
            setEndDate(null); // Clear end date if start date is not set or days are zero
        }
    };

    // Calculates and sets the End Date based on Start Date and Number of Days
    const calculateEndDate = (start, days) => {
        if (start && days > 0) {
            const calculatedEndDate = moment(start).add(days - 1, 'days');
            setEndDate(calculatedEndDate);
        } else {
            setEndDate(null);
        }
    };

    // Calculates the total scheduled time across all days (sum of slider values)
    const calculateTotalTime = () => {
        return Object.values(hours).reduce((acc, curr) => acc + curr, 0);
    };


    // Handles form submission
    const handleSubmit = () => {
        form
            .validateFields() // Trigger Ant Design form validation
            .then((values) => {
                const slotTimes = {
                    "1pm": { hour: 13, minute: 0 },
                    "4pm": { hour: 16, minute: 0 },
                    "7pm": { hour: 19, minute: 0 },
                };

                const selectedSlot = deliverySlot ? slotTimes[deliverySlot] : null;

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

                // Payload matches backend's /api/update-task-status expected body
                const payload = {
                    key: task.Key,
                    taskName: values.name,
                    startDate: plannedStartTimestamp,
                    endDate: plannedDeliveryTimestamp,
                    assignTo: personResponsible,
                    status: values.status, // Get status from Ant Design form values
                    actualHours: actualHours, // Total minutes for the main task record
                    newSchedules: newSchedules, // Array of { date, duration } for BigQuery upserts
                };

                console.log('Update Payload:', payload);

                fetch('https://server-ui-2.onrender.com/api/update-task-status', {
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
                            personResponsible,
                            totalTime: actualHours,
                            Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
                            status: values.status,
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
                console.log('Validate Failed:', info);
                notification.error({
                    message: 'Validation Error',
                    description: 'Please fill in all required fields and check for validation errors.',
                });
            });
    };

    // Handles changes to the slider. Capping value between 1 and 480 minutes (8 hours)
    const handleSliderChange = (index, value) => {
        let numericValue = value;
        if (isNaN(numericValue) || numericValue < 1) {
            numericValue = 1;
        }
        if (numericValue > 480) {
            numericValue = 480;
        }
        setHours((prev) => ({ ...prev, [index]: numericValue }));
    };

    // Handles changes to the input field next to the slider. Capping value between 1 and 480 minutes.
    const handleInputChange = (index, value) => {
        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue) || numericValue < 1) { // Ensure minimum 1 minute
            numericValue = 1;
        }
        if (numericValue > 480) { // Max 8 hours (480 minutes)
            numericValue = 480;
        }
        setHours((prev) => ({
            ...prev,
            [index]: numericValue,
        }));
    };

    // Custom marks for the slider for better visual representation
    const customMarks = {
        1: '1 m',
        60: '1 h',
        120: '2 h',
        180: '3 h',
        240: '4 h',
        300: '5 h',
        360: '6 h',
        420: '7 h',
        480: '8 h',
    };

    // Function to disable dates in the DatePicker (e.g., end date cannot be before start date)
    const disabledEndDate = (current) => {
        return startDate ? current && current < startDate.startOf('day') : false;
    };

    return (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
                name="name"
                label="Task Name"
                rules={[{ required: true, message: 'Please input the task name!' }]}
            >
                <Input />
            </Form.Item>

            <Row gutter={[8, 16]}>
                <Col xs={24} sm={8}>
                    <Form.Item label="Start Date">
                        <Input
                            type="date"
                            onChange={handleStartDateChange}
                            value={startDate ? startDate.format('YYYY-MM-DD') : ''}
                            placeholder="Enter start date (YYYY-MM-DD)"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item label="Number of Days">
                        <Input
                            type="number"
                            value={numberOfDays}
                            onChange={(e) => handleNumberOfDaysChange(e.target.value)}
                            min={0} // Allow 0 days if no schedule is intended
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item label="End Date">
                        <DatePicker
                            value={endDate} // Use moment object directly
                            format="YYYY-MM-DD"
                            disabledDate={disabledEndDate} // Apply disabled date logic
                            disabled // Keep disabled as it's calculated
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
                                min={1}
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
                                min={1}
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
                    value={deliverySlot} // Control value with state
                >
                    <Option value="1pm">1pm</Option>
                    <Option value="4pm">4pm</Option>
                    <Option value="7pm">7pm</Option>
                </Select>
            </Form.Item>

            <Form.Item
                name="personResponsible" // Ant Design will manage this field value
                label="Person Responsible"
                rules={[{ required: true, message: 'Please select the person responsible!' }]}
            >
                <Select
                    placeholder="Select a person"
                    onChange={setPersonResponsible}
                    value={personResponsible} // Control value with state
                    showSearch // Enable search for long lists
                    filterOption={(input, option) =>
                        option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }
                >
                    {/* Render options from peopleMapping prop */}
                    {peopleMapping && peopleMapping.map((person) => (
                        <Option key={person.Email_ID} value={person.Email_ID}>
                            {person.Name} ({person.Email_ID})
                        </Option>
                    ))}
                </Select>
            </Form.Item>

            {/* Add Status field as per backend update-task-status endpoint */}
            <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select a status!' }]}
                // Set initial value from task prop or default to 'Scheduled' for new tasks
                initialValue={task?.Status || 'Scheduled'}
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
