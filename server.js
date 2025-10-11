const jsonServer = require("json-server");
const server = jsonServer.create();
const middlewares = jsonServer.defaults();
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
dotenv.config();
const fetch = require("node-fetch"); // ensure this is installed: npm install node-fetch

// In-memory DB instead of writing to disk
let dbData = {};

// Middleware to add custom headers
server.use(middlewares);
server.use(jsonServer.bodyParser);
server.use((req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("abc", "XYZ123");
  next();
});

// Add template endpoint
server.post("/add-template", (req, res) => {
  try {
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

    // Find category ignoring case
    const allCategories = Object.keys(dbData);
    let matchedCategory = allCategories.find(
      (cat) => cat.toLowerCase() === categoryInput.toLowerCase()
    );

    // Create new category if not found
    if (!matchedCategory) {
      matchedCategory = categoryInput;
      dbData[matchedCategory] = [];
    }

    // Add template at top
    dbData[matchedCategory] = [template, ...(dbData[matchedCategory] || [])];

    console.log(`✅ Added new template to category '${matchedCategory}'`, template);
    res.status(200).json({ message: `Template added to category '${matchedCategory}'.`, template });
  } catch (error) {
    console.error("Error adding template:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Push in-memory DB to GitHub
server.post("/push-to-github", async (req, res) => {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO = "VidyBack/PostRequestVercel";
    const FILE_PATH = "db.json";
    const BRANCH = "master";

    const updatedContent = JSON.stringify(dbData, null, 2);

    // Get file SHA
    const getFile = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
    );

    const fileData = await getFile.json();
    if (!fileData.sha) {
      console.error("Could not get file SHA from GitHub response:", fileData);
      return res.status(500).json({ error: "Failed to get file SHA from GitHub" });
    }

    // Encode content and commit
    const encodedContent = Buffer.from(updatedContent).toString("base64");
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
      return res.status(200).json({ message: "db.json successfully pushed to GitHub.", commit: commitResponse.commit });
    } else {
      console.error("❌ GitHub commit failed:", commitResponse);
      return res.status(500).json({ error: "GitHub commit failed", commitResponse });
    }
  } catch (error) {
    console.error("Error pushing to GitHub:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Generic endpoint for adding posts
server.post("/:purpose", (req, res) => {
  const purpose = req.params.purpose;
  const newData = req.body;

  if (!dbData[purpose]) dbData[purpose] = [];
  dbData[purpose].push(newData);

  console.log("Added new post:", newData);
  res.status(200).json(newData);
});

// Use default router (optional)
server.use(jsonServer.router({}));

// Start server
const port = process.env.PORT || 8000;
server.listen(port, () => {
  console.log(`JSON Server running on http://localhost:${port}`);
});
