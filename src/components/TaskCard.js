import React from 'react';
import { Card, Button } from 'react-bootstrap'; // Keep Card and Button since they are fundamental BS components
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

    // --- LOGIC FIX: Determine button widths and visibility ---
    const showNotRequired = isAdmin;
    // Removed 'w-50 me-2' and 'w-100' classes, logic now only affects visibility/structure
    // const completeButtonWidthClass = showNotRequired ? 'w-50 me-2' : 'w-100'; 
    // --------------------------------------------------------

    // Extract planned start timestamp robustly
    const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
        ? task.Planned_Start_Timestamp.value
        : task.Planned_Start_Timestamp;

    return (
        // Replaced Col with a standard div
        <div>
            <Card
                // Removed all CSS classes: task-workflow-card, task-completed, active-task, task-scheduled-uneditable
                className={''} 
                // Removed inline style for cursor
                style={{}} 
                onClick={() => onCardClick(task.Key, displayStatus)} 
            >
                <Card.Body>
                    <Card.Title>{task.Task_Details}</Card.Title>
                    <Card.Text>
                        <strong>Step ID:</strong> {task.Step_ID}<br />
                        <strong>Responsibility:</strong> {task.Responsibility}<br />
                        {/* Removed text-info class */}
                        <strong>Status:</strong> {displayStatus}
                    </Card.Text>
                    
                    {/* --- Metadata Section --- */}
                    {/* Removed d-flex, justify-content-between, align-items-center, mt-3 classes */}
                    <div>
                        {rawPlannedStartTimestamp && (
                            // Removed text-muted and mb-0 classes
                            <p>
                                {/* Removed inline style for margin */}
                                <FaCalendarAlt />
                                Start: {moment.utc(rawPlannedStartTimestamp).format('YYYY-MM-DD')}
                            </p>
                        )}
                    </div>
                    
                    {/* Status Buttons displayed ONLY when task is SCHEDULED and NOT Finished */}
                    {isTaskScheduled && !isTaskFinished && (
                        {/* Replaced styled div with basic div and removed classes */}
                        <div onClick={(e) => e.stopPropagation()}>
                            
                            {/* COMPLETE Button */}
                            <Button 
                                variant="success" 
                                // Removed width and layout classes: completeButtonWidthClass, d-flex, align-items-center, justify-content-center
                                className={showNotRequired ? 'me-2' : ''} // Keep minimal separation for visual distinction if both buttons are shown
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
                                    // Removed width and layout classes: w-50 ms-2, d-flex, align-items-center, justify-content-center
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
                        {/* Removed mt-3 class */}
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
