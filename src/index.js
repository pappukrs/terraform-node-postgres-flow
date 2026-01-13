const express = require("express");
const app = express();

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key";

// Simple DB initialization
const initDB = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
        `);
        console.log("Database initialized");
    } catch (err) {
        console.error("Database initialization failed:", err);
    }
};
initDB();

app.get("/", (req, res) => {
    res.send("CI/CD + Terraform demo is working 🚀");
});

app.get("/deploy", (req, res) => {
    res.send("deployed by CI/CD + Terraform demo working some changes 🚀");
});

// Signup Endpoint
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Missing credentials");

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashedPassword]);
        res.status(201).send("User created successfully");
    } catch (err) {
        if (err.code === "23505") return res.status(400).send("Username already exists");
        res.status(500).send("Error creating user");
    }
});

// Login Endpoint
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Missing credentials");

    try {
        const { rows } = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (rows.length === 0) return res.status(401).send("Invalid credentials");

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).send("Invalid credentials");

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    } catch (err) {
        res.status(500).send("Error logging in");
    }
});

app.listen(3000, () => console.log("App pg running on port 3000"));
