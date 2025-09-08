# **App Name**: DriveSafe

## Core Features:

- Lane Departure Detection: Detect lane departures using camera input and OpenCV, triggering alerts when the car drifts outside the lane. Tool to identify which objects to consider and which to discard for calculations
- Obstacle Detection: Detect obstacles using an ultrasonic sensor and YOLOv5/v8 object detection via camera input, triggering real-time alerts if an obstacle is too close. A tool may be useful to ignore non-threatening entities.
- Live Dashboard: Display a live camera feed, sensor readings (distance, tilt, etc.), and alerts (lane drift, obstacle warning) in real-time.
- Hazard Simulation: Allow the user to trigger simulated lane departure or obstacle events to test the system's response.
- Alert Log: Maintain a simple log of past alerts with timestamps for review.

## Style Guidelines:

- Background color: Dark grey (#222222) to enhance focus and reduce eye strain in a driving environment. The somber color increases the perceived reliability of the application.
- Primary color: Vibrant green (#32CD32) to indicate safe driving conditions and system readiness.
- Accent color: Amber (#FFBF00) and red (#FF4500) to provide clear and immediate warnings for potential hazards.
- Body and headline font: 'Inter', a sans-serif font, providing a modern, neutral, and easily readable interface for displaying critical information.
- Use clear and intuitive icons for lane departure, obstacle warnings, and system status indicators to ensure quick recognition.
- Arrange the dashboard with key information (speed, alerts) prominently displayed at the top, with secondary information (sensor readings, alert log) accessible below.
- Incorporate smooth transitions and subtle animations for alerts and data updates to provide a polished and responsive user experience.