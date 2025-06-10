// pages/api/post.js (Example for Next.js Pages Router)
// Or in app/api/post/route.js for App Router:
// import { NextResponse } from 'next/server';
// export async function POST(request) { ... }

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const data = req.body;
      console.log('Received data on API route:', data);

      // --- IMPORTANT: Add your actual logic here ---
      // For example, save `data` to a database
      // await saveToDatabase(data);

      // Respond with success
      res.status(200).json({ message: 'Data received successfully', data: data });

    } catch (error) {
      console.error('Error in API route /api/post:', error);
      // Send a more informative error message back to the client
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  } else {
    // Handle any other HTTP method
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
