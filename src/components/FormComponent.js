import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Slider, DatePicker, notification, Row, Col } from 'antd';
import moment from 'moment';

const BACKEND_API_BASE_URL = 'https://server-ui-2.onrender.com';

const FormComponent = ({ onSubmit, task }) => {
    const [form] = Form.useForm();
    const [sliderCount, setSliderCount] = useState(0);
    const [hours, setHours] = useState({}); // Stores slider values by index {0: 120, 1: 60}
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [personResponsible, setPersonResponsible] = useState(''); // From task.Responsibility or user input
    const [existingSchedules, setExistingSchedules] = useState({}); // To hold per-person-per-day data

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

    // Effect to handle initial task data loading
    useEffect(() => {
        const fetchTaskData = async () => {
            try {
                if (task) {
                    // Set initial form values from task object
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                        startDate: task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null,
                        numberOfDays: task.Total_Tasks || 0, // Assuming Total_Tasks stores num days
                    });
                    setPersonResponsible(task.Responsibility || '');

                    // Initialize `hours` and `sliderCount` based on fetched `per-key-per-day` data
                    const response = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    const taskData = data[task.Key]; // Data for the specific task Key

                    let initialHours = {};
                    let initialStartDateFromSliders = null;
                    let initialEndDateFromSliders = null;
                    let initialNumDaysFromSliders = 0;

                    if (taskData && taskData.entries) {
                        const validDaysMoments = taskData.entries
                            .map(entry => moment(entry.Day?.value))
                            .filter(m => m.isValid());

                        if (validDaysMoments.length > 0) {
                            initialStartDateFromSliders = moment.min(validDaysMoments);
                            initialEndDateFromSliders = moment.max(validDaysMoments);
                            initialNumDaysFromSliders = initialEndDateFromSliders.diff(initialStartDateFromSliders, 'days') + 1;

                            // Populate hours based on fetched slider data
                            taskData.entries.forEach(entry => {
                                const dayMoment = moment(entry.Day?.value);
                                if (dayMoment.isValid() && initialStartDateFromSliders) {
                                    const dayIndex = dayMoment.diff(initialStartDateFromSliders, 'days');
                                    initialHours[dayIndex] = entry.Duration;
                                }
                            });
                        }
                    }

                    // Prioritize `task`'s planned start/delivery dates if available for form display
                    // But use slider-derived dates for slider array length if `task.Total_Tasks` is 0
                    const formStartDate = task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : initialStartDateFromSliders;
                    const formNumberOfDays = task.Total_Tasks || initialNumDaysFromSliders;

                    setHours(initialHours);
                    form.setFieldsValue({
                        startDate: formStartDate,
                        numberOfDays: formNumberOfDays,
                    });
                    calculateDatesAndSliders(formStartDate, formNumberOfDays);


                    // Fetch per-person-per-day (existing schedules)
                    const perPersonResponse = await fetch(`${BACKEND_API_BASE_URL}/api/per-person-per-day`);
                    if (!perPersonResponse.ok) throw new Error(`HTTP error! status: ${perPersonResponse.status}`);
                    const perPersonData = await perPersonResponse.json();
                    const schedules = {};
                    perPersonData.forEach((entry) => {
                        const { Responsibility, Day, Duration_In_Minutes } = entry;
                        const date = Day.value; // Assuming Day.value is 'YYYY-MM-DD'
                        if (!schedules[Responsibility]) schedules[Responsibility] = {};
                        schedules[Responsibility][date] = Duration_In_Minutes;
                    });
                    setExistingSchedules(schedules);
                }
            } catch (error) {
                notification.error({
                    message: 'Error',
                    description: `Failed to load task data: ${error.message}.`,
                });
                console.error("Error loading task data:", error);
            } finally {
                setIsDataLoaded(true);
            }
        };

        fetchTaskData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task, form, calculateDatesAndSliders]); // Depend on task and form instance, and useCallback

    // Handlers for user input
    const handleStartDateChange = (date) => {
        form.setFieldsValue({ startDate: date }); // Update form value
        const currentNumberOfDays = form.getFieldValue('numberOfDays'); // Get current number of days from form
        calculateDatesAndSliders(date, currentNumberOfDays);
        setHours({}); // Clear hours on date change (adjust if you want to preserve for same days)
    };

    const handleNumberOfDaysChange = (e) => {
        const numericDays = parseInt(e.target.value, 10) || 0;
        form.setFieldsValue({ numberOfDays: numericDays }); // Update form value
        const currentStartDate = form.getFieldValue('startDate'); // Get current start date from form
        calculateDatesAndSliders(currentStartDate, numericDays);
        setHours({}); // Clear hours on number of days change
    };

    const handleSliderChange = (index, value) => {
        setHours((prev) => ({ ...prev, [index]: value }));
    };

    const handleInputChange = (index, value) => {
        const numericValue = parseInt(value, 10) || 0;
        setHours((prev) => ({ ...prev, [index]: numericValue }));
    };

    const calculateTotalTime = () => {
        return Object.values(hours).reduce((acc, curr) => acc + (parseInt(curr, 10) || 0), 0);
    };

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            const currentStartDate = form.getFieldValue('startDate');
            const currentEndDate = form.getFieldValue('endDate');

            const plannedStartTimestamp = currentStartDate && currentStartDate.isValid()
                ? currentStartDate.startOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                : null;
            const plannedDeliveryTimestamp = currentEndDate && currentEndDate.isValid()
                ? currentEndDate.endOf('day').utc().format("YYYY-MM-DD HH:mm:ss.SSSSSS") + " UTC"
                : null;
            const totalTime = calculateTotalTime();

            // Prepare sliders data for backend
            const slidersData = Array.from({ length: sliderCount }).map((_, index) => {
                const calculatedDay = currentStartDate && currentStartDate.isValid() ? currentStartDate.clone().add(index, 'days') : null;
                const formattedDay = calculatedDay && calculatedDay.isValid() ? calculatedDay.format('YYYY-MM-DD') : null;
                const durationValue = parseInt(hours[index], 10);
                const finalDuration = isNaN(durationValue) ? 0 : durationValue;

                return {
                    day: formattedDay,
                    duration: finalDuration,
                    slot: "Null", // Assuming this is always "Null" as per your backend
                    Duration_Uint: "min", // As per your backend schema and previous discussions
                    Responsibility: personResponsible, // Person responsible from form state
                };
            });

            const scheduledData = {
                Key: task.Key,
                Task_Details: values.name,
                Planned_Start_Timestamp: plannedStartTimestamp,
                Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
                Responsibility: personResponsible, // Main task responsibility
                sliders: slidersData,
                Total_Time: totalTime,
                // Add other task fields if they are part of your main task update/insert
                // from the form or derived values.
                // Example: DelCode_w_o__: task.DelCode_w_o__ || '',
                // Step_ID: task.Step_ID || 0, etc.
            };

            fetch(`${BACKEND_API_BASE_URL}/api/post`, {
                method: 'POST', // Or PUT if you have a specific PUT for updates
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
                    onSubmit && onSubmit({
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
                    console.error("Submission Error:", error);
                });
        }).catch((info) => {
            console.log('Validate Failed:', info);
            notification.error({
                message: 'Validation Error',
                description: 'Please fill in all required fields correctly.',
            });
        });
    };

    if (!isDataLoaded) return <div>Loading task details...</div>;

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
                    <Form.Item name="startDate" label="Start Date">
                        <DatePicker
                            format="YYYY-MM-DD"
                            onChange={handleStartDateChange}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item name="numberOfDays" label="Number of Days">
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
                const dayDate = currentStartDate && currentStartDate.isValid() ? currentStartDate.clone().add(index, 'days') : null;
                const formattedDate = dayDate && dayDate.isValid() ? dayDate.format('YYYY-MM-DD') : 'Invalid Date';
                const totalScheduledForDay = existingSchedules[personResponsible]?.[formattedDate] || 0;
                const availableHours = 480 - totalScheduledForDay; // Max 8 hours (480 mins) - already scheduled

                return (
                    <Form.Item key={index} label={`Day ${index + 1} (${formattedDate})`}>
                        <Row gutter={20}>
                            <Col xs={20}>
                                <Slider
                                    min={0}
                                    max={480} // Max possible for one day
                                    value={hours[index] || 0}
                                    onChange={value => handleSliderChange(index, value)}
                                    marks={{ 0: '0', 240: '4h', 480: '8h' }}
                                    tooltip={{ formatter: val => `${val} min` }}
                                />
                            </Col>
                            <Col xs={4}>
                                <Input
                                    type="number"
                                    min={0}
                                    max={480} // Max possible for one day
                                    value={hours[index] || 0}
                                    onChange={e => handleInputChange(index, e.target.value)}
                                    addonAfter="min"
                                />
                            </Col>
                        </Row>
                        {totalScheduledForDay > 0 && (
                            <div style={{ color: 'blue', fontSize: '0.8em', marginTop: '5px' }}>
                                (Already scheduled: {totalScheduledForDay} min, Available: {availableHours} min)
                            </div>
                        )}
                    </Form.Item>
                );
            })}

            <Form.Item label="Person Responsible">
                <Input
                    value={personResponsible}
                    onChange={e => setPersonResponsible(e.target.value)}
                    placeholder="Enter responsible person"
                />
            </Form.Item>

            <Form.Item>
                <Button type="primary" htmlType="submit">
                    Submit
                </Button>
            </Form.Item>
        </Form>
    );
};

export default FormComponent;
