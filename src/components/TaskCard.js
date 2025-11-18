import React from 'react';
import { Card, Button } from 'react-bootstrap'; 
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

    const showNotRequired = isAdmin;
    // Removed the logic for dynamic class names

    // Extract planned start timestamp robustly
    const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
        ? task.Planned_Start_Timestamp.value
        : task.Planned_Start_Timestamp;

    return (
        <div>
            <Card
                className={''} 
                style={{}} 
                onClick={() => onCardClick(task.Key, displayStatus)} 
            >
                <Card.Body>
                    <Card.Title>{task.Task_Details}</Card.Title>
                    <Card.Text>
                        <strong>Step ID:</strong> {task.Step_ID}<br />
                        <strong>Responsibility:</strong> {task.Responsibility}<br />
                        <strong>Status:</strong> {displayStatus}
                    </Card.Text>
                    
                    {/* --- Metadata Section --- */}
                    <div>
                        {rawPlannedStartTimestamp && (
                            <p>
                                <FaCalendarAlt />
                                Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                            </p>
                        )}
                    </div>
                    
                    {/* Status Buttons displayed ONLY when task is SCHEDULED and NOT Finished */}
                    {isTaskScheduled && !isTaskFinished && (
                        <div onClick={(e) => e.stopPropagation()}>
                            
                            {/* COMPLETE Button */}
                            <Button 
                                variant="success" 
                                className={showNotRequired ? 'me-2' : ''} 
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
                        <div onClick={(e) => e.stopPropagation()}> 
                            <FormComponent
                                onSubmit={onFormSubmit}
                                task={task}
                                currentUserEmail={currentUserEmail}
                            />
                        </div>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
};

export default TaskCard;
