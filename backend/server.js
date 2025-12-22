const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");

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
    const { name = "", email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if admin already exists
    const existingAdmin = await adminsCollection.findOne({ email });
    if (existingAdmin) {
      return res
        .status(409)
        .json({ error: "Admin with this email already exists" });
    }

    // Insert new admin
    const result = await adminsCollection.insertOne({
      name,
      email,
      password,
    });

    res.json({
      message: "Admin registered successfully",
      adminId: result.insertedId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admins", async (_req, res) => {
  try {
    const admins = await adminsCollection.find({}).toArray();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Admin login route

const adminCredentials = {
  email: normalizeEnv("ADMIN_EMAIL", "admin@example.com"),
  password: normalizeEnv("ADMIN_PASSWORD", "admin123"), // legacy fallback
};

const developerCredentials = {
  email: normalizeEnv("DEVELOPER_EMAIL", "dev@example.com"),
  password: normalizeEnv("DEVELOPER_PASSWORD", "dev123"),
};

app.post("/api/admin/login", async (req, res) => {
  const body = req.body || {};
  const email = body.email || body.id || body.username;
  const password = body.password;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const admin = await adminsCollection.findOne({ email });
    if (admin && admin.password === password) {
      return res.status(200).json({ success: true });
    }
  } catch (err) {
    console.error("Admin login error", err);
    return res.status(500).json({ error: "Server error" });
  }

  if (
    email === adminCredentials.email &&
    password === adminCredentials.password
  ) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

app.post("/api/developer/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (
    email === developerCredentials.email &&
    password === developerCredentials.password
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

    // Insert new surveyor
    await surveyorsCollection.insertOne({ id, password });

    return res.status(201).json({ message: "Surveyor registered" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/surveyors", async (_req, res) => {
  try {
    const surveyors = await surveyorsCollection.find({}).toArray();
    res.json(surveyors);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    if (password !== surveyor.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    return res.status(200).json({ message: "Login successful" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// API to get records with optional filtering, sorting, and pagination
app.get("/api/records", async (req, res) => {
  try {
    const {
      search = "",
      sex = "",
      caste = "",
      ageMin,
      ageMax,
      sort = "name",
      order = "asc",
      page = 1,
      pageSize = 20,
    } = req.query;

    const query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ name: regex }, { address: regex }, { society: regex }];
    }
    if (sex) query.sex = sex;
    if (caste) query.caste = { $regex: caste, $options: "i" };
    const min =
      ageMin !== undefined && ageMin !== "" && Number.isFinite(Number(ageMin))
        ? Number(ageMin)
        : undefined;
    const max =
      ageMax !== undefined && ageMax !== "" && Number.isFinite(Number(ageMax))
        ? Number(ageMax)
        : undefined;
    if (min !== undefined || max !== undefined) {
      query.age = {};
      if (min !== undefined) query.age.$gte = min;
      if (max !== undefined) query.age.$lte = max;
    }

    const sortDir = order === "desc" ? -1 : 1;
    const sortObj = { [sort]: sortDir };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    const cursor = recordsCollection.find(query).sort(sortObj);
    const total = await recordsCollection.countDocuments(query);
    const data = await cursor
      .skip((pageNum - 1) * sizeNum)
      .limit(sizeNum)
      .toArray();

    res.json({ data, total, page: pageNum, pageSize: sizeNum });
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

// Update a record
app.put("/api/records/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid record id" });
  }
  const { name, age, sex, address, part_no, society, caste } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (age !== undefined) update.age = parseInt(age);
  if (sex !== undefined) update.sex = sex;
  if (address !== undefined) update.address = address;
  if (part_no !== undefined) update.part_no = part_no;
  if (society !== undefined) update.society = society;
  if (caste !== undefined) update.caste = caste;

  try {
    const result = await recordsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!result.value) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json(result.value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a record
app.delete("/api/records/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid record id" });
  }
  try {
    const result = await recordsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json({ success: true });
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
