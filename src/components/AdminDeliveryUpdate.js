import React, { useState } => 'react';
import { Button, Form, Alert, Spinner, Modal } from 'react-bootstrap';
import { useUser } from './UserContext'; // Get isAdmin status
import moment from 'moment';

const BACKEND_API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Component for Admins to update the master Delivery Deadline for a Delivery Code.
 * @param {string} initialDeliveryCode The delivery code of the workflow being updated.
 * @param {Function} onUpdateSuccess Callback function after a successful update.
 */
const AdminDeliveryUpdate = ({ initialDeliveryCode, onUpdateSuccess }) => {
    const { isAdmin, userEmail } = useUser();
    const [showModal, setShowModal] = useState(false);
    const [newDeadline, setNewDeadline] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Only render the component if the user is an admin
    if (!isAdmin) {
        return null;
    }

    const handleUpdate = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!newDeadline || !initialDeliveryCode) {
            setError("Delivery Code or New Deadline is missing.");
            return;
        }

        setLoading(true);
        
        // Prepare the payload for the backend
        const payload = {
            deliveryCode: initialDeliveryCode,
            newDeadline: moment(newDeadline).toISOString(), // Send as ISO string
            updatedBy: userEmail
        };

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/update-delivery-deadline`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
            }

            const result = await response.json();
            setSuccess(`Deadline for ${initialDeliveryCode} updated successfully!`);
            onUpdateSuccess(result); // Trigger refresh in the parent component
            
        } catch (err) {
            console.error('Error updating deadline:', err);
            setError(`Failed to update deadline: ${err.message}`);
        } finally {
            setLoading(false);
            // Auto-hide success message after 3 seconds
            setTimeout(() => {
                setSuccess(null);
            }, 3000);
        }
    };

    const today = moment().format('YYYY-MM-DD');

    return (
        <>
            <Button 
                variant="warning" 
                size="sm" 
                className="mt-2"
                onClick={() => setShowModal(true)}
            >
                Edit Master Deadline
            </Button>

            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Update Master Delivery Deadline</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {success && <Alert variant="success">{success}</Alert>}

                    <Form onSubmit={handleUpdate}>
                        <Form.Group className="mb-3">
                            <Form.Label>Delivery Code</Form.Label>
                            <Form.Control
                                type="text"
                                value={initialDeliveryCode}
                                disabled
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>New Delivery Deadline</Form.Label>
                            <Form.Control
                                type="date"
                                value={newDeadline}
                                onChange={(e) => setNewDeadline(e.target.value)}
                                min={today}
                                required
                            />
                            <Form.Text className="text-muted">
                                This updates the **master deadline** for all tasks under this code.
                            </Form.Text>
                        </Form.Group>
                        
                        <Button variant="primary" type="submit" disabled={loading}>
                            {loading ? (
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                            ) : (
                                'Submit Update'
                            )}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default AdminDeliveryUpdate;
