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

server.post("/add-template", async (req, res) => {
  try {
    const template = req.body.template;
    console.log("template==>", template);

    if (!template || Object.keys(template).length === 0) {
      return res.status(400).json({ error: "Template body cannot be empty" });
    }

    // Ensure id and templateId exist
    if (!template.id) {
      const randomId = uuidv4();
      template.id = randomId;
      template.templateId = randomId;
    }

    // Validate category
    const categoryInput = template.category?.[0];
    if (!categoryInput) {
      return res.status(400).json({ error: "Template must have a 'category' field" });
    }

    // Find category ignoring case
    const allCategories = Object.keys(db.value());
    let matchedCategory = allCategories.find(
      (cat) => cat.toLowerCase() === categoryInput.toLowerCase()
    );

    // If no match found, create new category
    if (!matchedCategory) {
      matchedCategory = categoryInput;
      db.set(matchedCategory, []).write();
    }

    // Add template at top of that category (immutable way)
    const existingTemplates = db.get(matchedCategory).value() || [];
    const updatedTemplates = [template, ...existingTemplates];

    db.set(matchedCategory, updatedTemplates).write();

    console.log(`✅ Added new template to category '${matchedCategory}'`, template);

    res.status(200).json({
      message: `Template added to category '${matchedCategory}'.`,
      template,
    });
  } catch (error) {
    console.error("Error adding template:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



server.post("/push-to-github", async (req, res) => {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // ✅ stored in Vercel env vars
    const REPO = "VidyBack/PostRequestVercel"; // your repo
    const FILE_PATH = "db.json";
    const BRANCH = "master";

    // Read local db.json
    const dbPath = path.join(process.cwd(), "db.json");
    const updatedContent = fs.readFileSync(dbPath, "utf-8");

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

    // 2️⃣ Encode content to base64
    const encodedContent = Buffer.from(updatedContent).toString("base64");

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
