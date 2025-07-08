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

const FormComponent = ({ onSubmit, task, currentUserEmail }) => {
    const [form] = Form.useForm();

    // State
    const [sliderCount, setSliderCount] = useState(0);
    const [hours, setHours] = useState({});
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [personResponsible, setPersonResponsible] = useState('');
    const [numberOfDays, setNumberOfDays] = useState(0);
    const [existingSchedules, setExistingSchedules] = useState({});
    const [emailToPersonMap, setEmailToPersonMap] = useState({});
    const [allAvailablePersons, setAllAvailablePersons] = useState([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

    // Helper: get person name from email
    const getPersonNameFromEmail = useCallback(
        (email) => emailToPersonMap[email?.toLowerCase()] || null,
        [emailToPersonMap]
    );

    // Calculate end date and slider count
    const calculateEndDateLogic = useCallback((start, days) => {
        if (start && moment.isMoment(start) && start.isValid() && days > 0) {
            const calculatedEndDate = moment(start).add(days - 1, 'days');
            setEndDate(calculatedEndDate);
            setSliderCount(days);
            setHours(prevHours => {
                const newHours = { ...prevHours };
                for (let i = 0; i < days; i++) {
                    if (newHours[i] === undefined) newHours[i] = 0;
                }
                return newHours;
            });
        } else {
            setEndDate(null);
            setSliderCount(0);
            setHours({});
        }
    }, []);

    // Fetch initial data
    useEffect(() => {
        let isMounted = true;
        const fetchInitialData = async () => {
            try {
                // 1. Fetch person mappings
                const personMappingsResponse = await fetch(`${BACKEND_API_BASE_URL}/api/person-mappings`);
                const personMappingsData = await personMappingsResponse.json();
                if (!isMounted) return;
                setEmailToPersonMap(personMappingsData.emailToPersonMap || {});
                setAllAvailablePersons(personMappingsData.allAvailablePersons || []);

                // 2. Initialize state from task
                let initialStart = null;
                let initialDays = 0;
                let initialHours = {};

                if (task) {
                    form.setFieldsValue({ name: task.Task_Details || '' });

                    if (task?.Planned_Start_Timestamp) {
                        initialStart = moment(task.Planned_Start_Timestamp);
                    }

                    // 3. Fetch per-key-per-day data
                    const response = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                    const data = await response.json();
                    const taskData = data[task.Key];

                    if (taskData?.entries?.length > 0) {
                        const validDays = taskData.entries
                            .map((entry) => moment(entry.Day?.value))
                            .filter((dateMoment) => dateMoment.isValid());
                        if (validDays.length > 0) {
                            if (!initialStart) initialStart = moment.min(validDays);
                            const actualInitialEnd = moment.max(validDays);
                            initialDays = actualInitialEnd.diff(initialStart, 'days') + 1;
                            if (initialDays < 1) initialDays = 1;

                            taskData.entries.forEach(entry => {
                                if (entry.Duration !== undefined && entry.Day !== undefined) {
                                    const dayMoment = moment(entry.Day.value);
                                    if (dayMoment.isValid() && initialStart && dayMoment.isSameOrAfter(initialStart, 'day')) {
                                        const dayIndex = dayMoment.diff(initialStart, 'days');
                                        initialHours[dayIndex] = entry.Duration;
                                    }
                                }
                            });
                        }
                    } else if (task?.Planned_Start_Timestamp && task?.Planned_Delivery_Timestamp) {
                        if (!initialStart) initialStart = moment(task.Planned_Start_Timestamp);
                        const initialEndFromTask = moment(task.Planned_Delivery_Timestamp);
                        initialDays = initialEndFromTask.diff(initialStart, 'days') + 1;
                        if (initialDays < 1) initialDays = 1;
                    }

                    // 4. Fetch existing schedules
                    const perPersonResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-person-per-day`);
                    const perPersonData = await perPersonResponse.json();
                    const schedules = {};
                    perPersonData.forEach((entry) => {
                        const { Responsibility, Day, Duration_In_Minutes } = entry;
                        const date = Day.value;
                        if (!schedules[Responsibility]) schedules[Responsibility] = {};
                        schedules[Responsibility][date] = Duration_In_Minutes;
                    });
                    setExistingSchedules(schedules);
                }

                // 5. Set all state before marking as loaded
                setStartDate(initialStart);
                setNumberOfDays(initialDays);
                setHours(initialHours);

                // This will trigger the useEffect below for endDate/sliderCount
                setIsDataLoaded(true);
            } catch (error) {
                notification.error({
                    message: 'Error',
                    description: `Failed to load data: ${error.message}.`,
                });
                setIsDataLoaded(true);
            }
        };

        fetchInitialData();
        return () => { isMounted = false; };
    }, [task, form]);

    // Calculate end date and sliders after data loaded or when startDate/numberOfDays changes
    useEffect(() => {
        if (isDataLoaded) {
            calculateEndDateLogic(startDate, numberOfDays);
        }
    }, [startDate, numberOfDays, calculateEndDateLogic, isDataLoaded]);

    // Set person responsible (after data loaded)
    useEffect(() => {
        if (!isDataLoaded || allAvailablePersons.length === 0 || Object.keys(emailToPersonMap).length === 0) return;

        const initialResponsibility = task?.Responsibility || '';
        const userPersonName = getPersonNameFromEmail(currentUserEmail);

        if (isAdmin) {
            if (initialResponsibility && allAvailablePersons.includes(initialResponsibility)) {
                setPersonResponsible(initialResponsibility);
                form.setFieldsValue({ personResponsible: initialResponsibility });
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
    }, [task, currentUserEmail, form, getPersonNameFromEmail, isAdmin, allAvailablePersons, emailToPersonMap, isDataLoaded]);

    // Handlers
    const handleStartDateChange = (date) => {
        setStartDate(date);
        setHours({});
    };

    const handleNumberOfDaysChange = (e) => {
        const days = parseInt(e.target.value, 10);
        setNumberOfDays(isNaN(days) || days < 0 ? 0 : days);
        setHours({});
    };

    const calculateTotalTime = () => Object.values(hours).reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            const plannedStartTimestamp = startDate && startDate.isValid()
                ? moment(startDate).startOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                : null;
            const plannedDeliveryTimestamp = endDate && endDate.isValid()
                ? moment(endDate).endOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                : null;
            const totalTime = calculateTotalTime();
            const slidersData = Array.from({ length: sliderCount }).map((_, index) => {
                const calculatedDay = startDate && startDate.isValid() ? moment(startDate).add(index, 'days') : null;
                const formattedDay = calculatedDay && calculatedDay.isValid() ? calculatedDay.format('YYYY-MM-DD') : null;
                const durationValue = parseInt(hours[index], 10);
                const finalDuration = isNaN(durationValue) ? 0 : durationValue;
                return {
                    day: formattedDay,
                    duration: finalDuration,
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

            fetch(`${BACKEND_API_BASE_URL}/api/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduledData),
            })
                .then((response) => {
                    if (!response.ok) return response.text().then(text => { throw new Error(text); });
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
        }).catch((info) => {
            notification.error({
                message: 'Error',
                description: 'Please fill in all required fields correctly.',
            });
        });
    };

    const handleSliderChange = (index, value) => {
        const numericValue = typeof value === 'number' ? value : parseInt(value, 10) || 0;
        if (!startDate || !startDate.isValid() || !personResponsible) {
            notification.warning({
                message: 'Missing Data',
                description: 'Please select a Start Date and Person Responsible first.',
            });
            return;
        }
        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480;
        const alreadyScheduledMinutes = existingSchedules[personResponsible]?.[currentDay] || 0;
        const remainingMinutes = maxAllowedMinutes - alreadyScheduledMinutes;
        const effectiveValue = Math.min(numericValue, remainingMinutes);

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
        if (isNaN(numericValue)) numericValue = 0;
        if (!startDate || !startDate.isValid() || !personResponsible) {
            notification.warning({
                message: 'Missing Data',
                description: 'Please select a Start Date and Person Responsible first.',
            });
            setHours((prev) => ({ ...prev, [index]: 0 }));
            return;
        }
        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const maxAllowedMinutes = 480;
        const alreadyScheduledMinutes = existingSchedules[personResponsible]?.[currentDay] || 0;
        const remainingMinutes = maxAllowedMinutes - alreadyScheduledMinutes;
        const effectiveValue = Math.min(numericValue, remainingMinutes);

        if (numericValue > remainingMinutes) {
            notification.warning({
                message: 'Time Limit Reached',
                description: `Cannot schedule more than ${remainingMinutes} minutes for ${personResponsible} on ${currentDay} due to existing tasks.`,
            });
        }
        setHours((prev) => ({ ...prev, [index]: effectiveValue < 0 ? 0 : effectiveValue }));
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

    // Show loading state until data is loaded
    if (!isDataLoaded) return <div>Loading...</div>;

    // Debug info
    const debugInfo = {
        "Start Date Valid": startDate && startDate.isValid() ? 'Yes' : 'No',
        "Number of Days": numberOfDays,
        "Slider Count": sliderCount,
        "End Date Valid": endDate && endDate.isValid() ? 'Yes' : 'No',
        "Should Show Sliders": startDate && startDate.isValid() && numberOfDays > 0 && sliderCount > 0 ? 'Yes' : 'No'
    };

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

            <div style={{ marginBottom: '16px', padding: '8px', backgroundColor: '#f0f0f0', fontSize: '12px' }}>
                <strong>Debug Info:</strong><br />
                {Object.entries(debugInfo).map(([key, value]) => (
                    <span key={key}>{key}: {value}<br /></span>
                ))}
            </div>

            {startDate && startDate.isValid() && numberOfDays > 0 && sliderCount > 0 &&
                Array.from({ length: sliderCount }).map((_, index) => {
                    const dayDate = moment(startDate).add(index, 'days');
                    const formattedDate = dayDate.isValid() ? dayDate.format('YYYY-MM-DD') : 'Invalid Date';
                    return (
                        <Form.Item
                            key={index}
                            label={`Hours for Day ${index + 1} (${formattedDate})`}
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
                    );
                })
            }

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
