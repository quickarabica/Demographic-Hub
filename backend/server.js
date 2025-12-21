const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
const normalizeEnv = (name, fallback) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.replace(/^['"]|['"]$/g, ""); // remove wrapping quotes if present
};

const port = Number(normalizeEnv("PORT")) || 3000;
const mongoUri = normalizeEnv("MONGODB_URI");
const dbName = normalizeEnv("DB_NAME");
const staticDir = path.join(__dirname, "..", "frontend");

if (!mongoUri || !dbName) {
  console.error("Missing required env: MONGODB_URI or DB_NAME");
  process.exit(1);
}

const allowedOrigins = normalizeEnv("CORS_ORIGIN", "*")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
  })
);
// Accept JSON and form bodies; be lenient so proxies don't drop them
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(staticDir));
app.get("/", (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

let db, recordsCollection, adminsCollection, surveyorsCollection;

// Connect to MongoDB and then start the server
MongoClient.connect(mongoUri, {
  tls: true,
  serverApi: { version: "1", strict: true, deprecationErrors: true },
})
  .then((client) => {
    console.log("Connected to MongoDB");
    db = client.db(dbName);
    recordsCollection = db.collection("records");
    adminsCollection = db.collection("admins");
    surveyorsCollection = db.collection("surveyors");

    app.listen(port, () =>
      console.log(`Server running on http://localhost:${port}`)
    );
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });

app.post("/api/admin/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    // Check if admin already exists
    const existingAdmin = await adminsCollection.findOne({ email });
    if (existingAdmin) {
      return res
        .status(409)
        .json({ error: "Admin with this email already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin
    const result = await adminsCollection.insertOne({
      name,
      email,
      password: hashedPassword,
    });

    res.json({
      message: "Admin registered successfully",
      adminId: result.insertedId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Admin login route

const adminCredentials = {
  email: normalizeEnv("ADMIN_EMAIL", "admin@example.com"),
  password: normalizeEnv("ADMIN_PASSWORD", "admin123"), // In production, hash this!
};

app.post("/api/admin/login", (req, res) => {
  const body = req.body || {};
  const email = body.email || body.id || body.username;
  const password = body.password;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (
    email === adminCredentials.email &&
    password === adminCredentials.password
  ) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

app.post("/api/surveyor/register", async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ error: "ID and password are required" });
  }

  try {
    // Check if surveyor already exists
    const existingSurveyor = await surveyorsCollection.findOne({ id });
    if (existingSurveyor) {
      return res.status(409).json({ error: "Surveyor already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new surveyor
    await surveyorsCollection.insertOne({ id, password: hashedPassword });

    return res.status(201).json({ message: "Surveyor registered" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/surveyor/login", async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ error: "ID and password are required" });
  }

  try {
    const surveyor = await surveyorsCollection.findOne({ id });
    if (!surveyor) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password with hashed password
    const isMatch = await bcrypt.compare(password, surveyor.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.status(200).json({ message: "Login successful" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// API to get all records
app.get("/api/records", async (req, res) => {
  try {
    const records = await recordsCollection.find({}).toArray();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API to add a single record
app.post("/api/records", async (req, res) => {
  const { name, age, sex, address, part_no, society, caste } = req.body;
  try {
    const result = await recordsCollection.insertOne({
      name,
      age: parseInt(age),
      sex,
      address,
      part_no,
      society,
      caste,
    });
    res.json({ id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API to add bulk records
app.post("/api/records/bulk", async (req, res) => {
  const records = req.body.map((record) => ({
    name: record.name,
    age: parseInt(record.age),
    sex: record.sex,
    address: record.address,
    part_no: record.part_no,
    society: record.society,
    caste: record.caste,
  }));
  try {
    const result = await recordsCollection.insertMany(records);
    res.json({ success: true, insertedCount: result.insertedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
