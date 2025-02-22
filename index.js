const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");

const port = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Replace with your frontend URL
    methods: ["GET", "POST","PUT","DELETE"],
  },
});

app.set("socketio", io);

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clustervisa.kw9rj.mongodb.net/?retryWrites=true&w=majority&appName=ClusterVisa`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const todosCollection = client.db("todosDB").collection("todos");
    const usersCollection = client.db("todosDB").collection("users");

    // Socket.IO connection
    io.on("connection", (socket) => {
      console.log("A client connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("A client disconnected:", socket.id);
      });
    });

    // Get all tasks
    app.get("/todos", async (req, res) => {
      try {
        const result = await todosCollection.find().toArray();
        res.status(200).json(result);
      } catch (err) {
        console.error("Error fetching tasks:", err.message);
        res.status(500).json({ error: "Failed to fetch tasks" });
      }
    });

    app.get("/todos/:id", async(req,res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await todosCollection.findOne(query);
      res.send(result)
    })

    // Add a new task
    app.post("/todos", async (req, res) => {
      try {
        const { title, description, category, email } = req.body;

        if (!title || !description || !category || !email) {
          return res.status(400).json({ error: "All fields are required" });
        }

        const newTask = {
          title,
          description,
          category,
          email,
          createdAt: new Date(),
        };

        const result = await todosCollection.insertOne(newTask);
        const insertedTask = { ...newTask, _id: result.insertedId };

    
        io.emit("taskAdded", insertedTask);

        res.status(201).json(insertedTask);
      } catch (err) {
        console.error("Error adding task:", err.message);
        res.status(500).json({ error: "Failed to add task" });
      }
    });

   
    app.put("/todos/:id", async (req, res) => {
      try {
        const { category } = req.body;
        const id = req.params.id;

        if (!category) {
          return res.status(400).json({ error: "Category is required" });
        }

        const result = await todosCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { category } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Task not found" });
        }

        // Emit event to all clients
        io.emit("taskUpdated", { id, category });

        res.status(200).json({ success: true, message: "Task updated successfully" });
      } catch (err) {
        console.error("Error updating task:", err.message);
        res.status(500).json({ error: "Failed to update task" });
      }
    });

    app.delete("/todos/:taskId", async (req, res) => {
      try {
        const { taskId } = req.params;
        const query = { _id: new ObjectId(taskId) };
        const result = await todosCollection.deleteOne(query);
    
        if (result.deletedCount === 1) {
          io.emit("taskDeleted", { id: taskId }); // Emit the event to notify all clients
          res.status(200).json({ success: true, message: "Task deleted successfully" });
        } else {
          res.status(404).json({ success: false, message: "Task not found" });
        }
      } catch (err) {
        console.error("Error deleting task:", err.message);
        res.status(500).json({ error: "Failed to delete task" });
      }
    });
    

    app.post("/user", async(req,res)=>{
      const userInfo = req.body;
      const result = await usersCollection.insertOne(userInfo);
      res.send(result)
    }) 

    console.log("Successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

// Default route
app.get("/", (req, res) => {
  res.send("Welcome to Todo Server");
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});