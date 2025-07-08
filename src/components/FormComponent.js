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

// Define the base URL for your backend API
const BACKEND_API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
console.log('Using Backend API URL:', BACKEND_API_BASE_URL);


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

    // NEW STATE for dynamic person data
    const [emailToPersonMap, setEmailToPersonMap] = useState({});
    const [allAvailablePersons, setAllAvailablePersons] = useState([]);

    console.log('FormComponent: currentUserEmail received:', currentUserEmail);
    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);
    console.log('FormComponent: isAdmin calculated as:', isAdmin);


    // Memoize the mapping logic to prevent unnecessary re-renders
    const getPersonNameFromEmail = useCallback((email) => {
        // Now directly use the fetched emailToPersonMap
        return emailToPersonMap[email.toLowerCase()] || null;
    }, [emailToPersonMap]);

    // --- EFFECT HOOK 1: FETCH PERSON MAPPINGS, TASK DATA AND EXISTING SCHEDULES ---
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // 1. Fetch person mappings first
                const personMappingsResponse = await fetch(`${BACKEND_API_BASE_URL}/api/person-mappings`);
                if (!personMappingsResponse.ok) {
                    const errorText = await personMappingsResponse.text();
                    throw new Error(`HTTP error! status: ${personMappingsResponse.status}, message: ${errorText}`);
                }
                const personMappingsData = await personMappingsResponse.json();
                setEmailToPersonMap(personMappingsData.emailToPersonMap || {});
                setAllAvailablePersons(personMappingsData.allAvailablePersons || []);

                // 2. Proceed with task-specific data fetching if a task is provided
                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                    });

                    // Fetch per-key-per-day data
                    const response = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    }
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
                                    // Ensure dayMoment is valid and within the task's planned range if startDate exists
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

                            // ONLY SET START/END DATE HERE IF THEY ARE NOT ALREADY SET BY USER INTERACTION
                            // OR IF THE TASK DATA OVERRIDES THE INITIAL STATE.
                            // Given the previous problem, the user's interaction should take precedence.
                            // However, for initial load, if a task is present, these should be set.
                            // The dependency array change below is the primary fix.
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

                    // Fetch per-person-per-day data
                    const perPersonResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-person-per-day`);
                    if (!perPersonResponse.ok) {
                        const errorText = await perPersonResponse.text();
                        throw new Error(`HTTP error! status: ${perPersonResponse.status}, message: ${errorText}`);
                    }
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
                console.error("Error fetching data:", error);
                notification.error({
                    message: 'Error',
                    description: `Failed to load data: ${error.message}. Please check network and server logs.`,
                });
            }
        };

        fetchAllData();
    }, [task, form]); // Removed startDate from dependencies

    // --- EFFECT HOOK 2: SET INITIAL PERSON RESPONSIBLE AND CONTROL EDITABILITY ---
    useEffect(() => {
        // Ensure allAvailablePersons and emailToPersonMap are loaded before setting person responsible
        if (allAvailablePersons.length === 0 || Object.keys(emailToPersonMap).length === 0) {
            return; // Wait for data to be fetched
        }

        const initialResponsibilityFromTask = task?.Responsibility || '';
        const userPersonName = getPersonNameFromEmail(currentUserEmail);

        if (isAdmin) {
            // Admin user: Can see full list, try to pre-fill from task.
            if (initialResponsibilityFromTask && allAvailablePersons.includes(initialResponsibilityFromTask)) {
                setPersonResponsible(initialResponsibilityFromTask);
                form.setFieldsValue({ personResponsible: initialResponsibilityFromTask });
            } else {
                setPersonResponsible('');
                form.setFieldsValue({ personResponsible: undefined });
            }
        } else {
            // Non-admin user: Only allowed to see their mapped name.
            if (userPersonName && allAvailablePersons.includes(userPersonName)) {
                setPersonResponsible(userPersonName);
                form.setFieldsValue({ personResponsible: userPersonName });
            } else {
                // If current user's email doesn't map to a known person, or that person
                // isn't in the fetched list, set to empty/undefined and disable.
                setPersonResponsible('');
                form.setFieldsValue({ personResponsible: undefined });
            }
        }
    }, [task, currentUserEmail, form, getPersonNameFromEmail, isAdmin, allAvailablePersons, emailToPersonMap]);


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

                // Get the email(s) associated with the selected personResponsible
                // This logic needs to correctly map the selected personResponsible name back to their email(s)
                // using the fetched emailToPersonMap.
                let emailForSubmission = '';
                let emailsForSubmission = ''; // This will be the string for the 'Emails' BigQuery column

                // Find the email(s) associated with the selected personResponsible
                // Iterate through the emailToPersonMap to find the entry where the value (person name) matches
                const foundEntry = Object.entries(emailToPersonMap).find(
                    ([email, personName]) => personName === personResponsible
                );

                if (foundEntry) {
                    emailForSubmission = foundEntry[0]; // The email (key) from the map
                    emailsForSubmission = foundEntry[0]; // Assuming 'Emails' column stores primary email for now
                    // If you need 'Emails' to be a comma-separated list of multiple access emails,
                    // you'd need to extend your Person_Email_Mappings table to include a column for that,
                    // and then fetch that column here. For now, it's just the primary email.
                } else {
                    // Fallback: If for some reason the selected person isn't in the map,
                    // use the current user's email. This should ideally not happen if dropdown is constrained.
                    emailForSubmission = currentUserEmail;
                    emailsForSubmission = currentUserEmail;
                }


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
                    Current_Status: task.Current_Status,
                    Email: emailForSubmission, // Use the primary email for 'Email' field
                    Emails: emailsForSubmission, // Use the primary email for 'Emails' field
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

                fetch(`${BACKEND_API_BASE_URL}/api/post`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(scheduledData),
                })
                    .then((response) => {
                        if (!response.ok) {
                            return response.text().then(text => { throw new Error(text); });
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

    // Define personsToDisplay based on user role and fetched data
    const personsToDisplay = isAdmin
        ? allAvailablePersons // Admins see all fetched persons
        : (getPersonNameFromEmail(currentUserEmail) && allAvailablePersons.includes(getPersonNameFromEmail(currentUserEmail)))
            ? [getPersonNameFromEmail(currentUserEmail)] // Non-admins see only their mapped name if available
            : []; // Otherwise, empty

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
                    // Disable if the user is not an admin, or if there are no persons to display (e.g., non-admin with no mapping)
                    disabled={!isAdmin && personsToDisplay.length === 0}
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
