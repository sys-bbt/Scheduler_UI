import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Slider, DatePicker, notification, Row, Col } from 'antd';
import moment from 'moment';

const BACKEND_API_BASE_URL = 'https://server-ui-2.onrender.com';

const FormComponent = ({ onSubmit, task }) => {
  const [form] = Form.useForm();
  const [sliderCount, setSliderCount] = useState(0);
  const [hours, setHours] = useState({});
  const [startDate, setStartDate] = useState(() =>
    task?.Planned_Start_Timestamp ? moment(task.Planned_Start_Timestamp) : null
  );
  const [endDate, setEndDate] = useState(() =>
    task?.Planned_Delivery_Timestamp ? moment(task.Planned_Delivery_Timestamp) : null
  );
  const [personResponsible, setPersonResponsible] = useState('');
  const [numberOfDays, setNumberOfDays] = useState(0);
  const [existingSchedules, setExistingSchedules] = useState({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Fetch task data and initialize state
  useEffect(() => {
    const fetchTaskData = async () => {
      try {
        if (task) {
          form.setFieldsValue({ name: task.Task_Details || '' });
          setPersonResponsible(task.Responsibility || '');

          // Fetch per-key-per-day
          const response = await fetch(`${BACKEND_API_BASE_URL}/api/per-key-per-day`);
          const data = await response.json();
          const taskData = data[task.Key];

          if (taskData) {
            const taskEntries = taskData.entries;
            const newHours = {};

            // Per-day durations
            taskEntries.forEach((entry) => {
              const dayMoment = moment(entry.Day.value);
              if (dayMoment.isValid() && task.Planned_Start_Timestamp) {
                const base = moment(task.Planned_Start_Timestamp);
                const dayIndex = dayMoment.diff(base, 'days');
                newHours[dayIndex] = entry.Duration;
              }
            });

            setHours(newHours);

            // Calculate start/end dates and number of days
            const validDays = taskEntries
              .map((entry) => entry.Day?.value)
              .filter(Boolean);
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

          // Fetch per-person-per-day
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
        setIsDataLoaded(true);
      } catch (error) {
        notification.error({
          message: 'Error',
          description: `Failed to load data: ${error.message}.`,
        });
        setIsDataLoaded(true);
      }
    };

    fetchTaskData();
    // eslint-disable-next-line
  }, [task]);

  // Handlers
  const handleStartDateChange = (date) => {
    setStartDate(date);
    setHours({});
    if (numberOfDays) calculateEndDate(date, numberOfDays);
  };

  const handleNumberOfDaysChange = (e) => {
    const numericDays = parseInt(e.target.value, 10) || 0;
    setNumberOfDays(numericDays);
    setHours({});
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

      const scheduledData = {
        Key: task.Key,
        Task_Details: values.name,
        Planned_Start_Timestamp: plannedStartTimestamp,
        Planned_Delivery_Timestamp: plannedDeliveryTimestamp,
        Responsibility: personResponsible,
        sliders: slidersData,
        Total_Time: totalTime,
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
        });
    }).catch(() => {
      notification.error({
        message: 'Error',
        description: 'Please fill in all required fields correctly.',
      });
    });
  };

  if (!isDataLoaded) return <div>Loading...</div>;

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

      {/* Per-day sliders */}
      {startDate && numberOfDays > 0 && sliderCount > 0 && Array.from({ length: sliderCount }).map((_, index) => {
        const dayDate = moment(startDate).add(index, 'days');
        const formattedDate = dayDate.format('YYYY-MM-DD');
        return (
          <Form.Item key={index} label={`Day ${index + 1} (${formattedDate})`}>
            <Row gutter={20}>
              <Col xs={20}>
                <Slider
                  min={0}
                  max={480}
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
                  max={480}
                  value={hours[index] || 0}
                  onChange={e => handleInputChange(index, e.target.value)}
                  addonAfter="min"
                />
              </Col>
            </Row>
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
        <Button type="primary" htmlType="submit" onClick={handleSubmit}>
          Submit
        </Button>
      </Form.Item>
    </Form>
  );
};

export default FormComponent;
