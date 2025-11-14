import React from 'react';
import { Card, Col, Button } from 'react-bootstrap';
import { FaCalendarAlt } from 'react-icons/fa'; 
import moment from 'moment';
import FormComponent from './FormComponent'; // Import FormComponent

// Define necessary status constants
const COMPLETED_TASK_STATUS = 'Completed';
const NOT_REQUIRED_TASK_STATUS = 'Not Required';
const SCHEDULED_STATUS = 'Scheduled'; // Task has a planned start date but is not yet complete/not required

// --- TaskCard Component Definition ---
const TaskCard = ({ task, isActive, displayStatus, onCardClick, onFormSubmit, onStatusUpdate, currentUserEmail, isAdmin }) => {
    
    // isTaskFinished is used to prevent the buttons from showing up on completed tasks
    const isTaskFinished = task.Current_Status === COMPLETED_TASK_STATUS || task.Current_Status === NOT_REQUIRED_TASK_STATUS;
    
    // isTaskScheduled is used to control card styling and button visibility
    const isTaskScheduled = displayStatus === SCHEDULED_STATUS;

    // Extract planned start timestamp robustly
    const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
        ? task.Planned_Start_Timestamp.value
        : task.Planned_Start_Timestamp;

    return (
        <Col>
            <Card
                className={`task-card ${isTaskFinished ? 'task-completed' : ''} ${isActive ? 'active-task' : ''} ${isTaskScheduled ? 'task-scheduled-uneditable' : ''}`}
                // The cursor changes only if it is NOT a scheduled task, as scheduled tasks cannot be clicked to open the form
                style={{ cursor: isTaskScheduled ? 'default' : 'pointer' }}
                onClick={() => onCardClick(task.Key, displayStatus)} 
            >
                <Card.Body>
                    <Card.Title>{task.Task_Details}</Card.Title>
                    <Card.Text>
                        <strong>Step ID:</strong> {task.Step_ID}<br />
                        <strong>Responsibility:</strong> {task.Responsibility}<br />
                        <strong className={isTaskScheduled ? 'text-info' : ''}>Status:</strong> {displayStatus}
                    </Card.Text>
                    
                    {/* --- Metadata Section --- */}
                    <div className="d-flex justify-content-between align-items-center mt-3">
                        {rawPlannedStartTimestamp && (
                            <p className="text-muted mb-0">
                                <FaCalendarAlt style={{ marginRight: '5px' }} />
                                Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                            </p>
                        )}
                    </div>
                    
                    {/* 🟢 REQUIREMENT 2 & 1: Status Buttons displayed ONLY when task is SCHEDULED and NOT Finished */}
                    {isTaskScheduled && !isTaskFinished && (
                        <div className='d-grid gap-2 mt-3' onClick={(e) => e.stopPropagation()}>
                            {/* COMPLETE Button */}
                            <Button 
                                variant="success" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusUpdate(task.Key, 'Complete');
                                }}
                            >
                                Mark **Complete**
                            </Button>

                            {/* NOT REQUIRED Button - Admin only */}
                            {isAdmin && (
                                <Button 
                                    variant="secondary" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusUpdate(task.Key, 'Not Required');
                                    }}
                                >
                                    Mark **Not Required**
                                </Button>
                            )}
                        </div>
                    )}

                    {/* 🟢 Form Rendering: Only displays when isActive is true (i.e., NOT for scheduled tasks) */}
                    {isActive && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}> 
                            <h6>Schedule Task: {task.Task_Details}</h6>
                            <FormComponent
                                onSubmit={onFormSubmit}
                                task={task}
                                currentUserEmail={currentUserEmail}
                            />
                            {/* NOTE: Status buttons are REMOVED from here */}
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Col>
    );
};

export default TaskCard;
