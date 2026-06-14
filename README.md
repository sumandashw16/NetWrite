### NetWrite: Real-Time Air Gesture Writing over Network

* Developed a virtual whiteboard that enables real-time air-gesture writing with **sub-100ms synchronization** across multiple connected clients.
* Architected a low-latency backend using **WebSockets (Socket.IO)** to synchronize live canvas states, drawing tools, and dynamic matchmaking rooms between concurrent users.
* Integrated **Google MediaPipe** for hand-tracking and gesture recognition, allowing users to write and draw in the air without physical input devices.
* Built a secure full-stack application with **JWT-based authentication** for user session management and role-based access.
* Designed and integrated a **MongoDB** database to persist user profiles, saved drawings, and application data.
* Implemented collaborative drawing features, enabling multiple users to interact on a shared canvas in real time.

**Tech Stack:** React.js, Node.js, Express.js, Socket.IO, Google MediaPipe, HTML5 Canvas API, MongoDB, JWT
