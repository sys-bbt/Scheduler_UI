import React from 'react';
import { Card, Col, Button } from 'react-bootstrap';
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

    // --- LOGIC: Determine button widths and visibility ---
    const showNotRequired = isAdmin;
    const completeButtonWidthClass = showNotRequired ? 'w-50 me-2' : 'w-100';
    // --------------------------------------------------------

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
                <Card.Body className="text-start"> {/* FIX: Apply text-start here */}
                    <Card.Title className="text-start">{task.Task_Details}</Card.Title> {/* FIX: Apply to Title */}
                    <Card.Text className="text-start"> {/* FIX: Apply to Details text block */}
                        <strong>Step ID:</strong> {task.Step_ID}<br />
                            <strong>Responsibility:</strong> {task.Responsibility}<br />
                        <strong className={isTaskScheduled ? 'text-info' : ''}>Status:</strong> {displayStatus}
                    </Card.Text>
                    
                    {/* --- Metadata Section --- */}
                    <div className="d-flex justify-content-start align-items-center mt-3">
                        {rawPlannedStartTimestamp && (
                            <p className="text-muted mb-0">
                                <FaCalendarAlt style={{ marginRight: '5px' }} />
                                Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                            </p>
                        )}
                    </div>
                    
                    {/* Status Buttons displayed ONLY when task is SCHEDULED and NOT Finished */}
                    {isTaskScheduled && !isTaskFinished && (
                        {/* Restored d-flex, justify-content-between, mt-3 for button layout */}
                        <div className='d-flex justify-content-between mt-3' onClick={(e) => e.stopPropagation()}>
                            
                            {/* COMPLETE Button (Restored dynamic width and alignment classes) */}
                            <Button 
                                variant="success" 
                                className={`${completeButtonWidthClass} d-flex align-items-center justify-content-center`}
                                title="Mark Complete" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStatusUpdate(task.Key, 'Complete');
                                }}
                            >
                                <FaCheckCircle size={20} />
                            </Button>

                            {/* NOT REQUIRED Button - Admin only */}
                            {showNotRequired && (
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
                            )}
                        </div>
                    )}

                    {/* Form Rendering */}
                    {isActive && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}> 
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
