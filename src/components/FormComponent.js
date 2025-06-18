import React, { useState, useEffect, memo, useCallback } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col, Spin } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

// Define the emails of users who can see the full list
const ADMIN_EMAILS = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

// Define a mapping from email to person name for non-admin users.
// This is crucial if the email doesn't directly map to the "Responsibility" name
// as fetched from BigQuery. Ensure these mappings align with your data.
const EMAIL_TO_PERSON_MAP = {
    "neelam.p@brightbraintech.com": "Neelam Purohit",
    "meghna.j@brightbraintech.com": "Meghna Jalali",
    "zoya.a@brightbraintech.com": "Zoya Ansari",
    "shweta.g@brightbraintech.com": "Shweta Gaikwad",
    "hitesh.r@brightbraintech.com": "Hitesh Rattesar",
    "systems@brightbraintech.com": "System",
};

const FormComponent = ({ onSubmit, task, currentUserEmail }) => {
    const [form] = Form.useForm();
    const [sliderCount, setSliderCount] = useState(0);
    const [hours, setHours] = useState({});
    const [startDate, setStartDate] = useState(() =>
        task?.Planned_Start_Timestamp
            ? moment(task.Planned_Start_Timestamp)
            : null
    );

    const [endDate, setEndDate] = useState(() =>
        task?.Planned_Delivery_Timestamp
            ? moment(task.Planned_Delivery_Timestamp)
            : null
    );

    const [personResponsible, setPersonResponsible] = useState('');
    const [numberOfDays, setNumberOfDays] = useState(0);
    const [existingSchedules, setExistingSchedules] = useState({});
    const [availablePersons, setAvailablePersons] = useState([]); // State to store fetched persons
    const [loadingPersons, setLoadingPersons] = useState(true); // Loading state for persons data

    // Memoize the mapping logic to prevent unnecessary re-renders
    const getPersonNameFromEmail = useCallback((email) => {
        return EMAIL_TO_PERSON_MAP[email] || null;
    }, []);

    // --- EFFECT HOOK 1: FETCH AVAILABLE PERSONS FROM BIGQUERY API ---
    useEffect(() => {
        const fetchAvailablePersons = async () => {
            setLoadingPersons(true);
            try {
                // Fetch distinct persons from the new backend API endpoint
                const response = await fetch('/api/persons');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setAvailablePersons(data);
            } catch (error) {
                console.error("Error fetching available persons:", error);
                notification.error({
                    message: 'Error',
                    description: 'Failed to load available persons list.',
                });
                setAvailablePersons([]); // Fallback to empty array on error
            } finally {
                setLoadingPersons(false);
            }
        };

        fetchAvailablePersons();
    }, []); // Empty dependency array means this runs once on component mount

    // --- EFFECT HOOK 2: FETCH TASK DATA AND EXISTING SCHEDULES ---
    useEffect(() => {
        const fetchTaskAndScheduleData = async () => {
            try {
                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                    });

                    // Fetch data per key per day
                    const response = await fetch(`https://server-ui-2.onrender.com/api/per-key-per-day`);
                    const data = await response.json();

                    const taskData = data[task.Key];
                    if (taskData) {
                        const taskEntries = taskData.entries;

                        const totalMinutes = taskData.totalDuration || 0;
                        const initialHours = {};
                        if (taskEntries && taskEntries.length > 0) {
                            taskEntries.forEach((entry, index) => {
                                if (index === 0 && entry.Duration_In_Minutes) {
                                    initialHours[0] = entry.Duration_In_Minutes;
                                }
                            });
                        }
                        if (Object.keys(initialHours).length === 0 && totalMinutes > 0) {
                            initialHours[0] = totalMinutes;
                        }
                        setHours(initialHours);

                        const validDays = taskEntries
                            .map((entry) => entry.Day?.value)
                            .filter((date) => date);

                        if (validDays.length > 0) {
                            const start = moment.min(validDays.map((d) => moment(d)));
                            const end = moment.max(validDays.map((d) => moment(d)));

                            setStartDate(start);
                            setEndDate(end);

                            const daysDiff = end.diff(start, 'days') + 1;
                            setNumberOfDays(daysDiff);
                            setSliderCount(daysDiff);
                        }
                    }

                    // Fetch data per person per day (still needed for existingSchedules validation)
                    const perPersonResponse = await fetch(`https://server-ui-2.onrender.com/api/per-person-per-day`);
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
                }
            } catch (error) {
                console.error("Error fetching task data or schedules:", error);
                notification.error({
                    message: 'Error',
                    description: 'Failed to load task data or existing schedules.',
                });
            }
        };

        // Only fetch task data if persons data has loaded/attempted to load
        if (!loadingPersons) {
            fetchTaskAndScheduleData();
        }
    }, [task, form, loadingPersons]); // Depend on loadingPersons

    // --- EFFECT HOOK 3: SET INITIAL PERSON RESPONSIBLE ---
    useEffect(() => {
        if (!loadingPersons) { // Ensure persons data has finished loading (successfully or with error)
            const initialResponsibilityFromTask = task?.Responsibility || '';

            if (ADMIN_EMAILS.includes(currentUserEmail)) {
                // Admin user: Can see full list, try to pre-fill from task.
                if (initialResponsibilityFromTask && (availablePersons.length === 0 || availablePersons.includes(initialResponsibilityFromTask))) {
                    // Pre-fill if task has responsibility AND (no persons loaded OR task responsibility is in loaded persons)
                    setPersonResponsible(initialResponsibilityFromTask);
                    form.setFieldsValue({ personResponsible: initialResponsibilityFromTask });
                } else if (availablePersons.length > 0 && !availablePersons.includes(initialResponsibilityFromTask)) {
                    // Task responsibility exists but is not in the (non-empty) fetched list.
                    // This might mean the person is no longer available or data is stale. Clear selection.
                    setPersonResponsible('');
                    form.setFieldsValue({ personResponsible: undefined });
                } else {
                    // Default for admin if no task responsibility or other edge cases
                    setPersonResponsible(''); // Or set a default admin choice if applicable
                    form.setFieldsValue({ personResponsible: undefined });
                }
            } else {
                // Non-admin user: Only allowed to select/see their mapped name.
                const userPersonName = getPersonNameFromEmail(currentUserEmail);
                if (userPersonName && availablePersons.includes(userPersonName)) {
                    // Pre-fill with user's mapped name if valid and in available persons
                    setPersonResponsible(userPersonName);
                    form.setFieldsValue({ personResponsible: userPersonName });
                } else {
                    // User's name not mapped or not in fetched list, clear it.
                    setPersonResponsible('');
                    form.setFieldsValue({ personResponsible: undefined });
                }
            }
        }
    }, [task, currentUserEmail, form, getPersonNameFromEmail, availablePersons, loadingPersons]);


    const handleStartDateChange = (date) => {
        setStartDate(date);
        if (numberOfDays && date) {
            calculateEndDate(date, numberOfDays);
        } else {
            setEndDate(null);
            setSliderCount(0);
        }
    };


    const handleNumberOfDaysChange = (e) => {
        const days = e.target.value;
        const numericDays = parseInt(days, 10) || 0;
        setNumberOfDays(numericDays);
        if (startDate && numericDays > 0) {
            calculateEndDate(startDate, numericDays);
        } else {
            setEndDate(null);
            setSliderCount(0);
        }
    };

    const calculateEndDate = (start, days) => {
        if (start && days > 0) {
            const calculatedEndDate = moment(start).add(days - 1, 'days');
            setEndDate(calculatedEndDate);
            setSliderCount(days);
        } else {
            setEndDate(null);
            setSliderCount(0);
        }
    };

    const calculateTotalTime = () => {
        return Object.values(hours).reduce((acc, curr) => {
            return acc + (typeof curr === 'number' ? curr : 0);
        }, 0);
    };


    const handleSubmit = () => {
        form
            .validateFields()
            .then((values) => {
                const plannedStartTimestamp = startDate
                    ? moment(startDate).startOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                const plannedDeliveryTimestamp = endDate
                    ? moment(endDate).endOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                const totalTime = calculateTotalTime();
                const slidersData = Array.from({ length: sliderCount }).map((_, index) => {
                    const calculatedDay = moment(startDate).add(index, 'days');
                    const formattedDay = calculatedDay.isValid() ? calculatedDay.format('YYYY-MM-DD') : null;
                    return {
                        day: formattedDay,
                        duration: hours[index] || 0,
                        slot: "Null", // Assuming 'Null' is the default slot
                    };
                });

                const scheduledData = {
                    Key: task.Key,
                    Delivery_code: task.Delivery_code,
                    DelCode_w_o__: task.Delivery_code,
                    Step_ID: task.Step_ID,
                    Task_Details: values.name,
                    Frequency___Timeline: task.Frequency___Timeline,
                    Client: task.Client,
                    Short_Description: task.Short_Description,
                    Planned_Start_Timestamp: plannedStartTimestamp,
                    Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
                    Responsibility: personResponsible,
                    Current_Status: task.Current_Status,
                    Email: task.Email, // Assuming task.Email is the correct email field for the task itself
                    Emails: task.Emails, // Use the existing Emails field from task if available
                    Total_Tasks: task.Total_Tasks,
                    Completed_Tasks: task.Completed_Tasks,
                    Planned_Tasks: task.Planned_Tasks,
                    Percent_Tasks_Completed: task.Percent_Tasks_Completed,
                    Created_at: moment().format("DD/MM/YYYY"),
                    Updated_at: moment().format("DD/MM/YYYY"),
                    Time_Left_For_Next_Task_dd_hh_mm_ss: task.Time_Left_For_Next_Task_dd_hh_mm_ss,
                    Card_Corner_Status: task.Card_Corner_Status,
                    sliders: slidersData,
                };

                console.log('Scheduled Data for submission:', scheduledData);

                fetch('/api/post', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(scheduledData),
                })
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(() => {
                        notification.success({
                            message: 'Task Updated',
                            description: 'Your task has been successfully updated!',
                        });
                        onSubmit({
                            personResponsible,
                            totalTime,
                            Planned_Delivery_Timestamp: scheduledData.Planned_Delivery_Timestamp,
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
                console.error('Validation Failed:', info);
                notification.error({
                    message: 'Error',
                    description: 'Please fill in all required fields correctly.',
                });
            });
    };


    const handleSliderChange = (index, value) => {
        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480;
        let effectiveValue = value;

        if (existingSchedules[personResponsible]?.[currentDay]) {
            const alreadyScheduledMinutes = existingSchedules[personResponsible][currentDay];
            const remainingMinutes = maxAllowedMinutes - (alreadyScheduledMinutes || 0);
            effectiveValue = Math.min(value, remainingMinutes);
            if (value > remainingMinutes) {
                notification.warning({
                    message: 'Time Limit Reached',
                    description: `Cannot schedule more than ${remainingMinutes} minutes for ${personResponsible} on ${currentDay} due to existing tasks.`,
                });
            }
        }

        setHours((prev) => ({ ...prev, [index]: effectiveValue }));
    };

    const handleInputChange = (index, value) => {
        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue)) {
            numericValue = 0;
        }

        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480;
        let effectiveValue = numericValue;

        if (existingSchedules[personResponsible]?.[currentDay]) {
            const alreadyScheduledMinutes = existingSchedules[personResponsible][currentDay];
            const remainingMinutes = maxAllowedMinutes - (alreadyScheduledMinutes || 0);
            effectiveValue = Math.min(numericValue, remainingMinutes);
            if (numericValue > remainingMinutes) {
                notification.warning({
                    message: 'Time Limit Reached',
                    description: `Cannot schedule more than ${remainingMinutes} minutes for ${personResponsible} on ${currentDay} due to existing tasks.`,
                });
            }
        }

        setHours((prev) => ({
            ...prev,
            [index]: effectiveValue < 0 ? 0 : effectiveValue,
        }));
    };

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

    return (
        <Form form={form} layout="vertical">
            <Form.Item
                name="name"
                label="Task Name"
                rules={[{ required: true, message: 'Please input the task name!' }]}
            >
                {/* Made the Task Name input read-only */}
                <Input readOnly={true} />
            </Form.Item>

            <Row gutter={[8, 16]}>
                <Col xs={24} sm={8}>
                    <Form.Item label="Start Date">
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
                    <Form.Item label="Number of Days">
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
                    <Form.Item label="End Date">
                        <DatePicker
                            format="YYYY-MM-DD"
                            value={endDate}
                            disabled
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            {Array.from({ length: sliderCount }).map((_, index) => (
                <Form.Item key={index} label={`Hours for Day ${index + 1} (${startDate ? moment(startDate).add(index, 'days').format('YYYY-MM-DD') : 'N/A'})`}>
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
                label="Person Responsible"
                name="personResponsible"
                rules={[{ required: true, message: 'Please select the person responsible!' }]}
            >
                <Select
                    placeholder="Select a person"
                    onChange={setPersonResponsible}
                    value={personResponsible || undefined} // Use undefined to show placeholder when no value
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    // Disable the select if the user is not an admin or if persons are still loading
                    disabled={!ADMIN_EMAILS.includes(currentUserEmail) || loadingPersons}
                    loading={loadingPersons} // Show loading spinner within the Select
                >
                    {/* Show a loading message or the options */}
                    {loadingPersons ? (
                        <Option disabled value="loading"><Spin size="small" /> Loading persons...</Option>
                    ) : (
                        personsToDisplay.map((person) => (
                            <Option key={person} value={person}>
                                {person}
                            </Option>
                        ))
                    )}
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
