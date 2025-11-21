// src/components/TaskCard.js
import React from 'react';
import { Card, Col, Button } from 'react-bootstrap';
// 🟢 ICON IMPORTS
import { FaCalendarAlt, FaCheckCircle, FaTimesCircle } from 'react-icons/fa'; 
import moment from 'moment';
import FormComponent from './FormComponent'; 

// Define necessary status constants
const COMPLETED_TASK_STATUS = 'Completed';
const NOT_REQUIRED_TASK_STATUS = 'Not Required';
const SCHEDULED_STATUS = 'Scheduled';
const AVAILABLE_STATUS = 'Available'; // Assuming tasks that can be scheduled are 'Available'

// --- TaskCard Component Definition ---
const TaskCard = ({ task, isActive, displayStatus, onCardClick, onFormSubmit, onStatusUpdate, currentUserEmail, isAdmin }) => {
     
    // Determine the finished state
    const isTaskFinished = task.Current_Status === COMPLETED_TASK_STATUS || task.Current_Status === NOT_REQUIRED_TASK_STATUS;
    
    // Determine the scheduled state (based on the derived status passed from the parent)
    const isTaskScheduled = displayStatus === SCHEDULED_STATUS;

    // Determine if the card click should open the form
    const isClickable = !isTaskFinished && !isTaskScheduled; 

    // Extract planned start timestamp robustly
    const rawPlannedStartTimestamp = task.Planned_Start_Timestamp && typeof task.Planned_Start_Timestamp === 'object' && task.Planned_Start_Timestamp.value
        ? task.Planned_Start_Timestamp.value
        : task.Planned_Start_Timestamp;

    // --- HANDLERS ---
    const handleCardClick = () => {
        // Only trigger onCardClick if the task is not finished and not already scheduled
        if (isClickable) {
            onCardClick(task.Key, displayStatus);
        }
    };

    const handleStatusUpdate = (e, status) => {
        e.stopPropagation(); // Prevent the card click handler from firing
        if (onStatusUpdate) {
            onStatusUpdate(task.Key, status);
        }
    };


    return (
        <Col>
            <Card
                // Only mark as 'task-scheduled-uneditable' if it is SCHEDULED and NOT FINISHED
                className={`task-card ${isTaskFinished ? 'task-completed' : ''} ${isActive ? 'active-task' : ''} ${isTaskScheduled && !isTaskFinished ? 'task-scheduled-uneditable' : ''}`}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
                onClick={handleCardClick} 
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
                        <div className='d-flex justify-content-between mt-3' onClick={(e) => e.stopPropagation()}>
                            
                            {/* --- ADMIN VIEW: Complete (w-50) and Not Required (w-50) --- */}
                            {isAdmin ? (
                                <>
                                    {/* COMPLETE Button (w-50) */}
                                    <Button 
                                        variant="success" 
                                        className="w-50 me-2 d-flex align-items-center justify-content-center"
                                        title="Mark Complete" 
                                        onClick={(e) => handleStatusUpdate(e, COMPLETED_TASK_STATUS)}
                                    >
                                        <FaCheckCircle size={20} />
                                    </Button>

                                    {/* NOT REQUIRED Button (w-50) */}
                                    <Button 
                                        variant="secondary" 
                                        className="w-50 ms-2 d-flex align-items-center justify-content-center"
                                        title="Mark Not Required (Admin)"
                                        onClick={(e) => handleStatusUpdate(e, NOT_REQUIRED_TASK_STATUS)}
                                    >
                                        <FaTimesCircle size={20} />
                                    </Button>
                                </>
                            ) : (
                                {/* --- NON-ADMIN VIEW: Complete (w-100) only --- */}
                                <Button 
                                    variant="success" 
                                    className="w-100 d-flex align-items-center justify-content-center" 
                                    title="Mark Complete" 
                                    onClick={(e) => handleStatusUpdate(e, COMPLETED_TASK_STATUS)}
                                >
                                    <FaCheckCircle size={20} /> Complete
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
                                // Ensure FormComponent gets the correct isAdmin status
                                isAdmin={isAdmin} 
                            />
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Col>
    );
};

export default TaskCard;
