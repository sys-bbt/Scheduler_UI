import React from 'react';
import { Card, Col, Button } from 'react-bootstrap';
// 🟢 NEW ICON IMPORTS: Add CheckCircle and TimesCircle
import { FaCalendarAlt, FaCheckCircle, FaTimesCircle } from 'react-icons/fa'; 
import moment from 'moment';
import FormComponent from './FormComponent'; 

// Define necessary status constants
const COMPLETED_TASK_STATUS = 'Completed';
const NOT_REQUIRED_TASK_STATUS = 'Not Required';
const SCHEDULED_STATUS = 'Scheduled';

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
                    
                    {/* --- Metadata Section --- */}
                    <div className="d-flex justify-content-between align-items-center mt-3">
                        {rawPlannedStartTimestamp && (
                            <p className="text-muted mb-0">
                                <FaCalendarAlt style={{ marginRight: '5px' }} />
                                Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                            </p>
                        )}
                    </div>
                    
                    {/* Status Buttons displayed ONLY when task is SCHEDULED and NOT Finished */}
                    {isTaskScheduled && !isTaskFinished && (
                        // Use d-flex and space-between to align buttons horizontally
                        <div className='d-flex justify-content-between mt-3' onClick={(e) => e.stopPropagation()}>
                            
                            {/* COMPLETE Button (Now an Icon Button) */}
                            <Button 
                                variant="success" 
                                // Added className for better spacing control if needed
                                className="w-50 me-2 d-flex align-items-center justify-content-center"
                                title="Mark Complete" // Add a title/tooltip for accessibility
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusUpdate(task.Key, 'Complete');
                                }}
                            >
                                <FaCheckCircle size={20} />
                            </Button>

                            {/* NOT REQUIRED Button - Admin only (Now an Icon Button) */}
                            
                                <Button 
                                    variant="secondary" 
                                    className="w-50 ms-2 d-flex align-items-center justify-content-center"
                                    title="Mark Not Required (Admin)"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusUpdate(task.Key, 'Not Required');
                                    }}
                                >
                                    <FaTimesCircle size={20} />
                                </Button>
                           
                        </div>
                    )}

                    {/* Form Rendering */}
                    {isActive && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}> 
                            <h6>Schedule Task: {task.Task_Details}</h6>
                            <FormComponent
                                onSubmit={onFormSubmit}
                                task={task}
                                currentUserEmail={currentUserEmail}
                            />
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Col>
    );
};

export default TaskCard;
