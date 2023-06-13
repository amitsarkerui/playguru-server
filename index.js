const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3030;
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};
app.use(cors(corsConfig));
app.use(express.json());

// Verify JWT Function
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
    console.log(error);
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access 2" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USERS}:${process.env.DB_PASS}@cluster0.pq4nrld.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    // DB Collection connect
    const classesCollection = client.db("playGuru").collection("classes");
    const usersCollection = client.db("playGuru").collection("users");
    const cartCollection = client.db("playGuru").collection("carts");
    const paymentCollection = client.db("playGuru").collection("payments");
    const enrollmentClassCollection = client
      .db("playGuru")
      .collection("enrollmentClass");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "10h",
      });

      res.send({ token });
    });

    //CheckAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    // Check Instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // Load all classes
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // Load all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Load specific user
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // specific classes
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    // Post signing user data
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment api
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      console.log(payment.cartId);
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: new ObjectId(payment.cartId),
      };
      const deleteResult = await cartCollection.deleteOne(query);

      res.send({ insertResult, deleteResult });
    });

    // enrollment Class
    app.post("/enrollmentClass", verifyJWT, async (req, res) => {
      const enrollmentClass = req.body;
      const insertResult = await enrollmentClassCollection.insertOne(
        enrollmentClass
      );
      res.send(insertResult);
    });

    // Cart post
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });
    // cart get by email
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const queryResult = await cartCollection.find(query).toArray();
      res.send(queryResult);
    });

    // Delete Cart
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Update student enrollment
    app.patch("/classes/:id", verifyJWT, async (req, res) => {
      const body = req.body;
      console.log(body);
      const id = req.params.id;
      console.log("hating Update enrollment", id);
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { enrolledStudents: 1 } };
      // const options = { upsert: true };
      // const update = {
      //   $set: {
      //     enrolledStudents: body.enrolledStudents,
      //   },
      // };

      try {
        const result = await classesCollection.updateOne(query, update);
        console.log(result);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: "Server error" });
      }
    });

    app.get("/enrollClass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const queryResult = await enrollmentClassCollection.find(query).toArray();
      res.send(queryResult);
    });

    app.get("/", (req, res) => {
      res.send("Guru is running...");
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Guru is running on port: ${port}`);
});
