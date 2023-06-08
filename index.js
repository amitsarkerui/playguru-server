const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 3030;
require("dotenv").config();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Guru is running...");
});

app.listen(port, () => {
  console.log(`Guru is rummimg on port: ${port}`);
});
