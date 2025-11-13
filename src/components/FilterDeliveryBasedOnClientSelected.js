import React from 'react';
import { Dropdown } from 'react-bootstrap';

// FIX: Renamed props to match DeliveryList.js and added default empty array to allClients to prevent runtime error
const FilterDeliveryBasedOnClientSelected = ({ allClients = [], handleClientSelect, selectedClient }) => {
  return (
    <div>
      <Dropdown>
        <Dropdown.Toggle variant="success" id="dropdown-client">
          {selectedClient || 'Filter by Client'}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {/* FIX: Changed handler name to handleClientSelect */}
          <Dropdown.Item onClick={() => handleClientSelect('')}>All Clients</Dropdown.Item>
          {/* FIX: Now safely mapping over allClients */}
          {allClients.map((client, index) => (
            <Dropdown.Item key={index} onClick={() => handleClientSelect(client)}>
              {client}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

export default FilterDeliveryBasedOnClientSelected;
