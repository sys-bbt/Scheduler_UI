import React, { useState, useEffect, memo } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

// Added onScheduleSuccess prop to receive the callback from parent
const FormComponent = ({ task, onScheduleSuccess, userEmail }) => { // Removed onSubmit as it's now internal
    const [form] = Form.useForm();
    const [sliderCount, setSliderCount] = useState(0); // This should probably be derived from totalTime/formattedDuration
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

    const [deliverySlot, setDeliverySlot] = useState(null);
    const [personResponsible, setPersonResponsible] = useState(userEmail || '');
    const [numberOfDays, setNumberOfDays] = useState(0); // This state also needs to be controlled
    const [existingSchedules, setExistingSchedules] = useState({});
    const [submitting, setSubmitting] = useState(false); // New state for submission status


    useEffect(() => {
        const fetchTaskData = async () => {
            try {
                if (task) {
                    form.setFieldsValue({
                        name: task.Task_Details || '',
                        personResponsible: task.Responsibility || userEmail || '', // Set initial value for Ant Design Form.Item
                    });
                    // Set responsibility from task if available, otherwise use userEmail
                    setPersonResponsible(task.Responsibility || userEmail || '');

                    // Update form fields if task data is available
                    setStartDate(task.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null);
                    setEndDate(task.Planned_Delivery_Timestamp ? moment(task.Planned_Delivery_Timestamp) : null);
                    setDeliverySlot(task.Delivery_Slot || null);

                    // If task has a formattedDuration (e.g., "3h 30m"), convert it to minutes for sliders if needed
                    if (task.formattedDuration) {
                        const [h, m] = task.formattedDuration.split(/[hm]/).map(Number).filter(Boolean);
                        const totalMinutes = (h * 60 || 0) + (m || 0);
                        // How you distribute this `totalMinutes` across days/sliders depends on your logic.
                        // For now, let's just set the first slider to this value for demonstration.
                        setHours({ 0: totalMinutes });
                        setSliderCount(1); // Assuming 1 slider if duration is present
                        setNumberOfDays(1); // Assuming 1 day if duration is present
                    } else {
                        setSliderCount(0);
                        setHours({});
                        setNumberOfDays(0);
                    }


                    // Fetch data per key per day (assuming this is for validation/display)
                    // Consider if this fetch is needed or if parent provides all necessary context
                    const response = await fetch(`https://server-ui-2.onrender.com/api/per-key-per-day`); // Adjust URL if needed
                    if (!response.ok) {
                        throw new Error(`Failed to fetch per-key-per-day data: ${response.statusText}`);
                    }
                    const data = await response.json();
                    setExistingSchedules(data); // Set existing schedules for validation
                }
            } catch (error) {
                notification.error({
                    message: 'Error',
                    description: `Failed to fetch task data for form: ${error.message}`,
                });
                console.error("Error fetching task data for form:", error);
            }
        };

        fetchTaskData();
    }, [task, form, userEmail]);


    const handleSliderChange = (index, value) => {
        setHours(prev => ({ ...prev, [index]: value }));
    };

    const handleInputChange = (index, value) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 480) { // Assuming max minutes
            setHours(prev => ({ ...prev, [index]: numValue }));
        }
    };


    const handleSubmit = async () => {
        try {
            setSubmitting(true); // Disable button
            const values = await form.validateFields(); // Validate Ant Design form fields

            // Prepare data for BigQuery update
            const updatedTaskData = {
                Key: task.Key, // Crucial: use the task's Key for identification
                Planned_Start_Timestamp: startDate ? startDate.format('YYYY-MM-DD HH:mm:ss') : null,
                Planned_Delivery_Timestamp: endDate ? endDate.format('YYYY-MM-DD HH:mm:ss') : null,
                Delivery_Slot: deliverySlot,
                Responsibility: personResponsible,
                Hours_Per_Day: hours, // This format might need to be adjusted based on your backend BigQuery schema
                Latest_Status: "Scheduled", // Explicitly set status to Scheduled
                // Add any other fields from your form that need to be updated in BigQuery
            };

            console.log('Submitting updated task data to BigQuery:', updatedTaskData);

            // Send data to your backend API (which then updates BigQuery)
            // Ensure this endpoint correctly updates the task by its 'Key'
            const response = await fetch(`https://server-ui-2.onrender.com/api/update-task`, { // Example URL
                method: 'POST', // Or 'PUT' if it's an update operation
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${yourAuthToken}`, // If you have auth
                },
                body: JSON.stringify(updatedTaskData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update task in BigQuery.');
            }

            notification.success({
                message: 'Success',
                description: 'Task scheduled successfully!',
            });

            // IMPORTANT: Call the callback to refresh the parent component's view
            if (onScheduleSuccess) {
                onScheduleSuccess();
            }

            // Optional: Reset form fields after successful submission if needed
            form.resetFields();
            setStartDate(null);
            setEndDate(null);
            setDeliverySlot(null);
            setPersonResponsible(userEmail || ''); // Reset to user email or empty
            setSliderCount(0);
            setHours({});
            setNumberOfDays(0);

        } catch (error) {
            console.error('Form submission error:', error);
            if (error.errorFields) {
                // Ant Design validation errors
                notification.error({
                    message: 'Validation Error',
                    description: 'Please fill in all required fields.',
                });
            } else {
                // API/network errors
                notification.error({
                    message: 'Error',
                    description: error.message || 'An error occurred during scheduling.',
                });
            }
        } finally {
            setSubmitting(false); // Enable button
        }
    };


    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit} // Use onFinish for Ant Design Form submission
        >
            <Form.Item label="Task Name">
                <Input value={task?.Task_Details || ''} disabled />
            </Form.Item>

            <Row gutter={20}>
                <Col xs={24} sm={12}>
                    <Form.Item
                        name="startDate"
                        label="Planned Start Date"
                        rules={[{ required: true, message: 'Please select a start date!' }]}
                    >
                        <DatePicker
                            value={startDate}
                            onChange={setStartDate}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                    <Form.Item
                        name="endDate"
                        label="Planned End Date"
                        rules={[{ required: true, message: 'Please select an end date!' }]}
                    >
                        <DatePicker
                            value={endDate}
                            onChange={setEndDate}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Form.Item
                name="deliverySlot"
                label="Delivery Slot"
                rules={[{ required: true, message: 'Please select a delivery slot!' }]}
            >
                <Select
                    placeholder="Select a delivery slot"
                    onChange={setDeliverySlot}
                    value={deliverySlot}
                >
                    <Option value="1pm">1pm</Option>
                    <Option value="4pm">4pm</Option>
                    <Option value="7pm">7pm</Option>
                </Select>
            </Form.Item>
            <Form.Item
                name="personResponsible" // Important: give it a name for Ant Design to handle it
                label="Person Responsible"
                rules={[{ required: true, message: 'Please input the person responsible!' }]}
            >
                <Input
                    value={personResponsible}
                    onChange={(e) => setPersonResponsible(e.target.value)}
                />
            </Form.Item>

            {/* Sliders will go here if they are part of this form */}
            {/* The `numberOfDays` state needs to be properly set based on your logic (e.g., difference between start and end date) */}
            {/* For demonstration, I've initialized it to 0, and a basic value from task.formattedDuration */}
            {Array.from({ length: numberOfDays }).map((_, index) => (
                <Form.Item key={index} label={`Hours for Day ${index + 1}`}>
                    <Row gutter={20}>
                        <Col xs={20}>
                            <Slider
                                min={1}
                                max={480} // Max 8 hours * 60 minutes
                                step={1}
                                marks={{ 1: '1m', 480: '8h' }}
                                value={hours[index] || 0}
                                onChange={(value) => handleSliderChange(index, value)}
                            />
                        </Col>
                        <Col xs={4}>
                            <Input
                                type="number"
                                value={hours[index] || 0}
                                onChange={(e) => handleInputChange(index, e.target.value)}
                                addonAfter="min"
                            />
                        </Col>
                    </Row>
                </Form.Item>
            ))}

            <Form.Item>
                <Button type="primary" htmlType="submit" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit'}
                </Button>
            </Form.Item>
        </Form>
    );
};

export default memo(FormComponent);
