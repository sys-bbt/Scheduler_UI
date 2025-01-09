import React from 'react';
import { Button } from 'react-bootstrap';


const DeleteButton = ({ deliveryCode, onDelete }) => {
  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete delivery: ${deliveryCode}?`)) {
      try {
        const response = await fetch(`https://server-ui-2.onrender.com/api/data/${encodeURIComponent(deliveryCode)}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete the delivery.');
        }

        const result = await response.json();
        alert(result.message);
        onDelete(deliveryCode); // Callback to update the UI after successful deletion
      } catch (error) {
        console.error('Error deleting delivery:', error);
        alert('An error occurred while trying to delete the delivery.');
      }
    }
  };

  return (
    <Button
      variant="danger"
      size="sm"
      onClick={handleDelete}
      className="delete-button"
    >
      Delete
    </Button>
  );
};

export default DeleteButton;
