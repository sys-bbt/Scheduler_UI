<<<<<<< HEAD
import React from 'react';
import { Form } from 'react-bootstrap';

const SortDeliveriesByDate = ({ sortOption, setSortOption }) => {
  return (
    <Form.Group controlId="sortDeliveriesByDate" className="mb-3">
      <Form.Label>Sort by Date</Form.Label>
      <Form.Control
        as="select"
        value={sortOption}
        onChange={(e) => setSortOption(e.target.value)}
      >
        <option value="earliest">Earliest Initiated</option>
        <option value="latest">Latest Initiated</option>
      </Form.Control>
    </Form.Group>
  );
};

export default SortDeliveriesByDate;
=======
import React from 'react';
import { Form } from 'react-bootstrap';

const SortDeliveriesByDate = ({ sortOption, setSortOption }) => {
  return (
    <Form.Group controlId="sortDeliveriesByDate" className="mb-3">
      <Form.Label>Sort by Date</Form.Label>
      <Form.Control
        as="select"
        value={sortOption}
        onChange={(e) => setSortOption(e.target.value)}
      >
        <option value="earliest">Earliest Initiated</option>
        <option value="latest">Latest Initiated</option>
      </Form.Control>
    </Form.Group>
  );
};

export default SortDeliveriesByDate;
>>>>>>> 887a083c3cfa83675dbbd621d281faaaef12030a
