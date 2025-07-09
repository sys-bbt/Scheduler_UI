import React, { useState, useEffect, memo, useCallback } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

// Define the emails of users who can see and edit the full list (Admins)
// This remains hardcoded as it's a security/role definition, not dynamic user data.
const ADMIN_EMAILS = [
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
    // personResponsible is kept as a local state to drive calculations, but the Form.Item will manage its value
    const [personResponsible, setPersonResponsible] = useState('');
    const [existingSchedules, setExistingSchedules] = useState({});
    const [peopleOptions, setPeopleOptions] = useState([]); // Stores data fetched from /api/people-to-email-mapping
    const [peopleEmailMap, setPeopleEmailMap] = useState({}); // A map derived from peopleOptions for quick lookup


    console.log('FormComponent: currentUserEmail received:', currentUserEmail);
    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);
    console.log('FormComponent: isAdmin calculated as:', isAdmin);


    // Memoize the mapping logic to prevent unnecessary re-renders
    // This now uses the dynamically fetched peopleEmailMap
    const getPersonNameFromEmail = useCallback((email) => {
        const entry = Object.entries(peopleEmailMap).find(([, value]) => value.primaryEmail === email || value.allEmails.includes(email));
        return entry ? entry[0] : null;
    }, [peopleEmailMap]); // Dependency: peopleEmailMap


    // useCallback for date calculation to prevent re-creation
    const calculateDatesAndSliders = useCallback((startMoment, numDays) => {
        if (startMoment && startMoment.isValid() && numDays > 0) {
            const calculatedEndDate = startMoment.clone().add(numDays - 1, 'days'); // Inclusive end date
            form.setFieldsValue({
                endDate: calculatedEndDate,
            });
            setSliderCount(numDays);
        } else {
            form.setFieldsValue({
                endDate: null,
            });
            setSliderCount(0);
        }
    }, [form]);

    // --- EFFECT HOOK 1: FETCH ALL NECESSARY DATA (TASK, SCHEDULES, PEOPLE MAPPING) ---
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Fetch People To Email Mapping first, as it's needed for other initializations
                const peopleResponse = await fetch(`${BACKEND_API_BASE_URL}/api/people-to-email-mapping`);
                if (!peopleResponse.ok) {
                    const errorText = await peopleResponse.text();
                    throw new Error(`HTTP error! status: ${peopleResponse.status}, message: ${errorText}`);
                }
                const peopleData = await peopleResponse.json();
                setPeopleOptions(peopleData);

                // Create a map for quick lookup: { "Person Name": { primaryEmail: "...", allEmails: "..." } }
                const derivedPeopleMap = {};
                const availablePersonNames = [];
                peopleData.forEach(person => {
                    if (person.Name) { // Ensure Name exists
                        derivedPeopleMap[person.Name] = {
                            primaryEmail: person.Email || '', // Assuming 'Email' is the primary email field
                            allEmails: person.Emails || person.Email || '' // Assuming 'Emails' or fallback to 'Email'
                        };
                        availablePersonNames.push(person.Name);
                    }
                });
                setPeopleEmailMap(derivedPeopleMap);

                // Now proceed with task and schedule data only if a task is provided
                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                    });

                    // --- Fetch Per-Key-Per-Day Data (Slider Durations) ---
                    const perKeyResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                    if (!perKeyResponse.ok) {
                        const errorText = await perKeyResponse.text();
                        throw new Error(`HTTP error! status: ${perKeyResponse.status}, message: ${errorText}`);
                    }
                    const data = await perKeyResponse.json();

                    const taskData = data[task.Key];
                    let initialStartDateFromSliders = null;
                    let initialEndDateFromSliders = null;
                    let initialNumDaysFromSliders = 0;
                    let initialHours = {};

                    if (taskData && taskData.entries) {
                        const validDaysMoments = taskData.entries
                            .map(entry => moment(entry.Day?.value))
                            .filter(m => m.isValid());

                        if (validDaysMoments.length > 0) {
                            initialStartDateFromSliders = moment.min(validDaysMoments);
                            initialEndDateFromSliders = moment.max(validDaysMoments);
                            initialNumDaysFromSliders = initialEndDateFromSliders.diff(initialStartDateFromSliders, 'days') + 1;

                            taskData.entries.forEach(entry => {
                                const dayMoment = moment(entry.Day?.value);
                                if (dayMoment.isValid() && initialStartDateFromSliders) {
                                    const dayIndex = dayMoment.diff(initialStartDateFromSliders, 'days');
                                    initialHours[dayIndex] = entry.Duration;
                                }
                            });
                        }
                    }

                    // Prioritize task's planned dates for form display if available
                    const formStartDate = task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : initialStartDateFromSliders;
                    const formNumberOfDays = task.Total_Tasks || initialNumDaysFromSliders;

                    setHours(initialHours); // Set slider hours state

                    // Set form fields based on task or derived data
                    form.setFieldsValue({
                        startDate: formStartDate,
                        numberOfDays: formNumberOfDays,
                    });
                    calculateDatesAndSliders(formStartDate, formNumberOfDays);

                    // --- Fetch Per-Person-Per-Day Data (Existing Schedules) ---
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

                     // --- Set initial Person Responsible AFTER all data is loaded ---
                    const initialResponsibilityFromTask = task?.Responsibility || '';
                    const userPersonName = getPersonNameFromEmail(currentUserEmail);

                    let responsiblePersonToSet = '';
                    const allAvailablePersonNames = peopleData.map(p => p.Name); // Get actual names from fetched data

                    if (isAdmin) {
                        if (initialResponsibilityFromTask && allAvailablePersonNames.includes(initialResponsibilityFromTask)) {
                            responsiblePersonToSet = initialResponsibilityFromTask;
                        } else if (userPersonName && allAvailablePersonNames.includes(userPersonName)) {
                            responsiblePersonToSet = userPersonName;
                        } else {
                            responsiblePersonToSet = '';
                        }
                    } else {
                        if (userPersonName && allAvailablePersonNames.includes(userPersonName)) {
                            responsiblePersonToSet = userPersonName;
                        } else {
                            responsiblePersonToSet = '';
                            notification.warning({
                                message: 'Access Denied',
                                description: 'Your email is not mapped to a recognized person responsible. Please contact admin.',
                            });
                        }
                    }
                    setPersonResponsible(responsiblePersonToSet);
                    form.setFieldsValue({ personResponsible: responsiblePersonToSet || undefined }); // Set form field value
                }
            } catch (error) {
                console.error("Error fetching all data:", error);
                notification.error({
                    message: 'Error',
                    description: `Failed to load data: ${error.message}. Please check network and server logs.`,
                });
            }
        };

        fetchAllData();
    }, [task, form, calculateDatesAndSliders, currentUserEmail, isAdmin, getPersonNameFromEmail]); // Added dependencies


    // Handlers for date and number of days change, now updating form state
    const handleStartDateChange = (date) => {
        form.setFieldsValue({ startDate: date });
        const currentNumberOfDays = form.getFieldValue('numberOfDays');
        calculateDatesAndSliders(date, currentNumberOfDays);
        setHours({}); // Clear hours when start date changes significantly
    };

    const handleNumberOfDaysChange = (e) => {
        const numericDays = parseInt(e.target.value, 10);
        form.setFieldsValue({ numberOfDays: numericDays });
        const currentStartDate = form.getFieldValue('startDate');
        calculateDatesAndSliders(currentStartDate, numericDays);
        setHours({}); // Clear hours when number of days changes significantly
    };

    const handleSliderChange = (index, value) => {
        const currentStartDate = form.getFieldValue('startDate');
        const currentPersonResponsible = form.getFieldValue('personResponsible');

        const currentDay = currentStartDate ? currentStartDate.clone().add(index, 'days').format('YYYY-MM-DD') : null;
        const maxAllowedMinutes = 480;
        let effectiveValue = value;

        if (currentDay && currentPersonResponsible && existingSchedules[currentPersonResponsible]?.[currentDay]) {
            const alreadyScheduledMinutes = existingSchedules[currentPersonResponsible][currentDay];
            const remainingMinutes = maxAllowedMinutes - (alreadyScheduledMinutes || 0);
            effectiveValue = Math.min(value, remainingMinutes);
            if (value > remainingMinutes) {
                notification.warning({
                    message: 'Time Limit Reached',
                    description: `Cannot schedule more than ${remainingMinutes} minutes for ${currentPersonResponsible} on ${currentDay} due to existing tasks.`,
                });
            }
        }

        setHours((prev) => ({ ...prev, [index]: effectiveValue }));
    };

    const handleInputChange = (index, value) => {
        let numericValue = parseInt(value, 10);
        if (isNaN(numericValue) || numericValue < 0) {
            numericValue = 0;
        }

        const currentStartDate = form.getFieldValue('startDate');
        const currentPersonResponsible = form.getFieldValue('personResponsible');

        const currentDay = currentStartDate ? currentStartDate.clone().add(index, 'days').format('YYYY-MM-DD') : null;
        const maxAllowedMinutes = 480;
        let effectiveValue = numericValue;

        if (currentDay && currentPersonResponsible && existingSchedules[currentPersonResponsible]?.[currentDay]) {
            const alreadyScheduledMinutes = existingSchedules[currentPersonResponsible][currentDay];
            const remainingMinutes = maxAllowedMinutes - (alreadyScheduledMinutes || 0);
            effectiveValue = Math.min(numericValue, remainingMinutes);
            if (numericValue > remainingMinutes) {
                notification.warning({
                    message: 'Time Limit Reached',
                    description: `Cannot schedule more than ${remainingMinutes} minutes for ${currentPersonResponsible} on ${currentDay} due to existing tasks.`,
                });
            }
        }

        setHours((prev) => ({
            ...prev,
            [index]: effectiveValue,
        }));
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
                const plannedStartTimestamp = values.startDate
                    ? moment(values.startDate).startOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                const plannedDeliveryTimestamp = values.endDate
                    ? moment(values.endDate).endOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                    : null;

                const totalTime = calculateTotalTime();
                const slidersData = Array.from({ length: sliderCount }).map((_, index) => {
                    const calculatedDay = moment(values.startDate).add(index, 'days');
                    const formattedDay = calculatedDay.isValid() ? calculatedDay.format('YYYY-MM-DD') : null;
                    return {
                        day: formattedDay,
                        duration: hours[index] || 0,
                        slot: "Null",
                        personResponsible: values.personResponsible, // From validated form values
                    };
                });

                // Get email data from the dynamically fetched peopleEmailMap
                const selectedPersonEmailData = peopleEmailMap[values.personResponsible];
                const newPrimaryEmail = selectedPersonEmailData ? selectedPersonEmailData.primaryEmail : null;
                const newAllEmails = selectedPersonEmailData ? selectedPersonEmailData.allEmails : null;

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
                    Responsibility: values.personResponsible, // This comes from the dropdown
                    Current_Status: task.Current_Status || 'Scheduled', // Default to 'Scheduled' if unassigned
                    Email: newPrimaryEmail, // Use the dynamically determined primary email
                    Emails: newAllEmails, // Use the dynamically determined all emails string
                    Total_Tasks: task.Total_Tasks,
                    Completed_Tasks: task.Completed_Tasks,
                    Planned_Tasks: task.Planned_Tasks,
                    Percent_Tasks_Completed: task.Percent_Tasks_Completed,
                    Created_at: task.Created_at || moment().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC",
                    Updated_at: moment().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC",
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
                            personResponsible: scheduledData.Responsibility,
                            totalTime: totalTime,
                            Planned_Delivery_Timestamp: scheduledData.Planned_Delivery_Timestamp,
                            Current_Status: scheduledData.Current_Status,
                            Email: scheduledData.Email,
                            Emails: scheduledData.Emails
                        });
                    })
                    .catch((error) => {
                        notification.error({
                            message: 'Error',
                            description: error.message || 'An error occurred while updating the task.',
                        });
                        console.error("Submission Error:", error);
                    });
            })
            .catch((info) => {
                console.error('Validation Failed:', info);
                notification.error({
                    message: 'Validation Error',
                    description: 'Please fill in all required fields correctly. Check console for details.',
                });
            });
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
    const allAvailablePersonNames = peopleOptions.map(p => p.Name); // Names from fetched data
    const personsToDisplay = isAdmin
        ? allAvailablePersonNames.sort() // Sort for better UX in dropdown
        : (getPersonNameFromEmail(currentUserEmail) && allAvailablePersonNames.includes(getPersonNameFromEmail(currentUserEmail)))
            ? [getPersonNameFromEmail(currentUserEmail)]
            : [];


    // Render loading state if people data hasn't been fetched yet
    if (peopleOptions.length === 0) {
        return <div>Loading person data...</div>;
    }

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
                    <Form.Item
                        name="startDate"
                        label="Start Date"
                        rules={[{ required: true, message: 'Please select start date!' }]}
                    >
                        <DatePicker
                            format="YYYY-MM-DD"
                            onChange={handleStartDateChange}
                            placeholder="Select start date"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item
                        name="numberOfDays"
                        label="Number of Days"
                        rules={[{ required: true, message: 'Please input number of days!' }, { type: 'number', min: 0, message: 'Must be a positive number!' }]}
                    >
                        <Input
                            type="number"
                            onChange={handleNumberOfDaysChange}
                            min={0}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item name="endDate" label="End Date">
                        <DatePicker
                            format="YYYY-MM-DD"
                            disabled // End Date is calculated
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            {/* Per-day sliders */}
            {form.getFieldValue('startDate') && form.getFieldValue('numberOfDays') > 0 && sliderCount > 0 && Array.from({ length: sliderCount }).map((_, index) => {
                const currentStartDate = form.getFieldValue('startDate');
                const formattedDate = currentStartDate && currentStartDate.isValid() ? currentStartDate.clone().add(index, 'days').format('YYYY-MM-DD') : 'N/A';
                const totalScheduledForDay = existingSchedules[personResponsible]?.[formattedDate] || 0;
                const availableMinutes = 480 - totalScheduledForDay; // Max 8 hours (480 mins) - already scheduled

                return (
                    <Form.Item key={index} label={`Hours for Day ${index + 1} (${formattedDate})`}>
                        <Row gutter={20} align="middle">
                            <Col xs={16}>
                                <Slider
                                    marks={customMarks}
                                    min={0}
                                    max={480} // Max possible for one day (8 hours * 60 minutes)
                                    step={1}
                                    onChange={(value) => handleSliderChange(index, value)}
                                    value={hours[index] || 0}
                                    tooltip={{ formatter: (value) => `${value} minutes` }}
                                />
                            </Col>
                            <Col xs={8}>
                                <Input
                                    type="number"
                                    min={0}
                                    max={480} // Max possible for one day
                                    value={hours[index] || 0}
                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                    addonAfter="min"
                                />
                            </Col>
                        </Row>
                        {personResponsible && totalScheduledForDay > 0 && (
                            <div style={{ color: 'blue', fontSize: '0.8em', marginTop: '5px' }}>
                                (Scheduled for {personResponsible} on {formattedDate}: {totalScheduledForDay} min, Available: {availableMinutes} min)
                            </div>
                        )}
                        {personResponsible && availableMinutes < 0 && (
                             <div style={{ color: 'red', fontSize: '0.8em', marginTop: '5px' }}>
                                Warning: Already over-scheduled for {personResponsible} on {formattedDate} by {Math.abs(availableMinutes)} min!
                            </div>
                        )}
                    </Form.Item>
                );
            })}

            <Form.Item
                label="Person Responsible"
                name="personResponsible"
                rules={[{ required: true, message: 'Please select the person responsible!' }]}
            >
                {isAdmin ? (
                    <Select
                        placeholder="Select a person"
                        onChange={(value) => {
                            setPersonResponsible(value);
                            form.setFieldsValue({ personResponsible: value });
                        }}
                        value={personResponsible || undefined} // Use internal state as value
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                            (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        // Ensure dropdown is disabled if no data is fetched yet, or if not admin and no mapped name
                        disabled={!peopleOptions.length || (!isAdmin && !getPersonNameFromEmail(currentUserEmail))}
                    >
                        {personsToDisplay.map((personName) => (
                            <Option key={personName} value={personName}>
                                {personName}
                            </Option>
                        ))}
                    </Select>
                ) : (
                    <Input
                        readOnly
                        value={personResponsible || ''} // Display the determined name
                        placeholder="Your assigned name"
                        disabled={!personResponsible} // Disable if no name is set
                    />
                )}
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
