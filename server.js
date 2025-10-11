const jsonServer = require("json-server");
const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const { v4: uuidv4 } = require("uuid"); 
const dotenv = require("dotenv");
dotenv.config();

const path = require("path")

const fs = require("fs")

const adapter = new FileSync("db.json");
const db = low(adapter);


const customHeadersMiddleware = (req, res, next) => {
  // Set custom headers
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("abc", "XYZ123");

  // Continue with the next middleware or route handler
  next();
};

server.use(middlewares);
server.use(jsonServer.bodyParser);
server.use(customHeadersMiddleware);

let dbData;

async function loadDbFromGitHub() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO = "VidyBack/PostRequestVercel";
  const FILE_PATH = "db.json";
  const BRANCH = "master";

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
    },
  });

  const fileData = await res.json();

  if (fileData.content) {
    const decoded = Buffer.from(fileData.content, "base64").toString("utf-8");
    dbData = JSON.parse(decoded);
  } else {
    dbData = {}; // fallback if file doesn't exist
  }
}


server.post("/add-template", async (req, res) => {
  try {
    if (!dbData) {
  await loadDbFromGitHub();
}

    const template = req.body.template;

    if (!template || Object.keys(template).length === 0) {
      return res.status(400).json({ error: "Template body cannot be empty" });
    }

    if (!template.id) {
      const randomId = uuidv4();
      template.id = randomId;
      template.templateId = randomId;
    }

    const categoryInput = template.category?.[0];
    if (!categoryInput) {
      return res.status(400).json({ error: "Template must have a 'category' field" });
    }

    // Case-insensitive category
    let matchedCategory = Object.keys(dbData).find(
      (cat) => cat.toLowerCase() === categoryInput.toLowerCase()
    );
    if (!matchedCategory) matchedCategory = categoryInput;

    dbData[matchedCategory] = [template, ...(dbData[matchedCategory] || [])];

    console.log(`✅ Added new template to category '${matchedCategory}'`, template);

    res.status(200).json({ message: `Template added to category '${matchedCategory}'.`, template });
  } catch (err) {
    console.error("Error adding template:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



server.post("/push-to-github", async (req, res) => {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO = "VidyBack/ServerTemplates";
    const FILE_PATH = "db.json";
    const BRANCH = "main";

    if (!dbData) {
      return res.status(400).json({ error: "No in-memory DB data to push. Add templates first." });
    }

    console.log("githubtoken", GITHUB_TOKEN);

    // 1️⃣ Fetch file metadata (get latest SHA)
    const getFile = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
        },
      }
    );

    const fileData = await getFile.json();

    if (!fileData.sha) {
      console.error("Could not get file SHA from GitHub response:", fileData);
      return res.status(500).json({ error: "Failed to get file SHA from GitHub" });
    }

    // 2️⃣ Encode in-memory DB to base64
    const encodedContent = Buffer.from(JSON.stringify(dbData, null, 2)).toString("base64");

    // 3️⃣ Commit updated file
    const commit = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Updated db.json via API`,
        content: encodedContent,
        sha: fileData.sha,
        branch: BRANCH,
      }),
    });

    const commitResponse = await commit.json();

    if (commitResponse.commit) {
      console.log("✅ db.json successfully pushed to GitHub.");
      return res.status(200).json({
        message: "db.json successfully pushed to GitHub.",
        commit: commitResponse.commit,
      });
    } else {
      console.error("❌ GitHub commit failed:", commitResponse);
      return res.status(500).json({ error: "GitHub commit failed", commitResponse });
    }
  } catch (error) {
    console.error("Error pushing to GitHub:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



server.post("/:purpose", (req, res) => {
  // Process the request body and add/update data in db.json using lowdb
  const newData = req.body;
  // Add a new post
  db.get(req.params.purpose).push(newData).write();
  console.log("Added new post:", newData);
  res.status(200).json(newData);
});

server.use(router);

const port = process.env.PORT || 8000;
server.listen(port, () => {
  console.log(`JSON Server is running on http://localhost:${port}`);
});
