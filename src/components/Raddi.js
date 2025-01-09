import React, { useState, useEffect, memo } from 'react';
import { Form, Input, Button, Slider, DatePicker, Select, notification, Row, Col } from 'antd';
import moment from 'moment';
import './FormComponent.css';

const { Option } = Select;

const FormComponent = ({ onSubmit, task }) => {
  const [form] = Form.useForm();
  const [sliderCount, setSliderCount] = useState(0);
  const [hours, setHours] = useState({});
  const [startDate, setStartDate] = useState(
    task?.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null
  );
  const [endDate, setEndDate] = useState(
    task?.Planned_Delivery_Timestamp ? moment(task.Planned_Delivery_Timestamp) : null
  );
  const [deliverySlot, setDeliverySlot] = useState(null);
  const [personResponsible, setPersonResponsible] = useState('');
  const [numberOfDays, setNumberOfDays] = useState(0);
  const [existingSchedules, setExistingSchedules] = useState({});

  useEffect(() => {
    const fetchTaskData = async () => {
      try {
        if (task) {
          form.setFieldsValue({ name: task.Task_Details || '' });
          setPersonResponsible(task.Responsibility || '');

          const [perKeyData, perPersonData] = await Promise.all([
            fetch('http://localhost:3001/api/per-key-per-day').then((res) => res.json()),
            fetch('http://localhost:3001/api/per-person-per-day').then((res) => res.json())
          ]);

          handleTaskData(perKeyData, perPersonData);
        }
      } catch (error) {
        console.error('Error fetching task data:', error);
      }
    };

    fetchTaskData();
  }, [task, form]);

  const handleTaskData = (perKeyData, perPersonData) => {
    if (perKeyData?.[task.Key]) {
      const { entries, totalDuration = 0 } = perKeyData[task.Key];
      const hours = Math.floor(totalDuration / 60);
      const minutes = totalDuration % 60;
      setHours({ 0: `${hours}h ${minutes}m` });

      const validDays = entries
        .map((entry) => entry.Day?.value)
        .filter((date) => date);

      if (validDays.length > 0) {
        const start = moment.min(validDays.map((d) => moment(d)));
        const end = moment.max(validDays.map((d) => moment(d)));

        setStartDate(start);
        setEndDate(end);

        const daysDiff = end.diff(start, 'days') + 1;
        setNumberOfDays(daysDiff);
      }
    }

    const schedules = {};
    perPersonData.forEach(({ Responsibility, Day, Duration_In_Minutes }) => {
      const date = Day.value;
      if (!schedules[Responsibility]) schedules[Responsibility] = {};
      schedules[Responsibility][date] = Duration_In_Minutes;
    });

    setExistingSchedules(schedules);
  };

  const handleStartDateChange = (e) => {
    const inputDate = e.target.value;
    const parsedDate = moment(inputDate, 'YYYY-MM-DD', true);

    if (parsedDate.isValid()) {
      setStartDate(parsedDate);
      if (numberOfDays) calculateEndDate(parsedDate, numberOfDays);
    } else {
      console.error('Invalid date format. Please use YYYY-MM-DD.');
    }
  };

  const handleNumberOfDaysChange = (days) => {
    const numericDays = parseInt(days, 10) || 0;
    setNumberOfDays(numericDays);
    if (startDate && numericDays) calculateEndDate(startDate, numericDays);
  };

  const calculateEndDate = (start, days) => {
    if (start && days) {
      const calculatedEndDate = moment(start).add(days - 1, 'days');
      setEndDate(calculatedEndDate);
      setSliderCount(days);
    } else {
      setEndDate(null);
      setSliderCount(0);
    }
  };

  const handleSliderChange = (index, value) => {
    const currentDay = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
    const maxAllowedMinutes = 480; // 8 hours in minutes

    if (existingSchedules[personResponsible]?.[currentDay]) {
      const alreadyScheduledMinutes = existingSchedules[personResponsible][currentDay];
      value = Math.min(value, maxAllowedMinutes - alreadyScheduledMinutes);
    }

    setHours((prev) => ({ ...prev, [index]: value }));
  };

  const handleInputChange = (index, value) => {
    let numericValue = parseInt(value, 10) || 0;
    numericValue = Math.max(1, numericValue); // Minimum value is 1 minute
    handleSliderChange(index, numericValue);
  };

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        const slidersData = Array.from({ length: sliderCount }).map((_, index) => {
          const day = moment(startDate).add(index, 'days').format('YYYY-MM-DD');
          return { day, duration: hours[index] || 0 };
        });

        const scheduledData = {
          ...task,
          Planned_Start_Timestamp: startDate?.toISOString(),
          Planned_Delivery_Timestamp: endDate?.toISOString(),
          sliders: slidersData,
        };

        console.log('Scheduled Data:', scheduledData);

        fetch('http://localhost:3001/api/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduledData),
        })
          .then((res) => {
            if (!res.ok) throw new Error('Network error');
            return res.json();
          })
          .then(() => {
            notification.success({
              message: 'Task Updated',
              description: 'Task updated successfully!',
            });
            onSubmit();
          })
          .catch((err) => {
            notification.error({
              message: 'Error',
              description: err.message || 'An error occurred.',
            });
          });
      })
      .catch(() => {
        notification.error({
          message: 'Validation Error',
          description: 'Please complete all required fields.',
        });
      });
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

      {/* Start Date, Number of Days, End Date */}
      <Row gutter={[8, 16]}>
        <Col xs={24} sm={8}>
          <Form.Item label="Start Date">
            <Input
              type="date"
              value={startDate ? startDate.format('YYYY-MM-DD') : ''}
              onChange={handleStartDateChange}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Number of Days">
            <Input
              type="number"
              value={numberOfDays}
              min={1}
              onChange={(e) => handleNumberOfDaysChange(e.target.value)}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="End Date">
            <DatePicker value={endDate} disabled />
          </Form.Item>
        </Col>
      </Row>

      {/* Sliders */}
      {Array.from({ length: sliderCount }).map((_, index) => (
        <Form.Item key={index} label={`Hours for Day ${index + 1}`}>
          <Row gutter={20}>
            <Col xs={20}>
              <Slider
                min={1}
                max={480}
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
              />
            </Col>
          </Row>
        </Form.Item>
      ))}

      <Form.Item
        name="deliverySlot"
        label="Delivery Slot"
        rules={[{ required: true, message: 'Please select a delivery slot!' }]}
      >
        <Select value={deliverySlot} onChange={setDeliverySlot}>
          <Option value="1pm">1pm</Option>
          <Option value="4pm">4pm</Option>
          <Option value="7pm">7pm</Option>
        </Select>
      </Form.Item>

      <Button type="primary" onClick={handleSubmit}>
        Submit
      </Button>
    </Form>
  );
};

export default memo(FormComponent);
