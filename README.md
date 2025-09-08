# DriveSafe - A Real-Time Driver Assistance App

This is a Next.js application built in Firebase Studio that provides a real-time driver assistance dashboard. It uses your device's camera and generative AI to detect lanes and objects, simulating an advanced driver-assistance system (ADAS).

## Getting Started Locally

To run this project on your local machine, follow these steps.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

### 1. Set Up Your Gemini API Key

This project uses Google's Generative AI models via Genkit. You'll need a Gemini API key to run the AI features.

1.  **Get a Gemini API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to create and copy your free API key.
2.  **Create an Environment File**: In the root directory of the project, rename the existing `.env` file to `.env.local`.
3.  **Add Your Key**: Open the new `.env.local` file and add your API key like this:

    ```
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```

    Replace `YOUR_API_KEY_HERE` with the key you copied from Google AI Studio.

### 2. Install Dependencies

Open your terminal, navigate to the project directory, and run the following command to install the necessary packages:

```bash
npm install
```

### 3. Run the Development Servers

This project requires two servers to run at the same time: one for the Next.js frontend and one for the Genkit AI flows. You'll need to open **two separate terminal windows** for this.

**In your first terminal:**

Run the Next.js development server. This will start the user interface.

```bash
npm run dev
```

This will typically start the app on `http://localhost:9002`.

**In your second terminal:**

Run the Genkit development server. This will start the AI backend that the app communicates with.

```bash
npm run genkit:watch
```

This command watches for any changes you make to the AI flow files and reloads them automatically.

### 4. Open the App

Once both servers are running, open your web browser and navigate to **[http://localhost:9002](http://localhost:9002)**. You should see the DriveSafe application live and ready to use!