import React, { useState, useEffect, memo, useCallback } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment'; // Ensure moment is correctly imported
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
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
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
        return emailToPersonMap[email.toLowerCase()] || null;
    }, [emailToPersonMap]);

    // Function to calculate end date and slider count
    const calculateEndDate = useCallback((start, days) => {
        console.log('calculateEndDate called with:', { start: start ? start.format('YYYY-MM-DD') : null, days });
        if (start && days > 0) {
            // End date is (start date) + (days - 1) because the start day is included
            const calculatedEndDate = moment(start).add(days - 1, 'days');
            console.log('Calculated End Date:', calculatedEndDate.format('YYYY-MM-DD'));
            setEndDate(calculatedEndDate);
            setSliderCount(days); // Keep slider count in sync with number of days
        } else {
            console.log('Setting endDate to null and sliderCount to 0 (invalid start/days)');
            setEndDate(null);
            setSliderCount(0);
        }
    }, []); // No dependencies, as it only uses its arguments

    // --- EFFECT HOOK 1: FETCH PERSON MAPPINGS AND INITIAL TASK DATA ---
    // This effect runs once on mount and whenever the 'task' prop changes.
    useEffect(() => {
        const fetchInitialData = async () => {
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

                // 2. Initialize task-specific data if a task is provided
                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                    });

                    let initialStartForState = null; // This will be used to set the startDate state
                    let initialDaysForState = 0;
                    const initialHours = {};

                    // Priority 1: Set initial start date from task's Planned_Start_Timestamp
                    if (task?.Planned_Start_Timestamp) {
                        initialStartForState = moment(task.Planned_Start_Timestamp);
                        console.log('Initial start date from task.Planned_Start_Timestamp:', initialStartForState.format('YYYY-MM-DD'));
                    }

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

                        if (taskEntries && taskEntries.length > 0) {
                            const validDays = taskEntries
                                .map((entry) => entry.Day?.value)
                                .filter((date) => date);

                            if (validDays.length > 0) {
                                // If task entries exist, ensure initialStartForState is set.
                                // If Planned_Start_Timestamp was not there, use the earliest entry date.
                                if (!initialStartForState) {
                                    initialStartForState = moment.min(validDays.map((d) => moment(d)));
                                    console.log('Initial start date from earliest task entry:', initialStartForState.format('YYYY-MM-DD'));
                                }

                                const actualInitialEnd = moment.max(validDays.map((d) => moment(d)));
                                initialDaysForState = actualInitialEnd.diff(initialStartForState, 'days') + 1; // Calculate days based on determined start

                                taskEntries.forEach((entry) => {
                                    if (entry.Duration !== undefined && entry.Day !== undefined) {
                                        const dayMoment = moment(entry.Day.value);
                                        if (dayMoment.isValid() && initialStartForState && dayMoment.isSameOrAfter(initialStartForState, 'day')) {
                                            const dayIndex = dayMoment.diff(initialStartForState, 'days');
                                            initialHours[dayIndex] = entry.Duration;
                                        }
                                    }
                                });
                            }
                        }

                        // Fallback if no specific per-day entries but totalDuration exists AND initialStartForState is set
                        // This case is typically for new tasks or tasks without detailed day-wise breakdowns
                        if (Object.keys(initialHours).length === 0 && taskData.totalDuration > 0 && initialStartForState) {
                            initialHours[0] = taskData.totalDuration;
                            // If only totalDuration and one day, then initialDaysForState should be 1
                            if (initialDaysForState === 0) {
                                initialDaysForState = 1;
                            }
                        }

                    } else if (task?.Planned_Start_Timestamp && task?.Planned_Delivery_Timestamp) {
                        // If no per-key-per-day data (sliders) but planned timestamps exist in the main task object
                        if (!initialStartForState) { // Only set if not already set by Planned_Start_Timestamp
                            initialStartForState = moment(task.Planned_Start_Timestamp);
                        }
                        const initialEndFromTask = moment(task.Planned_Delivery_Timestamp);
                        initialDaysForState = initialEndFromTask.diff(initialStartForState, 'days') + 1;
                        console.log('Initial days calculated from task timestamps:', initialDaysForState);
                    }

                    // Set the states based on fetched task data
                    setStartDate(initialStartForState);
                    setNumberOfDays(initialDaysForState);
                    setHours(initialHours);

                    // Ensure endDate and sliderCount are calculated immediately after states are set
                    if (initialStartForState && initialDaysForState > 0) {
                        calculateEndDate(initialStartForState, initialDaysForState);
                    } else {
                        setEndDate(null);
                        setSliderCount(0);
                    }


                    // Fetch per-person-per-day data (existing schedules)
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

        fetchInitialData();
    }, [task, form, calculateEndDate]); // Dependencies

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
        console.log('handleStartDateChange: DatePicker selected', date ? date.format('YYYY-MM-DD') : null);
        setStartDate(date);
        // Immediately recalculate end date and slider count based on new start date
        if (date && numberOfDays > 0) {
            calculateEndDate(date, numberOfDays);
        } else {
            setEndDate(null);
            setSliderCount(0);
        }
    };


    const handleNumberOfDaysChange = (e) => {
        const days = e.target.value;
        const numericDays = parseInt(days, 10) || 0;
        console.log('handleNumberOfDaysChange: Input days', numericDays);
        setNumberOfDays(numericDays);
        // Immediately recalculate end date and slider count based on new number of days
        if (startDate && numericDays > 0) {
            calculateEndDate(startDate, numericDays);
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
                        slot: "Null",
                        Duration_Uint: "min",
                        Responsibility: personResponsible,
                    };
                });

                let emailForSubmission = '';
                let emailsForSubmission = '';

                const foundEntry = Object.entries(emailToPersonMap).find(
                    ([email, personName]) => personName === personResponsible
                );

                if (foundEntry) {
                    emailForSubmission = foundEntry[0];
                    emailsForSubmission = foundEntry[0];
                } else {
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
                    Email: emailForSubmission,
                    Emails: emailsForSubmission,
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
        // Ensure startDate is valid before proceeding
        if (!startDate) return;

        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480; // 8 hours in minutes
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
        // Ensure startDate is valid before proceeding
        if (!startDate) return;

        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue)) {
            numericValue = 0;
        }

        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480; // 8 hours in minutes
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
            : []; // Otherwise, empty (or you could set a default 'N/A' or similar)

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
                            value={startDate} // This correctly binds to the startDate state
                            placeholder="Select start date"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item label="Number of Days">
                        <Input
                            type="number"
                            value={numberOfDays} // This correctly binds to the numberOfDays state
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
                            value={endDate} // This correctly binds to the endDate state
                            disabled // End date is derived, not directly editable
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            {/* Render sliders only if a start date and number of days are valid */}
            {startDate && numberOfDays > 0 && Array.from({ length: sliderCount }).map((_, index) => (
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
                label="Person Responsible"
                name="personResponsible"
                rules={[{ required: true, message: 'Please select the person responsible!' }]}
            >
                <Select
                    placeholder="Select a person"
                    onChange={setPersonResponsible}
                    value={personResponsible || undefined} // Ensure controlled component behavior
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    // Disable if the user is not an admin, and also if there are no persons to display (e.g., non-admin with no mapping)
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
