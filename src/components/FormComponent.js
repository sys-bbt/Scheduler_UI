import React, { useState, useEffect, memo } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

const FormComponent = ({ onSubmit, task }) => {
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

    // Hardcoded list of available persons
    // You can customize this list with the names you need
    const hardcodedPersons = ["Neelam Purohit" , "Meghna Jalali" , "Zoya Ansari" , "Shweta Gaikwad" , "Hitesh Rattesar" , "System"];


    useEffect(() => {
        const fetchTaskData = async () => {
            try {
                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                    });
                    
                    // Set initial person responsible from task prop
                    // Ensure that task.Responsibility (if it exists) is also present in hardcodedPersons
                    setPersonResponsible(task.Responsibility || '');

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
                    // We are NOT using `personsSet` from this fetch anymore to populate `availablePersons`
                    perPersonData.forEach((entry) => {
                        const { Responsibility, Day, Duration_In_Minutes } = entry;
                        const date = Day.value;
                        if (!schedules[Responsibility]) {
                            schedules[Responsibility] = {};
                        }
                        schedules[Responsibility][date] = Duration_In_Minutes;
                    });

                    setExistingSchedules(schedules);
                    // The `availablePersons` state and its setter are no longer used for the dropdown,
                    // as we're directly using `hardcodedPersons`.
                    // The `setAvailablePersons` line is removed.
                }
            } catch (error) {
                console.error("Error fetching task data:", error);
                notification.error({
                    message: 'Error',
                    description: 'Failed to load task data or existing schedules.',
                });
            }
        };

        fetchTaskData();
    }, [task, form]);


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
                        slot: "Null",
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
                    Short_description: task.Short_Description,
                    Planned_Start_Timestamp: plannedStartTimestamp,
                    Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
                    Responsibility: personResponsible,
                    Current_Status: task.Current_Status,
                    Email: task.Email,
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

                console.log('Scheduled Data:', scheduledData);

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
                <Input />
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
                >
                    {/* Hardcoded list of persons for the dropdown */}
                    {hardcodedPersons.map((person) => (
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
