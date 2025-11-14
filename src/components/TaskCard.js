import React from 'react';
import { Card, Col, Button } from 'react-bootstrap';
import Dropdown from 'rc-dropdown';
import Menu, { Item as MenuItem } from 'rc-menu';
import { FaPause, FaPlay, FaStop, FaCalendarAlt, FaEllipsisV } from 'react-icons/fa';
import moment from 'moment';
import FormComponent from './FormComponent'; // Import FormComponent here

// Define necessary status constants (or ensure they are passed as props/imported)
const COMPLETED_TASK_STATUS = 'Completed';
const NOT_REQUIRED_TASK_STATUS = 'Not Required';
const SCHEDULED_STATUS = 'Scheduled';

// Helper function for the dropdown menu (Move it here)
const renderMenu = (task, onMenuItemClick) => (
    <Menu>
        {/* Conditional rendering based on task status */}
        {task.Current_Status === 'Running' && (
            <MenuItem key="pause" onClick={(e) => { e.stopPropagation(); onMenuItemClick(task.Key, 'pause'); }}>
                <FaPause style={{ marginRight: '5px' }} /> Pause
            </MenuItem>
        )}
        {task.Current_Status === 'Paused' && (
            <MenuItem key="play" onClick={(e) => { e.stopPropagation(); onMenuItemClick(task.Key, 'play'); }}>
                <FaPlay style={{ marginRight: '5px' }} /> Play
            </MenuItem>
        )}
        {task.Current_Status !== COMPLETED_TASK_STATUS && task.Current_Status !== NOT_REQUIRED_TASK_STATUS && ( 
            <MenuItem key="stop" onClick={(e) => { e.stopPropagation(); onMenuItemClick(task.Key, 'stop'); }}>
                <FaStop style={{ marginRight: '5px' }} /> Stop
            </MenuItem>
        )}
    </Menu>
);

// --- TaskCard Component (The main export) ---
const TaskCard = ({ task, isActive, displayStatus, onCardClick, onMenuItemClick, onFormSubmit, onStatusUpdate, currentUserEmail, isAdmin }) => {
    // ... all the logic and JSX you had for TaskCard ...
    
    // NOTE: Keep the reference to <FormComponent /> inside this JSX!
    // {isActive && ( ... <FormComponent ... /> ... )}

    return (
        <Col>
            {/* ... TaskCard JSX ... */}
            {/* The important part where FormComponent is used: */}
            {isActive && (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}> 
                    <h6>Schedule Task: {task.Task_Details}</h6>
                    <FormComponent
                        onSubmit={onFormSubmit}
                        task={task}
                        currentUserEmail={currentUserEmail}
                    />
                    {/* Status Buttons */}
                </div>
            )}
        </Col>
    );
};

export default TaskCard;
