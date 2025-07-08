import React, { useState, useEffect, memo, useCallback } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

const ADMIN_EMAILS = [
    "systems@brightbraintech.com",
    "neelam.p@brightbraintech.com",
    "meghna.j@brightbraintech.com",
    "zoya.a@brightbraintech.com",
    "shweta.g@brightbraintech.com",
    "hitesh.r@brightbraintech.com"
];

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

    const [emailToPersonMap, setEmailToPersonMap] = useState({});
    const [allAvailablePersons, setAllAvailablePersons] = useState([]);

    console.log('FormComponent: currentUserEmail received:', currentUserEmail);
    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);
    console.log('FormComponent: isAdmin calculated as:', isAdmin);

    // Add comprehensive logs for state values on each render
    console.log('--- FormComponent Render Trace ---');
    console.log('Current startDate state (for rendering):', startDate ? startDate.format('YYYY-MM-DD') : null); //
    console.log('Current numberOfDays state (for rendering):', numberOfDays); //
    console.log('Current endDate state (for rendering):', endDate ? endDate.format('YYYY-MM-DD') : null); //
    console.log('Current sliderCount state (for rendering):', sliderCount); //
    console.log('---------------------------------');

    const getPersonNameFromEmail = useCallback((email) => {
        return emailToPersonMap[email.toLowerCase()] || null;
    }, [emailToPersonMap]);

    // calculateEndDate is now simpler as it directly uses the state values
    // It's a helper function, not a memoized callback passed to useEffect directly.
    const calculateEndDateLogic = (start, days) => {
        console.log('calculateEndDateLogic called with: start =', start ? start.format('YYYY-MM-DD') : null, 'days =', days); //
        if (moment.isMoment(start) && start.isValid() && days > 0) {
            const calculatedEndDate = moment(start).add(days - 1, 'days');
            console.log('Calculated End Date inside calculateEndDateLogic:', calculatedEndDate.format('YYYY-MM-DD'));
            setEndDate(calculatedEndDate);
            setSliderCount(days);
        } else {
            console.log('Setting endDate to null and sliderCount to 0 (invalid start/days/moment object)'); //
            setEndDate(null);
            setSliderCount(0);
        }
    };

    // --- EFFECT HOOK 1: FETCH PERSON MAPPINGS AND INITIAL TASK DATA ---
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const personMappingsResponse = await fetch(`${BACKEND_API_BASE_URL}/api/person-mappings`);
                if (!personMappingsResponse.ok) {
                    const errorText = await personMappingsResponse.text();
                    throw new Error(`HTTP error! status: ${personMappingsResponse.status}, message: ${errorText}`);
                }
                const personMappingsData = await personMappingsResponse.json();
                setEmailToPersonMap(personMappingsData.emailToPersonMap || {});
                setAllAvailablePersons(personMappingsData.allAvailablePersons || []);

                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                    });

                    let initialStartForState = null;
                    let initialDaysForState = 0;
                    const initialHours = {};

                    if (task?.Planned_Start_Timestamp) {
                        initialStartForState = moment(task.Planned_Start_Timestamp);
                        console.log('Initial start date from task.Planned_Start_Timestamp:', initialStartForState.format('YYYY-MM-DD'));
                    }

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
                                .map((entry) => moment(entry.Day?.value))
                                .filter((dateMoment) => dateMoment.isValid());

                            if (validDays.length > 0) {
                                if (!initialStartForState) {
                                    initialStartForState = moment.min(validDays);
                                    console.log('Initial start date from earliest task entry (after moment conversion):', initialStartForState.format('YYYY-MM-DD'));
                                }

                                const actualInitialEnd = moment.max(validDays);
                                // Ensure positive days, at least 1 if dates are valid
                                initialDaysForState = actualInitialEnd.diff(initialStartForState, 'days') + 1;
                                if (initialDaysForState < 1) initialDaysForState = 1;

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

                        // Fallback for cases where per-day data is missing but totalDuration exists
                        if (Object.keys(initialHours).length === 0 && taskData.totalDuration > 0 && initialStartForState) {
                            initialHours[0] = taskData.totalDuration;
                            if (initialDaysForState === 0) {
                                initialDaysForState = 1; // At least one day for total duration
                            }
                        }

                    } else if (task?.Planned_Start_Timestamp && task?.Planned_Delivery_Timestamp) {
                        // If no detailed taskData, use task's planned timestamps
                        if (!initialStartForState) {
                            initialStartForState = moment(task.Planned_Start_Timestamp);
                        }
                        const initialEndFromTask = moment(task.Planned_Delivery_Timestamp);
                        initialDaysForState = initialEndFromTask.diff(initialStartForState, 'days') + 1;
                        if (initialDaysForState < 1) initialDaysForState = 1; // At least one day
                        console.log('Initial days calculated from task timestamps (no per-day data):', initialDaysForState);
                    }

                    console.log('useEffect (initial fetch): Setting initial startDate state to:', initialStartForState ? initialStartForState.format('YYYY-MM-DD') : null); //
                    console.log('useEffect (initial fetch): Setting initial numberOfDays state to:', initialDaysForState); //
                    setStartDate(initialStartForState);
                    setNumberOfDays(initialDaysForState);
                    setHours(initialHours);

                    // The calculation will be handled by the dedicated useEffect below.
                    // No direct call to calculateEndDateLogic here.

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
    }, [task, form]);


    // --- EFFECT HOOK 2: Calculate End Date and Slider Count whenever startDate or numberOfDays changes ---
    // This is the ONLY place that triggers the endDate/sliderCount calculation based on state
    useEffect(() => {
        console.log('useEffect (startDate/numberOfDays dependency): Recalculating end date and slider count based on latest state.'); //
        calculateEndDateLogic(startDate, numberOfDays);
    }, [startDate, numberOfDays]); // Depend on the state variables


    // --- EFFECT HOOK 3: PERSON RESPONSIBLE LOGIC (no changes needed here for date/slider issue) ---
    useEffect(() => {
        if (allAvailablePersons.length === 0 || Object.keys(emailToPersonMap).length === 0) {
            return;
        }

        const initialResponsibilityFromTask = task?.Responsibility || '';
        const userPersonName = getPersonNameFromEmail(currentUserEmail);

        if (isAdmin) {
            if (initialResponsibilityFromTask && allAvailablePersons.includes(initialResponsibilityFromTask)) {
                setPersonResponsible(initialResponsibilityFromTask);
                form.setFieldsValue({ personResponsible: initialResponsibilityFromTask });
            } else {
                setPersonResponsible('');
                form.setFieldsValue({ personResponsible: undefined });
            }
        } else {
            if (userPersonName && allAvailablePersons.includes(userPersonName)) {
                setPersonResponsible(userPersonName);
                form.setFieldsValue({ personResponsible: userPersonName });
            } else {
                setPersonResponsible('');
                form.setFieldsValue({ personResponsible: undefined });
            }
        }
    }, [task, currentUserEmail, form, getPersonNameFromEmail, isAdmin, allAvailablePersons, emailToPersonMap]);


    // --- HANDLERS FOR USER INPUT ---
    const handleStartDateChange = (date) => {
        console.log('handleStartDateChange: DatePicker selected (moment object):', date ? date.format('YYYY-MM-DD') : null); //
        setStartDate(date); // This will trigger the `useEffect` for calculation
    };

    const handleNumberOfDaysChange = (e) => {
        const days = parseInt(e.target.value, 10);
        const numericDays = isNaN(days) ? 0 : days; // Ensure it's a number, default to 0
        console.log('handleNumberOfDaysChange: Input days', numericDays); //
        setNumberOfDays(numericDays); // This will trigger the `useEffect` for calculation
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
                // Ensure startDate and endDate are valid Moment objects before formatting
                const plannedStartTimestamp = startDate && moment.isMoment(startDate) && startDate.isValid()
                    ? moment(startDate).startOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                const plannedDeliveryTimestamp = endDate && moment.isMoment(endDate) && endDate.isValid()
                    ? moment(endDate).endOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                const totalTime = calculateTotalTime();
                const slidersData = Array.from({ length: sliderCount }).map((_, index) => {
                    const calculatedDay = startDate && startDate.isValid() ? moment(startDate).add(index, 'days') : null;
                    const formattedDay = calculatedDay && calculatedDay.isValid() ? calculatedDay.format('YYYY-MM-DD') : null;
                    const durationValue = parseInt(hours[index], 10); // Final safeguard: parse to int just before sending
                    const finalDuration = isNaN(durationValue) ? 0 : durationValue; // Default to 0 if NaN

                    console.log(`Slider ${index}: Day=${formattedDay}, Duration=${finalDuration}`);
                    return {
                        day: formattedDay,
                        duration: finalDuration, // Ensure this is a number
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
                        console.error("Submission error:", error); //
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
        // Ensure value is a number
        const numericValue = typeof value === 'number' ? value : parseInt(value, 10) || 0;

        if (!startDate || !startDate.isValid()) {
            notification.warning({
                message: 'Missing Start Date',
                description: 'Please select a Start Date first to adjust task hours.',
            });
            return;
        }

        if (!personResponsible) {
            notification.warning({
                message: 'Missing Person Responsible',
                description: 'Please select a Person Responsible first to adjust task hours.',
            });
            return;
        }

        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480;
        let effectiveValue = numericValue;

        const alreadyScheduledMinutes = existingSchedules[personResponsible]?.[currentDay] || 0;

        const remainingMinutes = maxAllowedMinutes - alreadyScheduledMinutes;

        effectiveValue = Math.min(numericValue, remainingMinutes);

        if (numericValue > remainingMinutes) {
            notification.warning({
                message: 'Time Limit Reached',
                description: `Cannot schedule more than ${remainingMinutes} minutes for ${personResponsible} on ${currentDay} due to existing tasks.`,
            });
        }

        setHours((prev) => ({ ...prev, [index]: effectiveValue }));
    };

    const handleInputChange = (index, value) => {
        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue)) {
            numericValue = 0;
        }

        if (!startDate || !startDate.isValid()) {
            notification.warning({
                message: 'Missing Start Date',
                description: 'Please select a Start Date first to adjust task hours.',
            });
            setHours((prev) => ({ ...prev, [index]: 0 })); // Reset if no start date
            return;
        }

        if (!personResponsible) {
            notification.warning({
                message: 'Missing Person Responsible',
                description: 'Please select a Person Responsible first to adjust task hours.',
            });
            setHours((prev) => ({ ...prev, [index]: 0 })); // Reset if no person responsible
            return;
        }

        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480;
        let effectiveValue = numericValue;

        const alreadyScheduledMinutes = existingSchedules[personResponsible]?.[currentDay] || 0;
        const remainingMinutes = maxAllowedMinutes - alreadyScheduledMinutes;

        effectiveValue = Math.min(numericValue, remainingMinutes);

        if (numericValue > remainingMinutes) {
            notification.warning({
                message: 'Time Limit Reached',
                description: `Cannot schedule more than ${remainingMinutes} minutes for ${personResponsible} on ${currentDay} due to existing tasks.`,
            });
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

    const personsToDisplay = isAdmin
        ? allAvailablePersons
        : (getPersonNameFromEmail(currentUserEmail) && allAvailablePersons.includes(getPersonNameFromEmail(currentUserEmail)))
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

            {/* Render sliders only if startDate is valid and numberOfDays > 0 */}
            {startDate && startDate.isValid() && numberOfDays > 0 && Array.from({ length: sliderCount }).map((_, index) => (
                <Form.Item
                    key={index}
                    label={`Hours for Day ${index + 1} (${startDate && startDate.isValid() ? moment(startDate).add(index, 'days').format('YYYY-MM-DD') : 'N/A'})`}
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
                    value={personResponsible || undefined}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
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
