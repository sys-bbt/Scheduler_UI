// your-project-root/api/post.js
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const datasetId = process.env.BIGQUERY_DATASET_ID;
const tableId = process.env.BIGQUERY_TABLE_ID;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const scheduledData = req.body;

      console.log('Received scheduledData (full payload):', JSON.stringify(scheduledData, null, 2));

      const rowsToInsert = scheduledData.sliders.map(sliderEntry => {
        return {
          Key: scheduledData.Key,
          Day: sliderEntry.day,
          Duration: sliderEntry.duration,
          "Duration Unit": "min",
          "Planned delivery slot": sliderEntry.slot,
        };
      });

      if (rowsToInsert.length === 0) {
        console.warn('No slider data to insert into BigQuery (empty sliders array). Skipping insertion.');
        return res.status(200).json({
          message: 'Task updated successfully, but no daily schedule data was available for insertion.',
          dataReceived: scheduledData,
        });
      }

      console.log('Prepared rows for BigQuery insertion:', JSON.stringify(rowsToInsert, null, 2));

      // --- ADDED: Specific try-catch for BigQuery insertion ---
      try {
        await bigquery
          .dataset(datasetId)
          .table(tableId)
          .insert(rowsToInsert);

        console.log(`Successfully inserted ${rowsToInsert.length} rows into BigQuery table: ${datasetId}.${tableId}`);

        res.status(200).json({
          message: 'Task successfully updated and daily schedule data saved to BigQuery!',
          dataInserted: rowsToInsert,
        });

      } catch (bigQueryError) {
        // Log the BigQuery specific error in detail
        console.error('ERROR: BigQuery Insertion Failed!');
        console.error('Error Message:', bigQueryError.message);
        console.error('Error Code:', bigQueryError.code); // BigQuery error code if available
        console.error('Errors array:', JSON.stringify(bigQueryError.errors, null, 2)); // Detailed BigQuery error info
        console.error('Partial success/response:', JSON.stringify(bigQueryError.response, null, 2)); // Any partial success or API response

        // Re-throw or handle as necessary for the outer catch block to pick it up
        throw bigQueryError; // This will send it to the outer catch block
      }

    } catch (outerError) {
      console.error('An unhandled error occurred during POST request processing:', outerError);
      res.status(500).json({
        message: 'Internal Server Error: Failed to save task data to BigQuery.',
        error: outerError.message,
        bigQueryDetails: outerError.errors || outerError.response?.insertErrors || 'No specific BigQuery error details available',
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
