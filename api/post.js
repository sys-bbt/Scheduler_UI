// pages/api/post.js (or app/api/post/route.js if using App Router in Next.js)

import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client
// This uses environment variables for credentials.
// Make sure these are set up correctly on Vercel.
// The private_key might need .replace(/\\n/g, '\n') if it's stored as a single line string.
const bigquery = new BigQuery({
  // FIX: Correctly access the project ID from environment variables
  // Make sure BIGQUERY_PROJECT_ID is set in your Vercel Environment Variables!
  projectId: process.env.BIGQUERY_PROJECT_ID,
  credentials: {
    client_email: process.env.BIGQUERY_CLIENT_EMAIL,
    private_key: process.env.BIGQUERY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    let scheduledData; // Declare outside try block for wider scope to allow logging in catch

    try {
      scheduledData = req.body;
      console.log('Received scheduledData from frontend:', JSON.stringify(scheduledData, null, 2));

      // --- Define your BigQuery Dataset and Table IDs ---
      const datasetId = 'Scheduler_UI';      // Make sure this is your exact BigQuery Dataset ID
      const tableId = 'Per_Key_Per_Day';     // Make sure this is your exact BigQuery Table ID
      const projectId = process.env.BIGQUERY_PROJECT_ID; // Use the same Project ID from env

      // --- Transform the data to match BigQuery schema ---
      // For each entry in `scheduledData.sliders`, create a new row for BigQuery
      const bigQueryRows = scheduledData.sliders.map(slider => {
          const duration = parseInt(slider.duration, 10); // Ensure duration is an integer

          // Basic validation for critical fields in each slider entry
          if (!slider.day || isNaN(duration) || !scheduledData.Key || !slider.slot) {
              console.warn('Skipping a malformed slider entry due to missing/invalid data:', {
                  key: scheduledData.Key,
                  day: slider.day,
                  duration: slider.duration,
                  slot: slider.slot
              });
              return null; // Return null for invalid entries, filter them out later
          }

          return {
              // Map scheduledData properties to BigQuery column names (case-sensitive!)
              Key: scheduledData.Key,
              Day: slider.day,                   // e.g., "2025-06-10". BigQuery DATE type handles this string.
              Duration: duration,                // e.g., 240 (minutes). BigQuery INTEGER type handles this.
              Duration_Unit: "min",              // Static string as required. BigQuery STRING type.
              Planned_Delivery_Slot: slider.slot // e.g., "1pm". BigQuery STRING type.
          };
      }).filter(row => row !== null); // Remove any null entries resulting from validation failures

      if (bigQueryRows.length === 0) {
        console.warn('No valid rows to insert into BigQuery after transformation.');
        // Still send a success if no rows were expected or it's a valid empty submission
        return res.status(200).json({ message: 'No valid data to insert into BigQuery.' });
      }

      console.log('Transformed rows ready for BigQuery insertion:', JSON.stringify(bigQueryRows, null, 2));

      // --- Attempt to insert rows into BigQuery ---
      console.log(`Attempting BigQuery insert into ${projectId}.${datasetId}.${tableId}...`);
      await bigquery.dataset(datasetId).table(tableId).insert(bigQueryRows);
      console.log(`Successfully inserted ${bigQueryRows.length} rows into BigQuery table: ${datasetId}.${tableId}`);

      // If everything above was successful, send a 200 OK
      res.status(200).json({ message: 'Task updated successfully and data inserted into BigQuery.' });

    } catch (error) {
      // --- CRUCIAL: Log detailed errors for BigQuery failures ---
      console.error('An error occurred in /api/post handler:', error);

      // Log specific BigQuery insert errors if available
      if (error.response && error.response.insertErrors) {
        console.error('BigQuery specific insert errors details:');
        error.response.insertErrors.forEach((insertError, index) => {
          console.error(`  Row ${index} had errors:`);
          insertError.errors.forEach(e => console.error(`    - Reason: ${e.reason}, Message: ${e.message}`));
          console.error('  Raw row that failed:', JSON.stringify(insertError.row, null, 2));
        });
      } else if (error.code && error.errors) { // General Google Cloud error format
        console.error('Google Cloud API Error:', JSON.stringify(error.errors, null, 2));
      }

      // --- IMPORTANT: Send a 500 status code back to the frontend on backend error ---
      // This will ensure your frontend's `!response.ok` check correctly catches the error.
      res.status(500).json({
        message: 'Failed to update task due to a backend error.',
        details: error.message || 'Unknown server error.',
        bigQueryErrorDetails: error.response?.insertErrors ? JSON.stringify(error.response.insertErrors) : null,
        // Potentially include the full error object in dev/debug mode:
        // fullError: process.env.NODE_ENV === 'development' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : undefined
      });
    }
  } else {
    // Handle non-POST requests
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
