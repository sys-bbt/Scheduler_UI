import React, { useState, useEffect, memo, useCallback } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

// Define the emails of users who can see and edit the full list
const ADMIN_EMAILS = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

// NEW: Comprehensive map for person name to their primary email and full emails string (for BigQuery's 'Emails' column)
// You MUST populate this map with ALL expected "Person Responsible" names and their corresponding email data
// based on your BigQuery data and requirements.
const PERSON_EMAIL_DATA_MAP = {
    "Neelam Purohit": { primaryEmail: "neelam.p@brightbraintech.com", allEmails: "neelam.p@brightbraintech.com" },
    "Meghna Jalali": { primaryEmail: "meghna.j@brightbraintech.com", allEmails: "meghna.j@brightbraintech.com" },
    "Zoya Ansari": { primaryEmail: "zoya.a@brightbraintech.com", allEmails: "zoya.a@brightbraintech.com" },
    "Shweta Gaikwad": { primaryEmail: "shweta.g@brightbraintech.com", allEmails: "shweta.g@brightbraintech.com" },
    "Hitesh Rattesar": { primaryEmail: "hitesh.r@brightbraintech.com", allEmails: "hitesh.r@brightbraintech.com" },
    "System": { primaryEmail: "systems@brightbraintech.com", allEmails: "systems@brightbraintech.com" },
    // Example for a person/role associated with multiple emails (access emails)
    // "Team Lead": { primaryEmail: "team.lead@brightbraintech.com", allEmails: "team.lead@brightbraintech.com,member1@brightbraintech.com,member2@brightbraintech.com" },
    // Add any other specific "Access Emails" or multi-email mappings you need here.
};

// HARDCODED LIST OF PERSONS - THIS REPLACES THE API CALL
const ALL_AVAILABLE_PERSONS_HARDCODED = [
    "Neelam Purohit",
    "Meghna Jalali",
    "Zoya Ansari",
    "Shweta Gaikwad",
    "Hitesh Rattesar",
    "System",
    // Ensure this list is comprehensive and matches the keys in PERSON_EMAIL_DATA_MAP
];


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

    console.log('FormComponent: currentUserEmail received:', currentUserEmail);
    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);
    console.log('FormComponent: isAdmin calculated as:', isAdmin);


    // Memoize the mapping logic to prevent unnecessary re-renders
    const getPersonNameFromEmail = useCallback((email) => {
        // Find the person name by iterating through PERSON_EMAIL_DATA_MAP
        const entry = Object.entries(PERSON_EMAIL_DATA_MAP).find(([, value]) => value.primaryEmail === email || value.allEmails.includes(email));
        return entry ? entry[0] : null;
    }, []);

    // --- EFFECT HOOK 1: FETCH TASK DATA AND EXISTING SCHEDULES ---
    useEffect(() => {
        const fetchTaskAndScheduleData = async () => {
            try {
                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                    });

                    const response = await fetch(`/api/per-key-per-day`);
                    const data = await response.json();

                    const taskData = data[task.Key];
                    if (taskData) {
                        const taskEntries = taskData.entries;

                        const totalMinutes = taskData.totalDuration || 0;
                        const initialHours = {};
                        if (taskEntries && taskEntries.length > 0) {
                            taskEntries.forEach((entry) => {
                                if (entry.Duration !== undefined && entry.Day !== undefined) {
                                    const dayMoment = moment(entry.Day.value);
                                    if (dayMoment.isValid() && startDate && dayMoment.isSameOrAfter(startDate, 'day')) {
                                        const dayIndex = dayMoment.diff(startDate, 'days');
                                        initialHours[dayIndex] = entry.Duration;
                                    }
                                }
                            });
                        }
                        if (Object.keys(initialHours).length === 0 && totalMinutes > 0 && startDate) {
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
                        } else if (task?.Planned_Start_Timestamp && task?.Planned_Delivery_Timestamp) {
                            const start = moment(task.Planned_Start_Timestamp);
                            const end = moment(task.Planned_Delivery_Timestamp);
                            const daysDiff = end.diff(start, 'days') + 1;
                            setStartDate(start);
                            setEndDate(end);
                            setNumberOfDays(daysDiff);
                            setSliderCount(daysDiff);
                        }
                    } else if (task?.Planned_Start_Timestamp && task?.Planned_Delivery_Timestamp) {
                        const start = moment(task.Planned_Start_Timestamp);
                        const end = moment(task.Planned_Delivery_Timestamp);
                        const daysDiff = end.diff(start, 'days') + 1;
                        setStartDate(start);
                        setEndDate(end);
                        setNumberOfDays(daysDiff);
                        setSliderCount(daysDiff);
                    }


                    const perPersonResponse = await fetch(`/api/per-person-per-day`);
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
                    description: 'Failed to load task data or existing schedules. Please check network and server logs.',
                });
            }
        };

        fetchTaskAndScheduleData();
    }, [task, form, startDate]);

    // --- EFFECT HOOK 2: SET INITIAL PERSON RESPONSIBLE AND CONTROL EDITABILITY ---
    useEffect(() => {
        const initialResponsibilityFromTask = task?.Responsibility || '';
        const userPersonName = getPersonNameFromEmail(currentUserEmail);

        // Determine initial personResponsible for form dropdown
        if (initialResponsibilityFromTask && ALL_AVAILABLE_PERSONS_HARDCODED.includes(initialResponsibilityFromTask)) {
            setPersonResponsible(initialResponsibilityFromTask);
            form.setFieldsValue({ personResponsible: initialResponsibilityFromTask });
        } else if (userPersonName && ALL_AVAILABLE_PERSONS_HARDCODED.includes(userPersonName)) {
            // If task is unassigned, but current user can be mapped, use current user's name
            setPersonResponsible(userPersonName);
            form.setFieldsValue({ personResponsible: userPersonName });
        } else {
            setPersonResponsible('');
            form.setFieldsValue({ personResponsible: undefined });
        }
    }, [task, currentUserEmail, form, getPersonNameFromEmail]);


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

                // --- NEW: Determine Email and Emails based on selected personResponsible ---
                const selectedPersonEmailData = PERSON_EMAIL_DATA_MAP[personResponsible];
                const newEmail = selectedPersonEmailData ? selectedPersonEmailData.primaryEmail : null;
                const newEmails = selectedPersonEmailData ? selectedPersonEmailData.allEmails : null;
                // --- END NEW ---

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
                    Responsibility: personResponsible, // This comes from the dropdown
                    Current_Status: task.Current_Status || 'Scheduled', // Default to 'Scheduled' if unassigned
                    Email: newEmail, // Use the dynamically determined email
                    Emails: newEmails, // Use the dynamically determined emails string
                    Total_Tasks: task.Total_Tasks,
                    Completed_Tasks: task.Completed_Tasks,
                    Planned_Tasks: task.Planned_Tasks,
                    Percent_Tasks_Completed: task.Percent_Tasks_Completed,
                    Created_at: task.Created_at || moment().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC", // Preserve original or set new
                    Updated_at: moment().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC",
                    Time_Left_For_Next_Task_dd_hh_mm_ss: task.Time_Left_For_Next_Task_dd_hh_mm_ss,
                    Card_Corner_Status: task.Card_Corner_Status,
                    sliders: slidersData,
                };

                console.log('Scheduled Data for submission:', scheduledData);

                fetch('/api/post', {
                    method: 'POST', // This endpoint handles both insert and update based on Key existence
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
                        // Pass updated scheduling data back to parent (DeliveryDetail)
                        onSubmit({
                            personResponsible: scheduledData.Responsibility,
                            totalTime: totalTime,
                            Planned_Delivery_Timestamp: scheduledData.Planned_Delivery_Timestamp,
                            Current_Status: scheduledData.Current_Status,
                            Email: scheduledData.Email,
                            Emails: scheduledData.Emails // Pass back new Emails as well
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

    // Define personsToDisplay based on user role
    const personsToDisplay = isAdmin
        ? ALL_AVAILABLE_PERSONS_HARDCODED
        : (getPersonNameFromEmail(currentUserEmail) && ALL_AVAILABLE_PERSONS_HARDCODED.includes(getPersonNameFromEmail(currentUserEmail)))
            ? [getPersonNameFromEmail(currentUserEmail)]
            : [];

    return (
        <Form form={form} layout="vertical">
            <Form.Item
                name="name"
                label="Task Name"
                rules={[{ required: true, message: 'Please input the task name!' }]}
            >
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
                    value={personResponsible || undefined}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={!isAdmin && !!getPersonNameFromEmail(currentUserEmail)} // Disable if not admin AND user has a mapped name
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
