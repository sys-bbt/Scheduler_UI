import React from 'react';
import { Dropdown } from 'react-bootstrap';

const FilterDeliveryBasedOnClientSelected = ({ clients, onClientSelect, selectedClient }) => {
  return (
    <div>
      <Dropdown>
        <Dropdown.Toggle variant="success" id="dropdown-client">
          {selectedClient || 'Filter by Client'}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => onClientSelect('')}>All Clients</Dropdown.Item>
          {clients.map((client, index) => (
            <Dropdown.Item key={index} onClick={() => onClientSelect(client)}>
              {client}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

export default FilterDeliveryBasedOnClientSelected;
