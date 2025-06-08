export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const scheduledData = req.body; // Data sent from your React form

      // --- YOUR BACKEND LOGIC GOES HERE ---
      // This is where you would typically:
      // 1. Validate the `scheduledData`.
      // 2. Connect to a database (e.g., MongoDB, PostgreSQL, etc.) and save the data.
      //    You will need to install appropriate database drivers and configure connection strings.
      // 3. Perform any other necessary server-side operations (e.g., send emails).

      console.log('Received scheduledData:', scheduledData); // Log for Vercel logs

      // Send a success response back to your React frontend
      res.status(200).json({
        message: 'Task successfully scheduled/updated!',
        dataReceived: scheduledData // Optional: echo data back for debugging
      });

    } catch (error) {
      console.error('Error processing POST request:', error);
      res.status(500).json({
        message: 'Internal Server Error',
        error: error.message
      });
    }
  } else {
    // Handle methods other than POST
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
