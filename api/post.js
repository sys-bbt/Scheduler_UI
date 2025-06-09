// your-project-root/api/post.js
import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client
// It automatically picks up GOOGLE_APPLICATION_CREDENTIALS_JSON from environment variables
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID, // Should be 'stellar-acre-407408'
});

const datasetId = process.env.BIGQUERY_DATASET_ID; // Should be 'Scheduler_UI'
const tableId = process.env.BIGQUERY_TABLE_ID;     // Should be 'Per_Key_Per_Day'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const scheduledData = req.body; // Data sent from your React form

      // Log the incoming data for debugging in Vercel logs
      console.log('Received scheduledData (full payload):', JSON.stringify(scheduledData, null, 2));

      // --- CRITICAL STEP: Map the incoming data to your BigQuery table schema ---
      // Your BigQuery table 'Per_Key_Per_Day' has these 5 columns,
      // with exact casing and spaces as per your screenshot:
      // Key, Day, Duration, Duration Unit, Planned delivery slot

      const rowsToInsert = scheduledData.sliders.map(sliderEntry => {
        return {
          Key: scheduledData.Key,           // STRING: Fetches the key of the Form
          Day: sliderEntry.day,             // DATE: Date (YYYY-MM-DD) from startDate + index
          Duration: sliderEntry.duration,   // INTEGER: The values from sliders (minutes)
          "Duration Unit": "min",           // STRING: Static value "min" - EXACTLY MATCHES "Duration Unit"
          "Planned delivery slot": sliderEntry.slot, // STRING: The slot (e.g., '1pm', '4pm', '7pm', 'Null') - EXACTLY MATCHES "Planned delivery slot"
        };
      });

      // --- Validate if rowsToInsert is not empty ---
      if (rowsToInsert.length === 0) {
        console.warn('No slider data to insert into BigQuery (empty sliders array). Skipping insertion.');
        return res.status(200).json({
          message: 'Task updated successfully, but no daily schedule data was available for insertion.',
          dataReceived: scheduledData,
        });
      }

      console.log('Prepared rows for BigQuery insertion:', JSON.stringify(rowsToInsert, null, 2));

      // Perform the BigQuery insertion
      await bigquery
        .dataset(datasetId)
        .table(tableId)
        .insert(rowsToInsert);

      console.log(`Successfully inserted ${rowsToInsert.length} rows into BigQuery table: ${datasetId}.${tableId}`);

      // Send a success response back to your React frontend
      res.status(200).json({
        message: 'Task successfully updated and daily schedule data saved to BigQuery!',
        dataInserted: rowsToInsert, // Echo back the data that was inserted
      });

    } catch (error) {
      console.error('Error processing POST request or inserting into BigQuery:', error);

      // Log BigQuery specific errors if available for better debugging
      // These errors will often point to schema mismatches or data type issues
      if (error.errors && Array.isArray(error.errors)) {
        error.errors.forEach((errDetail, i) => {
          console.error(`BigQuery insert error ${i + 1}:`, JSON.stringify(errDetail, null, 2));
        });
      } else if (error.response && error.response.insertErrors) {
         console.error('BigQuery API response errors:', JSON.stringify(error.response.insertErrors, null, 2));
      }

      res.status(500).json({
        message: 'Internal Server Error: Failed to save task data to BigQuery.',
        error: error.message,
        bigQueryDetails: error.errors || error.response?.insertErrors || 'No specific BigQuery error details available',
      });
    }
  } else {
    // Handle methods other than POST
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
