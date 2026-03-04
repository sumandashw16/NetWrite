import { useEffect } from "react";
import socket from "./utils/socket";
import Canvas from "./components/Canvas";

function App() {

  useEffect(() => {

    // Join drawing room
    socket.emit("join_room", "room1");

  }, []);

  return (
    <div>
      <h2>Collaborative Drawing</h2>
      <Canvas />
    </div>
  );
}

export default App;