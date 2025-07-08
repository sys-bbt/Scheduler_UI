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
    const [hours, setHours] = useState({});
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [personResponsible, setPersonResponsible] = useState('');
    const [numberOfDays, setNumberOfDays] = useState(0);
    const [existingSchedules, setExistingSchedules] = useState({});

    const [emailToPersonMap, setEmailToPersonMap] = useState({});
    const [allAvailablePersons, setAllAvailablePersons] = useState([]);

    const isAdmin = ADMIN_EMAILS.includes(currentUserEmail);

    const getPersonNameFromEmail = useCallback((email) => {
        return emailToPersonMap[email.toLowerCase()] || null;
    }, [emailToPersonMap]);

    const calculateEndDateLogic = (start, days) => {
        const safeStart = moment(start); // Safe conversion
        if (safeStart.isValid() && days > 0) {
            const calculatedEndDate = moment(safeStart).add(days - 1, 'days');
            setEndDate(calculatedEndDate);
        } else {
            setEndDate(null);
        }
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const personMappingsResponse = await fetch(`${BACKEND_API_BASE_URL}/api/person-mappings`);
                const personMappingsData = await personMappingsResponse.json();
                setEmailToPersonMap(personMappingsData.emailToPersonMap || {});
                setAllAvailablePersons(personMappingsData.allAvailablePersons || []);

                if (task) {
                    form.setFieldsValue({ name: task.Task_Details || '' });

                    let initialStartForState = task?.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null;
                    let initialDaysForState = 0;
                    const initialHours = {};

                    const response = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                    const data = await response.json();
                    const taskData = data[task.Key];

                    if (taskData) {
                        const validDays = taskData.entries
                            .map((entry) => moment(entry.Day?.value))
                            .filter((d) => d.isValid());

                        if (validDays.length > 0) {
                            if (!initialStartForState) {
                                initialStartForState = moment.min(validDays);
                            }
                            const actualEnd = moment.max(validDays);
                            initialDaysForState = actualEnd.diff(initialStartForState, 'days') + 1;

                            taskData.entries.forEach((entry) => {
                                const dayMoment = moment(entry.Day.value);
                                if (dayMoment.isValid()) {
                                    const dayIndex = dayMoment.diff(initialStartForState, 'days');
                                    initialHours[dayIndex] = entry.Duration;
                                }
                            });
                        }

                        if (Object.keys(initialHours).length === 0 && taskData.totalDuration > 0 && initialStartForState) {
                            initialHours[0] = taskData.totalDuration;
                            if (initialDaysForState === 0) initialDaysForState = 1;
                        }
                    } else if (task?.Planned_Start_Timestamp && task?.Planned_Delivery_Timestamp) {
                        if (!initialStartForState) initialStartForState = moment(task.Planned_Start_Timestamp);
                        const end = moment(task.Planned_Delivery_Timestamp);
                        initialDaysForState = end.diff(initialStartForState, 'days') + 1;
                    }

                    setStartDate(initialStartForState);
                    setNumberOfDays(initialDaysForState);
                    setHours(initialHours);

                    const perPersonResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-person-per-day`);
                    const perPersonData = await perPersonResponse.json();
                    const schedules = {};
                    perPersonData.forEach(({ Responsibility, Day, Duration_In_Minutes }) => {
                        const date = Day.value;
                        if (!schedules[Responsibility]) schedules[Responsibility] = {};
                        schedules[Responsibility][date] = Duration_In_Minutes;
                    });
                    setExistingSchedules(schedules);
                }
            } catch (error) {
                notification.error({
                    message: 'Error',
                    description: `Failed to load data: ${error.message}`,
                });
            }
        };

        fetchInitialData();
    }, [task, form]);

    useEffect(() => {
        calculateEndDateLogic(startDate, numberOfDays);
    }, [startDate, numberOfDays]);

    useEffect(() => {
        if (!allAvailablePersons.length || !Object.keys(emailToPersonMap).length) return;

        const taskResp = task?.Responsibility || '';
        const userPersonName = getPersonNameFromEmail(currentUserEmail);

        if (isAdmin) {
            setPersonResponsible(taskResp || '');
            form.setFieldsValue({ personResponsible: taskResp || undefined });
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

    const handleStartDateChange = (date) => setStartDate(date);
    const handleNumberOfDaysChange = (e) => setNumberOfDays(parseInt(e.target.value, 10) || 0);

    const calculateTotalTime = () =>
        Object.values(hours).reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            const plannedStartTimestamp = moment(startDate).startOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC";
            const plannedDeliveryTimestamp = moment(endDate).endOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC";

            const totalTime = calculateTotalTime();
            const slidersData = Array.from({ length: numberOfDays }).map((_, index) => {
                const calculatedDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
                const durationValue = parseInt(hours[index], 10);
                return {
                    day: calculatedDay,
                    duration: isNaN(durationValue) ? 0 : durationValue,
                    slot: "Null",
                    Duration_Uint: "min",
                    Responsibility: personResponsible,
                };
            });

            const email = Object.entries(emailToPersonMap).find(([_, name]) => name === personResponsible)?.[0] || currentUserEmail;

            const scheduledData = {
                ...task,
                Task_Details: values.name,
                Planned_Start_Timestamp: plannedStartTimestamp,
                Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
                Responsibility: personResponsible,
                Email: email,
                Emails: email,
                Created_at: moment().format("DD/MM/YYYY"),
                Updated_at: moment().format("DD/MM/YYYY"),
                sliders: slidersData,
            };

            fetch(`${BACKEND_API_BASE_URL}/api/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduledData),
            })
                .then((res) => {
                    if (!res.ok) throw new Error("Failed to submit task.");
                    return res.json();
                })
                .then(() => {
                    notification.success({ message: 'Task Updated', description: 'Task has been updated successfully!' });
                    onSubmit({
                        personResponsible,
                        totalTime,
                        Planned_Delivery_Timestamp: scheduledData.Planned_Delivery_Timestamp,
                    });
                })
                .catch((err) =>
                    notification.error({ message: 'Error', description: err.message })
                );
        });
    };

    const handleSliderChange = (index, value) => {
        if (!startDate?.isValid() || !personResponsible) return;
        const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
        const alreadyScheduled = existingSchedules[personResponsible]?.[currentDay] || 0;
        const remaining = 480 - alreadyScheduled;

        const finalValue = Math.min(value, remaining);
        if (value > remaining) {
            notification.warning({
                message: 'Time Limit Reached',
                description: `Only ${remaining} minutes available for ${personResponsible} on ${currentDay}.`,
            });
        }

        setHours((prev) => ({ ...prev, [index]: finalValue }));
    };

    const handleInputChange = (index, value) => {
        const intVal = parseInt(value, 10);
        handleSliderChange(index, isNaN(intVal) ? 0 : intVal);
    };

    const customMarks = {
        1: '1 m', 60: '1 h', 120: '2 h', 180: '3 h',
        240: '4 h', 300: '5 h', 360: '6 h', 420: '7 h', 480: '8 h',
    };

    const personsToDisplay = isAdmin
        ? allAvailablePersons
        : (getPersonNameFromEmail(currentUserEmail) && allAvailablePersons.includes(getPersonNameFromEmail(currentUserEmail)))
            ? [getPersonNameFromEmail(currentUserEmail)]
            : [];

    return (
        <Form form={form} layout="vertical">
            <Form.Item name="name" label="Task Name" rules={[{ required: true }]}>
                <Input readOnly />
            </Form.Item>

            <Row gutter={[8, 16]}>
                <Col xs={24} sm={8}>
                    <Form.Item label="Start Date">
                        <DatePicker
                            format="YYYY-MM-DD"
                            onChange={handleStartDateChange}
                            value={startDate}
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

            {startDate && startDate.isValid() && numberOfDays > 0 && Array.from({ length: numberOfDays }).map((_, index) => (
                <Form.Item key={index} label={`Hours for Day ${index + 1} (${moment(startDate).add(index, 'days').format('YYYY-MM-DD')})`}>
                    <Row gutter={20}>
                        <Col xs={20}>
                            <Slider
                                marks={customMarks}
                                min={0}
                                max={480}
                                step={1}
                                onChange={(val) => handleSliderChange(index, val)}
                                value={hours[index] || 0}
                                tooltip={{ formatter: (val) => `${val} minutes` }}
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
                rules={[{ required: true }]}
            >
                <Select
                    placeholder="Select a person"
                    onChange={setPersonResponsible}
                    value={personResponsible || undefined}
                    showSearch
                    disabled={!isAdmin && personsToDisplay.length === 0}
                >
                    {personsToDisplay.map((person) => (
                        <Option key={person} value={person}>{person}</Option>
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
