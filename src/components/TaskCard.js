import React from 'react';
import { Card, Col, Button } from 'react-bootstrap';
// Removed: import Dropdown from 'rc-dropdown';
// Removed: import Menu, { Item as MenuItem } from 'rc-menu';
import { FaCalendarAlt } from 'react-icons/fa'; 
// Removed: FaPause, FaPlay, FaStop, FaEllipsisV
import moment from 'moment';
import FormComponent from './FormComponent'; // Import FormComponent

// Define necessary status constants
const COMPLETED_TASK_STATUS = 'Completed';
const NOT_REQUIRED_TASK_STATUS = 'Not Required';
const SCHEDULED_STATUS = 'Scheduled';

// ❌ REMOVED: renderMenu helper function

// --- TaskCard Component Definition ---
const TaskCard = ({ task, isActive, displayStatus, onCardClick, onFormSubmit, onStatusUpdate, currentUserEmail, isAdmin }) => {
    
    const isTaskFinished = task.Current_Status === COMPLETED_TASK_STATUS || task.Current_Status === NOT_REQUIRED_TASK_STATUS;
    const isTaskScheduled = displayStatus === SCHEDULED_STATUS;

    // Extract planned start timestamp robustly
    const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
        ? task.Planned_Start_Timestamp.value
        : task.Planned_Start_Timestamp;

    return (
        <Col>
            <Card
                className={`task-card ${isTaskFinished ? 'task-completed' : ''} ${isActive ? 'active-task' : ''} ${isTaskScheduled ? 'task-scheduled-uneditable' : ''}`}
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
                    <div className="d-flex justify-content-between align-items-center mt-3">
                        {rawPlannedStartTimestamp && (
                            <p className="text-muted mb-0">
                                <FaCalendarAlt style={{ marginRight: '5px' }} />
                                Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                            </p>
                        )}
                        {/* ❌ REMOVED: Dropdown component and FaEllipsisV icon */}
                    </div>

                    {/* CONDITIONAL FORM RENDERING: Only displays when isActive is true */}
                    {isActive && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}> 
                            <h6>Schedule Task: {task.Task_Details}</h6>
                            <FormComponent
                                onSubmit={onFormSubmit}
                                task={task}
                                currentUserEmail={currentUserEmail}
                            />
                            
                            {/* Status Buttons: Show only if not finished */}
                            {!isTaskFinished && (
                                <div className='d-grid gap-2 mt-3'>
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
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Col>
    );
};

export default TaskCard;
